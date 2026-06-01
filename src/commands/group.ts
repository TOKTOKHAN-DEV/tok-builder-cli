import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { Command, Option } from 'commander'
import { getProjectState } from '../lib/api.js'
import { requireField } from '../lib/config.js'
import { assertValidGroupKey } from '../lib/group-key.js'
import { groupWorktreePath } from './worktree.js'

export type ReviewVerdict = 'pass' | 'issues'

export interface ReviewRecord {
  groupKey: string
  simplify: ReviewVerdict
  security: ReviewVerdict
  reviewed_at: string
}

/**
 * group complete 의 review 게이트 — simplify + security review 가 둘 다 pass 여야 PR 생성/머지로 진행.
 * 기록 없음(null) 또는 한쪽이라도 issues → 차단. issues 는 수정 후 `tokb group review` 재기록 필요.
 * review 를 빌드 시스템에 강제해 개인 글로벌 룰에 의존하지 않게 한다 — 다른 사람/빌드 머신에서도 동일 작동.
 */
export function reviewGate(record: ReviewRecord | null): { ok: boolean; reason?: string } {
  if (!record) {
    return {
      ok: false,
      reason: 'review 기록 없음 — `tokb group review <gk>` 로 simplify + security review 결과를 먼저 기록하세요.',
    }
  }
  if (record.simplify !== 'pass' || record.security !== 'pass') {
    return {
      ok: false,
      reason: `review 미통과 (simplify=${record.simplify}, security=${record.security}) — 이슈 수정 후 \`tokb group review\` 로 재기록하세요.`,
    }
  }
  return { ok: true }
}

export function reviewRecordPath(cwd: string, groupKey: string): string {
  return path.join(cwd, '.tokb', 'reviews', `${groupKey}.json`)
}

function readReviewRecord(cwd: string, groupKey: string): ReviewRecord | null {
  const p = reviewRecordPath(cwd, groupKey)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as ReviewRecord
  } catch {
    return null
  }
}

function writeReviewRecord(cwd: string, record: ReviewRecord): void {
  const p = reviewRecordPath(cwd, record.groupKey)
  mkdirSync(path.dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(record, null, 2))
}

export function filterGroupTasks<
  T extends { group_key: string | null; phase_slug: string },
>(tasks: T[], groupKey: string, phaseSlug?: string): T[] {
  return tasks.filter((t) => {
    if (t.group_key !== groupKey) return false;
    if (phaseSlug !== undefined && t.phase_slug !== phaseSlug) return false;
    return true;
  });
}

