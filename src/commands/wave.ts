import { existsSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { Command } from 'commander'

import { getPlanState } from '../lib/api.js'
import { requireField } from '../lib/config.js'
import { assertValidGroupKey, assertValidPhaseSlug } from '../lib/group-key.js'
import { assertValidTaskClientId } from '../lib/task-key.js'
import { groupWorktreePath } from './worktree.js'

export interface WaveTask {
  id: string
  client_id: string
  phase_slug: string
  group_key: string | null
  description: string
  acceptance_criteria: string
  test_file_path: string | null
  status: string
  depends_on_client_ids: string[] | null | undefined
  output_artifacts: Array<{ path: string; kind: string }> | null | undefined
}

export interface ComputeNextWaveInput {
  tasks: WaveTask[]
  groupKey: string
  phaseSlug: string
}

export interface ComputeNextWaveResult {
  wave_index: number
  tasks: WaveTask[]
}

/**
 * 다음 wave 의 task 집합 반환.
 * 정의: status='pending' + 모든 depends_on_client_ids 의 task 가 같은 task list 안에서 status='done'.
 * 순환 의존성 / blocked / 다른 group / 다른 phase 는 wave 후보에서 제외.
 */
export function computeNextWave(input: ComputeNextWaveInput): ComputeNextWaveResult {
  const inGroup = input.tasks.filter(
    (t) => t.group_key === input.groupKey && t.phase_slug === input.phaseSlug,
  )

  const doneSet = new Set(inGroup.filter((t) => t.status === 'done').map((t) => t.client_id))

  const totalCount = inGroup.length
  const allDoneCount = doneSet.size

  const candidates = inGroup.filter((t) => {
    if (t.status !== 'pending') return false
    const deps = t.depends_on_client_ids ?? []
    return deps.every((dep) => doneSet.has(dep))
  })

  if (candidates.length === 0) {
    return { wave_index: -1, tasks: [] }
  }

  // wave_index 의 의미 — 다음 wave 의 번호 (debugging / UI 표시 용도).
  // 빈 wave (모두 done 또는 candidates 0) = -1
  // 그 외 = floor(doneCount / totalCount) + 1 — done 비율 기반 단순 추정
  //   (totalCount 0 보장 + Math.max(1, ...) — 0 div 방어)
  const waveIndex =
    totalCount === 0 ? 0 : Math.floor(allDoneCount / Math.max(1, totalCount - allDoneCount)) + 1

  return {
    wave_index: waveIndex,
    tasks: candidates,
  }
}

export interface ValidateDisjointInput {
  tasks: WaveTask[]
}

export interface DisjointConflict {
  tasks: [string, string]  // [client_id_a, client_id_b]
  files: string[]          // intersection files (path 기준)
}

export interface ValidateDisjointResult {
  ok: boolean
  conflicts: DisjointConflict[]
}

/**
 * wave 안 task 들의 output_artifacts pairwise intersection 검증.
 * 충돌 = 같은 file path 를 2+ task 가 변경. 모든 pair 의 intersection 보고.
 * null / undefined output_artifacts = 빈 set (충돌 0).
 * path 기준 비교 (kind 무관).
 *
 * 디렉토리 경로(끝이 `/`)는 비교에서 제외한다 — 마이그레이션 task 는 파일명이
 * `supabase migration new` 의 timestamp 라 plan 시점에 못 박으므로 output_artifacts 를
 * `supabase/migrations/` 디렉토리로 둔다. 마이그레이션 파일은 timestamp 라 본질적으로
 * unique → 디렉토리가 겹쳐도 실제 파일 충돌은 없다. (worker prompt 가 "디렉토리는 만들
 * 파일이 아니라 식별자"임을 명시)
 */
export function validateDisjoint(input: ValidateDisjointInput): ValidateDisjointResult {
  const conflicts: DisjointConflict[] = []
  const tasks = input.tasks
  const filePaths = (t: WaveTask) =>
    (t.output_artifacts ?? []).map((a) => a.path).filter((p) => !p.endsWith('/'))

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const aPaths = new Set(filePaths(tasks[i]))
      const bPaths = new Set(filePaths(tasks[j]))
      const intersection = [...aPaths].filter((p) => bPaths.has(p))
      if (intersection.length > 0) {
        conflicts.push({
          tasks: [tasks[i].client_id, tasks[j].client_id],
          files: intersection,
        })
      }
    }
  }

  return { ok: conflicts.length === 0, conflicts }
}

