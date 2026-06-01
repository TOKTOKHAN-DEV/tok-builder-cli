import { existsSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { Command } from 'commander'

import { getPlanState } from '../lib/api.js'
import { requireField } from '../lib/config.js'
import { assertValidGroupKey, assertValidPhaseSlug } from '../lib/group-key.js'
import { assertValidTaskClientId } from '../lib/task-key.js'
import { resolveRecommendedModel } from './worker.js'
import { groupWorktreePath, worktreeCreate, worktreeCreateTask } from './worktree.js'

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
  // 권장 model 계산용 (wave next 출력에 recommended_model 부착) — computeNextWave 는 안 쓰고 보존만.
  sub_step?: string | null
  last_failed_event_meta?: { escalated_to_model?: 'haiku' | 'sonnet' } | null
}

export interface ComputeNextWaveInput {
  tasks: WaveTask[]
  phaseSlug: string
}

export interface ComputeNextWaveResult {
  wave_index: number
  tasks: WaveTask[]
}

/**
 * task 가 실제로 변경하는 file path 들 (디렉토리 식별자 끝 `/` 는 제외 — validateDisjoint 와 동일 규칙).
 * 끝 `/` 를 먼저 거른 뒤 path.posix.normalize 로 정규화 — `./a.ts` 와 `a.ts`, `src/../src/a.ts`
 * 같은 비정규 표기가 같은 파일을 다른 것으로 보아 disjoint 충돌(같은 파일 동시 변경)을 놓치는 것 방지.
 * (정규화를 끝 `/` 검사 뒤에 두는 이유: normalize 가 후행 슬래시를 떼어 디렉토리 식별자가 파일로 둔갑하는 것 회피.)
 */
function taskFilePaths(t: WaveTask): string[] {
  return (t.output_artifacts ?? [])
    .map((a) => a.path)
    .filter((p) => !p.endsWith('/'))
    .map((p) => path.posix.normalize(p))
}

/**
 * wave 전체 task 를 group_key 별로 분류한다 (group 첫 등장 순서 + 각 group 안 client_id 입력 순서 보존).
 * `tokb wave merge` 의 group 자동 분류 모드가 사용 — leader 가 wave 의 task 를 group 별로 직접 나눠
 * `for g in $groups; do tokb wave merge --group $g ...` 셸 루프를 짜던 흐름(zsh 단어 분리로 깨짐)을 제거.
 * 분류를 cli 로 옮겨 worktree 생성 면역화(buildWaveDispatch)와 같은 철학으로 셸 루프 자체를 없앤다.
 */
export function partitionByGroup(
  tasks: Array<{ client_id: string; group_key: string | null }>,
): Array<{ groupKey: string; taskClientIds: string[] }> {
  const order: string[] = []
  const byGroup = new Map<string, string[]>()
  for (const t of tasks) {
    if (!t.group_key) {
      throw new Error(`task ${t.client_id} 의 group_key 가 없어 group 분류 불가`)
    }
    if (!byGroup.has(t.group_key)) {
      byGroup.set(t.group_key, [])
      order.push(t.group_key)
    }
    byGroup.get(t.group_key)!.push(t.client_id)
  }
  return order.map((groupKey) => ({ groupKey, taskClientIds: byGroup.get(groupKey)! }))
}

/**
 * 다음 wave 의 task 집합 반환 (phase-wide).
 * 정의: phase 안에서 status='pending' + 모든 depends_on_client_ids 의 task 가 status='done' 인 task.
 *   - group 경계 무관 — 같은 phase 면 서로 다른 group 의 task 도 한 wave 로 병렬화한다
 *     (병렬 단위 = group 이 아니라 task. group 은 PR/표시 라벨일 뿐).
 *   - disjoint-aware: 후보 중 output_artifacts(파일) 가 서로 겹치지 않는 task 를 client_id 순 greedy 로 선택.
 *     파일이 겹치는 task 는 이번 wave 에서 빠지고 다음 wave 로 미뤄진다 (cherry-pick 충돌 방지).
 * 순환 의존성 / blocked / 다른 phase 는 wave 후보에서 제외.
 */