export function groupCommand(program: Command): void {
  const group = program.command('group').description('group 단위 진행 관리')

  group
    .command('status <groupKey>')
    .description('group 의 모든 task 진행 상태 출력')
    .option('--phase <slug>', '특정 phase 로 범위 제한')
    .action(async (groupKey: string, opts: { phase?: string }) => {
      assertValidGroupKey(groupKey)
      const projectId = await requireField('project_id')
      const state = await getProjectState(projectId)
      const groupTasks = filterGroupTasks(state.tasks, groupKey, opts.phase)

      if (groupTasks.length === 0) {
        console.log(`group '${groupKey}' 의 task 없음`)
        return
      }

      const doneCnt = groupTasks.filter((t) => t.status === 'done').length
      console.log(`group '${groupKey}': ${doneCnt}/${groupTasks.length} done`)
      for (const t of groupTasks) {
        console.log(`  [${t.status}] ${t.id} (domain: ${t.domain ?? '-'})`)
      }
    })

  group
    .command('review <groupKey>')
    .description(
      'group 의 simplify + security review 결과 기록 (group complete 의 머지 전 게이트). ' +
        '이슈 발견 시 수정 후 재기록. 둘 다 pass 여야 group complete 가 PR 생성/머지로 진행.',
    )
    .addOption(
      new Option('--simplify <verdict>', 'simplify review 결과').choices(['pass', 'issues']).makeOptionMandatory(),
    )
    .addOption(
      new Option('--security <verdict>', 'security review 결과').choices(['pass', 'issues']).makeOptionMandatory(),
    )
    .action(async (groupKey: string, opts: { simplify: ReviewVerdict; security: ReviewVerdict }) => {
      assertValidGroupKey(groupKey)
      const record: ReviewRecord = {
        groupKey,
        simplify: opts.simplify,
        security: opts.security,
        reviewed_at: new Date().toISOString(),
      }
      writeReviewRecord(process.cwd(), record)
      const gate = reviewGate(record)
      console.log(
        `✓ group '${groupKey}' review 기록 (simplify=${opts.simplify}, security=${opts.security})` +
          (gate.ok ? '' : ` — ⚠️ ${gate.reason}`),
      )
    })

  group
    .command('complete <groupKey>')
    .description('group 모든 task done + review pass 시 PR 생성 trigger')
    .option('--dry-run', '실 실행 없이 조건 확인만')
    .option('--phase <slug>', '특정 phase 로 범위 제한')
    .action(async (groupKey: string, opts: { dryRun?: boolean; phase?: string }) => {
      assertValidGroupKey(groupKey)
      const projectId = await requireField('project_id')
      const state = await getProjectState(projectId)
      const groupTasks = filterGroupTasks(state.tasks, groupKey, opts.phase)

      if (groupTasks.length === 0) {
        console.error(`group '${groupKey}' 의 task 없음`)
        process.exit(1)
      }

      const notDone = groupTasks.filter((t) => t.status !== 'done')
      if (notDone.length > 0) {
        console.error(`group '${groupKey}' 미완료 task ${notDone.length} 개:`)
        for (const t of notDone) {
          console.error(`  [${t.status}] ${t.id}`)
        }
        process.exit(1)
      }

      console.log(`group '${groupKey}' 모든 task done. PR 생성 진입.`)

      if (opts.dryRun) {
        console.log('--dry-run: 실 PR 생성 skip')
        return
      }

      // review 게이트 — simplify + security review 가 둘 다 pass 여야 PR 생성/머지로 진행.
      // review 를 빌드 시스템에 강제 (개인 글로벌 룰 의존 X — 다른 사람/빌드 머신에서도 동일 작동).
      const gate = reviewGate(readReviewRecord(process.cwd(), groupKey))
      if (!gate.ok) {
        console.error(`group '${groupKey}' ${gate.reason}`)
        process.exit(1)
      }

      const branch = `feat/${groupKey}-group`

      // push/pr 은 group worktree 안에서 실행 — group branch HEAD 인 그 worktree 에서 push 해야
      // pre-push hook(typecheck+test)이 cherry-pick 된 통합 코드를 검사한다 (leader 메인트리는
      // main 상태라 그 트리에서 push 하면 엉뚱한 코드를 검사하게 됨).
      const wtCwd = groupWorktreePath(process.cwd(), groupKey)
      if (!existsSync(wtCwd)) {
        console.error(
          `group worktree 부재: ${wtCwd}. \`tokb worktree create ${groupKey}\` 를 먼저 실행하세요.`,
        )
        process.exit(1)
      }

      // 1) push (이미 push 된 경우 no-op)
      try {
        execFileSync('git', ['push', '-u', 'origin', branch], { cwd: wtCwd, stdio: 'inherit' })
      } catch (e) {
        console.error(`git push fail: ${e instanceof Error ? e.message : String(e)}`)
        process.exit(1)
      }

      // 2) gh pr create
      const title = `feat(${groupKey}): group complete`
      let prCreatedNow = false
      try {
        const out = execFileSync(
          'gh',
          [
            'pr',
            'create',
            '--base',
            'main',
            '--head',
            branch,
            '--title',
            title,
            '--body',
            `group '${groupKey}' 모든 task done. 자동 PR.`,
          ],
          { cwd: wtCwd, stdio: 'pipe' },
        )
        const url = out.toString().trim()
        console.log(`✓ PR 생성 완료 (group: ${groupKey})${url ? ` — ${url}` : ''}`)
        prCreatedNow = true
      } catch (e) {
        // stdio: 'pipe' 라 e.stderr 에 stderr 내용 박힘
        const stderr = (e as NodeJS.ErrnoException & { stderr?: Buffer }).stderr?.toString() ?? ''
        const msg = stderr || (e instanceof Error ? e.message : String(e))
        if (msg.includes('already exists')) {
          console.log(`PR already exists for ${branch} — skip`)
        } else {
          console.error(`gh pr create fail: ${msg}`)
          process.exit(1)
        }
      }

      // 3) gh pr merge --squash --delete-branch — 비개발자 친화 자동 머지 (PR 생성 직후만)
      // PR already exists 케이스에서는 사용자가 이미 봤거나 다른 흐름이라 자동 머지 안 함.
      if (prCreatedNow) {
        try {
          execFileSync(
            'gh',
            ['pr', 'merge', branch, '--squash', '--delete-branch'],
            { cwd: wtCwd, stdio: 'inherit' },
          )
          console.log(`✓ PR 자동 머지 완료 (squash, branch 삭제) — group: ${groupKey}`)
        } catch (e) {
          // 머지 실패 = PR 자체는 만들어져 있으니 사용자가 직접 처리 가능. exit X.
          const msg = e instanceof Error ? e.message : String(e)
          console.warn(`자동 머지 실패 (PR 자체는 생성됨, 수동 머지 필요): ${msg}`)
        }
      }
    })
}