export interface MergeWaveOpts {
  groupKey: string
  taskClientIds: string[]
  cwd?: string
}

export interface MergeWaveResult {
  merged_commits: number
}

/**
 * task branch 들의 feat/<gk>-group 이후 commits 을 group branch (feat/<gk>-group) 로 cherry-pick.
 * task_client_id 순으로 정렬 후 순차 cherry-pick.
 * 충돌 시 abort + throw + 명확한 보고.
 *
 * cherry-pick 은 **group worktree (.tokb/worktrees/<gk>) 안에서** 실행한다.
 * 그 worktree 가 이미 group branch HEAD 라 checkout 이 불필요하고, leader 메인트리에서
 * `git checkout feat/<gk>-group` 을 시도할 때 나던 "already checked out" 충돌을 회피한다.
 */
export async function mergeWave(opts: MergeWaveOpts): Promise<MergeWaveResult> {
  assertValidGroupKey(opts.groupKey)
  for (const id of opts.taskClientIds) {
    assertValidTaskClientId(id)
  }

  const groupBranch = `feat/${opts.groupKey}-group`

  if (opts.taskClientIds.length === 0) {
    return { merged_commits: 0 }
  }

  // group worktree 가 작업 cwd — 이미 group branch 를 점유(HEAD)하므로 checkout 안 한다.
  const baseCwd = opts.cwd ?? process.cwd()
  const cwd = groupWorktreePath(baseCwd, opts.groupKey)
  if (!existsSync(cwd)) {
    throw new Error(
      `group worktree 부재: ${cwd}. \`tokb worktree create ${opts.groupKey}\` 를 먼저 실행하세요.`,
    )
  }

  const sortedIds = [...opts.taskClientIds].sort()
  let mergedCommits = 0

  for (const taskId of sortedIds) {
    const taskBranch = `feat/${opts.groupKey}/${taskId}`
    // task branch 의 group branch 이후 commits
    const commitsOut = execFileSync(
      'git',
      ['log', '--format=%H', '--reverse', `${groupBranch}..${taskBranch}`],
      { cwd, stdio: 'pipe' },
    ).toString()
    const commits = commitsOut.split('\n').filter(Boolean)

    for (const sha of commits) {
      try {
        execFileSync('git', ['cherry-pick', sha], { cwd, stdio: 'pipe' })
        mergedCommits++
      } catch (e) {
        let abortFailed = false
        try {
          execFileSync('git', ['cherry-pick', '--abort'], { cwd, stdio: 'pipe' })
        } catch {
          abortFailed = true
        }
        // CHERRY_PICK_HEAD 잔존 검사 — abort 실패 시 명시.
        // cwd 가 group worktree 면 `.git` 은 gitlink 파일이라 `.git/CHERRY_PICK_HEAD` 가 없다.
        // git rev-parse --git-path 로 worktree-aware 한 실제 경로를 얻는다.
        let stateRemains = false
        try {
          const rel = execFileSync('git', ['rev-parse', '--git-path', 'CHERRY_PICK_HEAD'], {
            cwd,
            stdio: 'pipe',
          })
            .toString()
            .trim()
          const abs = path.isAbsolute(rel) ? rel : path.join(cwd, rel)
          stateRemains = existsSync(abs)
        } catch {
          // rev-parse 실패 시 보수적으로 false
        }
        const rawMsg = e instanceof Error ? e.message : String(e)
        const msg = rawMsg.replace(/[\r\n\t\x1b]/g, ' ')
        const stateNote = stateRemains
          ? ' ⚠️ git 상태 불일치 — 수동 `git cherry-pick --abort` 필요.'
          : abortFailed
            ? ' (cherry-pick --abort 실패, 상태 정리됨)'
            : ''
        throw new Error(
          `cherry-pick conflict — task ${taskId} commit ${sha.slice(0, 7)} 충돌. 파일 겹침 룰 위반 가능성 (validate-disjoint 사전 호출 권장). ${msg}${stateNote}`,
        )
      }
    }
  }

  return { merged_commits: mergedCommits }
}