export function computeNextWave(input: ComputeNextWaveInput): ComputeNextWaveResult {
  const inPhase = input.tasks.filter((t) => t.phase_slug === input.phaseSlug)

  const doneSet = new Set(inPhase.filter((t) => t.status === 'done').map((t) => t.client_id))

  const totalCount = inPhase.length
  const allDoneCount = doneSet.size

  const candidates = inPhase.filter((t) => {
    if (t.status !== 'pending') return false
    const deps = t.depends_on_client_ids ?? []
    return deps.every((dep) => doneSet.has(dep))
  })

  // disjoint-aware 선택 — client_id 정렬(결정적) 후, 이미 점유된 file 과 안 겹치는 task 만 같은 wave.
  // 겹치는 task 는 이번 wave 제외 → 다음 wave 로 (한 file 을 2 task 가 동시에 쓰면 cherry-pick 충돌).
  const sorted = [...candidates].sort((a, b) => a.client_id.localeCompare(b.client_id))
  const selected: WaveTask[] = []
  const usedFiles = new Set<string>()
  for (const t of sorted) {
    const files = taskFilePaths(t)
    if (files.some((f) => usedFiles.has(f))) continue
    selected.push(t)
    for (const f of files) usedFiles.add(f)
  }

  if (selected.length === 0) {
    return { wave_index: -1, tasks: [] }
  }

  // wave_index 의 의미 — 다음 wave 의 번호 (debugging / UI 표시 용도).
  // 빈 wave (모두 done 또는 candidates 0) = -1
  // 그 외 = floor(doneCount / totalCount) + 1 — done 비율 기반 단순 추정
  //   (totalCount 0 보장 + Math.max(1, ...) — 0 div 방어)
  //   ⚠️ disjoint 로 후보가 다음 wave 로 밀릴 수 있어 실제 호출 차수와 정확히 일치하진 않는다(표시용).
  const waveIndex =
    totalCount === 0 ? 0 : Math.floor(allDoneCount / Math.max(1, totalCount - allDoneCount)) + 1

  return {
    wave_index: waveIndex,
    tasks: selected,
  }
}

export type WaveTaskWithModel = WaveTask & { recommended_model: 'haiku' | 'sonnet' }

/**
 * wave next 출력 task 에 recommended_model 부착.
 * sub_step → model 매핑(+escalation 우선)은 worker prompt 와 단일 출처(resolveRecommendedModel) 공유.
 * leader 가 wave next 결과만으로 worker dispatch model 을 정하게 해 `tokb worker prompt` 전문 fetch 를 없앤다.
 */
export function attachRecommendedModel(tasks: WaveTask[]): WaveTaskWithModel[] {
  return tasks.map((t) => ({
    ...t,
    recommended_model: resolveRecommendedModel(t.sub_step, t.last_failed_event_meta?.escalated_to_model),
  }))
}

/** wave start 출력 / wave-codegen workflow args 계약. groupKey 는 leader 의 wave merge 분류용. */
export interface WaveDispatchTask {
  taskId: string
  clientId: string
  groupKey: string
  worktree: string
  model: 'haiku' | 'sonnet'
}

export interface BuildWaveDispatchOpts {
  cwd?: string
  /** group worktree pnpm install 여부 (기본 true). 테스트는 false. */
  install?: boolean
}

/**
 * wave 안 task 들의 worktree(group + task)를 CLI 내부에서 일괄 생성하고 dispatch 배열 반환.
 * worktree 생성을 전부 TS(path.join + execFileSync)로 처리해, leader 가 shell 루프로
 * `tokb worktree create-task` 를 N 번 호출하던 흐름을 없앤다 — zsh 단어 분리(unquoted scalar
 * 미분리) 로 worktree 이름이 뭉개지던 버그의 근원을 제거.
 *
 * - group worktree: wave 안 distinct group_key 마다 멱등 생성(있으면 skip) + pre-push hook 용 deps install
 * - task worktree: task 마다 생성 → { taskId, clientId, groupKey, worktree, model }
 */
export async function buildWaveDispatch(
  tasks: WaveTaskWithModel[],
  opts: BuildWaveDispatchOpts = {},
): Promise<WaveDispatchTask[]> {
  const cwd = opts.cwd ?? process.cwd()
  const install = opts.install ?? true

  // group_key 는 worktree 이름의 일부 — 없으면 worktree 를 만들 수 없다.
  for (const t of tasks) {
    if (!t.group_key) {
      throw new Error(`task ${t.client_id} 에 group_key 가 없어 worktree 를 만들 수 없습니다.`)
    }
  }

  // 1) wave 안 distinct group_key 마다 group worktree 멱등 생성 (base branch + pre-push hook deps)
  const groupKeys = [...new Set(tasks.map((t) => t.group_key as string))]
  for (const gk of groupKeys) {
    const { path: gwt } = await worktreeCreate({ groupKey: gk, cwd })
    if (install) {
      try {
        execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: gwt, stdio: 'pipe' })
      } catch (e) {
        // 실패해도 worktree 생성 자체는 유효 — group complete push 시점에 재시도 가능.
        // stdout 은 JSON 전용이므로 경고는 stderr 로.
        process.stderr.write(
          `⚠️ group worktree ${gk} pnpm install 실패 (group push 시 pre-push hook 주의): ${
            e instanceof Error ? e.message : String(e)
          }\n`,
        )
      }
    }
  }

  // 2) task 마다 task worktree 생성 → dispatch entry
  const dispatch: WaveDispatchTask[] = []
  for (const t of tasks) {
    const gk = t.group_key as string
    const { path: wtPath } = await worktreeCreateTask({ groupKey: gk, taskClientId: t.client_id, cwd })
    dispatch.push({
      taskId: t.id,
      clientId: t.client_id,
      groupKey: gk,
      worktree: wtPath,
      model: t.recommended_model,
    })
  }
  return dispatch
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

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const aPaths = new Set(taskFilePaths(tasks[i]))
      const bPaths = new Set(taskFilePaths(tasks[j]))
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

/**
 * plan state 를 가져와 해당 phase 의 모든 task 를 WaveTask[] 로 매핑.
 * wave next / wave start / validate-disjoint 가 공유 (매핑 drift 방지).
 */
async function fetchPhaseTasks(phaseSlug: string): Promise<WaveTask[]> {
  const planId = await requireField('plan_id')
  const state = await getPlanState(planId, phaseSlug)
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
        sub_step: t.sub_step,
        last_failed_event_meta: t.last_failed_event_meta,
      })
    }
  }
  return allTasks
}