export function waveCommand(program: Command): void {
  const wave = program.command('wave').description('wave 단위 task 병렬 호출 보조 명령 (AI-DLC Stage A)')

  wave
    .command('next')
    .description('다음 wave 의 task list (depends_on 그래프 topological — JSON 출력)')
    .requiredOption('--phase <phaseSlug>', 'phase_slug')
    .requiredOption('--group <groupKey>', 'group_key')
    .action(async (opts: { phase: string; group: string }) => {
      assertValidPhaseSlug(opts.phase)
      assertValidGroupKey(opts.group)
      const planId = await requireField('plan_id')
      const state = await getPlanState(planId, opts.phase)
      const allTasks: WaveTask[] = []
      for (const g of state.groups) {
        for (const t of g.tasks) {
          allTasks.push({
            id: t.id,
            client_id: t.client_id,
            phase_slug: t.phase_slug,
            group_key: t.group_key,
            description: t.description,
            acceptance_criteria: t.acceptance_criteria,
            test_file_path: t.test_file_path,
            status: t.status,
            depends_on_client_ids: t.depends_on_client_ids,
            output_artifacts: t.output_artifacts,
          })
        }
      }
      const result = computeNextWave({ tasks: allTasks, groupKey: opts.group, phaseSlug: opts.phase })
      console.log(JSON.stringify(result, null, 2))
    })

  wave
    .command('validate-disjoint')
    .description('wave 안 task 들의 output_artifacts pairwise intersection 검증 (충돌 시 exit 1)')
    .requiredOption('--tasks <ids>', '쉼표 분리 task client_id 들 (예: T-001,T-002)')
    .requiredOption('--phase <phaseSlug>', 'phase_slug')
    .requiredOption('--group <groupKey>', 'group_key')
    .action(async (opts: { tasks: string; phase: string; group: string }) => {
      assertValidPhaseSlug(opts.phase)
      assertValidGroupKey(opts.group)
      const clientIds = opts.tasks.split(',').map((s) => s.trim()).filter(Boolean)
      for (const id of clientIds) {
        assertValidTaskClientId(id)
      }
      const planId = await requireField('plan_id')
      const state = await getPlanState(planId, opts.phase)
      const targetTasks: WaveTask[] = []
      for (const g of state.groups) {
        if (g.group_key !== opts.group) continue
        for (const t of g.tasks) {
          if (clientIds.includes(t.client_id)) {
            targetTasks.push({
              id: t.id,
              client_id: t.client_id,
              phase_slug: t.phase_slug,
              group_key: t.group_key,
              description: t.description,
              acceptance_criteria: t.acceptance_criteria,
              test_file_path: t.test_file_path,
              status: t.status,
              depends_on_client_ids: t.depends_on_client_ids,
              output_artifacts: t.output_artifacts,
            })
          }
        }
      }
      const result = validateDisjoint({ tasks: targetTasks })
      console.log(JSON.stringify(result, null, 2))
      if (!result.ok) {
        process.exit(1)
      }
    })

  wave
    .command('merge')
    .description('task branch 들의 commits 을 group branch (feat/<group>-group) 로 cherry-pick (task_client_id 순)')
    .requiredOption('--group <groupKey>', 'group_key')
    .requiredOption('--tasks <ids>', '쉼표 분리 task client_id 들')
    .action(async (opts: { group: string; tasks: string }) => {
      assertValidGroupKey(opts.group)
      const taskClientIds = opts.tasks.split(',').map((s) => s.trim()).filter(Boolean)
      for (const id of taskClientIds) {
        assertValidTaskClientId(id)
      }
      try {
        const result = await mergeWave({ groupKey: opts.group, taskClientIds })
        console.log(JSON.stringify(result, null, 2))
      } catch (e) {
        console.error('✗', e instanceof Error ? e.message : String(e))
        process.exit(1)
      }
    })
}