export function waveCommand(program: Command): void {
  const wave = program.command('wave').description('wave 단위 task 병렬 호출 보조 명령 (AI-DLC Stage A)')

  wave
    .command('next')
    .description('다음 wave 의 task list (phase 전체 depends_on 그래프 + disjoint-aware — JSON 출력)')
    .requiredOption('--phase <phaseSlug>', 'phase_slug')
    .action(async (opts: { phase: string }) => {
      assertValidPhaseSlug(opts.phase)
      const allTasks = await fetchPhaseTasks(opts.phase)
      const result = computeNextWave({ tasks: allTasks, phaseSlug: opts.phase })
      // recommended_model 부착 — leader 가 wave next 결과만으로 worker model 을 정할 수 있게.
      console.log(
        JSON.stringify({ ...result, tasks: attachRecommendedModel(result.tasks) }, null, 2),
      )
    })

  wave
    .command('start')
    .description(
      '다음 wave 의 worktree(group + task) 일괄 생성 + dispatch 배열 JSON 출력 ' +
        '(wave next + worktree create-task 융합 — leader shell 루프 불필요)',
    )
    .requiredOption('--phase <phaseSlug>', 'phase_slug')
    .action(async (opts: { phase: string }) => {
      assertValidPhaseSlug(opts.phase)
      const allTasks = await fetchPhaseTasks(opts.phase)
      const { wave_index, tasks } = computeNextWave({ tasks: allTasks, phaseSlug: opts.phase })
      const withModel = attachRecommendedModel(tasks)
      const dispatch = await buildWaveDispatch(withModel)
      // stdout 은 JSON 전용 — leader 가 .tasks 를 wave-codegen workflow args 로 직결.
      console.log(JSON.stringify({ wave_index, tasks: dispatch }, null, 2))
    })

  wave
    .command('validate-disjoint')
    .description('wave 안 task 들의 output_artifacts pairwise intersection 검증 (충돌 시 exit 1)')
    .requiredOption('--tasks <ids>', '쉼표 분리 task client_id 들 (예: T-001,T-002)')
    .requiredOption('--phase <phaseSlug>', 'phase_slug')
    .action(async (opts: { tasks: string; phase: string }) => {
      assertValidPhaseSlug(opts.phase)
      const clientIds = opts.tasks.split(',').map((s) => s.trim()).filter(Boolean)
      for (const id of clientIds) {
        assertValidTaskClientId(id)
      }
      const allTasks = await fetchPhaseTasks(opts.phase)
      const targetTasks = allTasks.filter((t) => clientIds.includes(t.client_id))
      const result = validateDisjoint({ tasks: targetTasks })
      console.log(JSON.stringify(result, null, 2))
      if (!result.ok) {
        process.exit(1)
      }
    })

  wave
    .command('merge')
    .description(
      'task branch 들의 commits 을 group branch (feat/<group>-group) 로 cherry-pick (task_client_id 순). ' +
        '--group 생략 시 --phase 의 plan state 로 group 자동 분류 — leader 가 group 별 셸 루프를 짜지 않게 한다 (zsh 단어 분리 면역).',
    )
    .option('--group <groupKey>', 'group_key (단일 group 모드). 생략 시 --phase 필수 — wave 전체 task 를 group 자동 분류')
    .option('--phase <slug>', 'group 자동 분류 모드의 plan state 조회용 phase_slug')
    .requiredOption('--tasks <ids>', '쉼표 분리 task client_id 들 (단일 group 또는 wave 전체)')
    .action(async (opts: { group?: string; phase?: string; tasks: string }) => {
      const taskClientIds = opts.tasks.split(',').map((s) => s.trim()).filter(Boolean)
      for (const id of taskClientIds) {
        assertValidTaskClientId(id)
      }

      // 단일 group 모드 (기존 흐름 — 하위호환)
      if (opts.group) {
        assertValidGroupKey(opts.group)
        try {
          const result = await mergeWave({ groupKey: opts.group, taskClientIds })
          console.log(JSON.stringify(result, null, 2))
        } catch (e) {
          console.error('✗', e instanceof Error ? e.message : String(e))
          process.exit(1)
        }
        return
      }

      // group 자동 분류 모드 — cli 가 wave 전체 task 를 group_key 별로 나눠 순차 cherry-pick.
      // leader 가 `for g in $groups; do tokb wave merge --group $g ...` 셸 루프(zsh 단어 분리로 깨짐)를 짤 필요 없음.
      if (!opts.phase) {
        console.error('✗ --group 생략 시 --phase 필수 (group 자동 분류용)')
        process.exit(1)
      }
      assertValidPhaseSlug(opts.phase)
      try {
        const phaseTasks = await fetchPhaseTasks(opts.phase)
        const picked = taskClientIds.map((id) => {
          const t = phaseTasks.find((pt) => pt.client_id === id)
          if (!t) throw new Error(`task ${id} 가 phase ${opts.phase} 의 plan state 에 없음`)
          return { client_id: id, group_key: t.group_key }
        })
        const groups = partitionByGroup(picked)
        for (const g of groups) {
          assertValidGroupKey(g.groupKey)
        }
        const results: Array<{ group: string } & Awaited<ReturnType<typeof mergeWave>>> = []
        for (const g of groups) {
          const result = await mergeWave({ groupKey: g.groupKey, taskClientIds: g.taskClientIds })
          results.push({ group: g.groupKey, ...result })
        }
        console.log(JSON.stringify(results, null, 2))
      } catch (e) {
        console.error('✗', e instanceof Error ? e.message : String(e))
        process.exit(1)
      }
    })
}
