import { Command } from 'commander'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { assertValidGroupKey } from '../lib/group-key.js'
import { assertValidTaskClientId } from '../lib/task-key.js'

// group(상위) worktree 의 절대경로. merge/push 는 이 worktree 안에서 실행해야
// group branch(feat/<gk>-group) 점유 충돌 없이 동작한다 (leader 메인트리 checkout X).
// wave merge / group complete 가 공유한다.
export function groupWorktreePath(cwd: string, groupKey: string): string {
  return path.join(cwd, '.tokb', 'worktrees', groupKey)
}

export interface WorktreeCreateOpts {
  groupKey: string
  cwd?: string
}

export interface WorktreeCreateResult {
  path: string
  branch: string
}

export async function worktreeCreate(opts: WorktreeCreateOpts): Promise<WorktreeCreateResult> {
  assertValidGroupKey(opts.groupKey)
  const cwd = opts.cwd ?? process.cwd()
  const branch = `feat/${opts.groupKey}-group`
  const wtPath = path.join(cwd, '.tokb', 'worktrees', opts.groupKey)
  if (existsSync(wtPath)) {
    return { path: wtPath, branch }
  }
  mkdirSync(path.dirname(wtPath), { recursive: true })

  // branch 이미 존재 시 (옛 cleanup 했지만 branch 안 지움) — branch 사용 + worktree add (without -b)
  let branchExists = false
  try {
    execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd, stdio: 'pipe' })
    branchExists = true
  } catch {
    // branch 없음 — -b 옵션으로 새로 생성
  }

  if (branchExists) {
    execFileSync('git', ['worktree', 'add', wtPath, branch], { cwd, stdio: 'pipe' })
  } else {
    execFileSync('git', ['worktree', 'add', '-b', branch, wtPath], { cwd, stdio: 'pipe' })
  }
  return { path: wtPath, branch }
}

export interface WorktreeCleanupOpts {
  groupKey: string
  cwd?: string
}

export interface WorktreeCleanupResult {
  removedWorktrees: string[]
  removedBranches: string[]
  failures: string[] // 못 지운 worktree/branch — 누수 가시화 (silent skip 금지)
}

// 에러 메시지를 한 줄로 정리 (개행/탭/ANSI 제거) — 보고 가독성.
function cleanErr(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\r\n\t\x1b]/g, ' ').trim()
}

/**
 * group 의 worktree + branch 를 정리한다 (group complete 머지 후 호출 전제).
 * 누수 방지가 핵심: 실패를 silent skip 하지 않고 failures 에 모아 호출측이 보고하게 한다.
 *
 * 순서:
 *   0) git worktree prune — 디렉토리만 지워진 stale worktree 메타 정리
 *   1) <gk> + <gk>__* worktree 전부 remove (점유 해제)
 *   2) prune 재실행
 *   3) task branch feat/<gk>/* + group branch feat/<gk>-group 삭제 (worktree 해제 후라 -D 가능)
 */
export async function worktreeCleanup(opts: WorktreeCleanupOpts): Promise<WorktreeCleanupResult> {
  assertValidGroupKey(opts.groupKey)
  const cwd = opts.cwd ?? process.cwd()
  const gk = opts.groupKey
  const worktreesDir = path.join(cwd, '.tokb', 'worktrees')
  const removedWorktrees: string[] = []
  const removedBranches: string[] = []
  const failures: string[] = []

  const prune = () => {
    try {
      execFileSync('git', ['worktree', 'prune'], { cwd, stdio: 'pipe' })
    } catch {
      // prune 실패는 치명 아님
    }
  }

  // 0) stale worktree 메타 정리
  prune()

  // 1) 이 group 의 worktree 전부 remove. 실패는 failures 에 기록 (삼키지 않음).
  if (existsSync(worktreesDir)) {
    for (const entry of readdirSync(worktreesDir)) {
      if (entry !== gk && !entry.startsWith(`${gk}__`)) continue
      const wtPath = path.join(worktreesDir, entry)
      try {
        execFileSync('git', ['worktree', 'remove', '--force', wtPath], { cwd, stdio: 'pipe' })
        removedWorktrees.push(entry)
      } catch (e) {
        failures.push(`worktree ${entry}: ${cleanErr(e)}`)
      }
    }
  }

  // 2) remove 후 메타 재정리
  prune()

  // 3) branch 삭제 — worktree 점유 해제 후라 -D 가능. 실패는 failures 에 기록.
  const deleteBranch = (branch: string) => {
    try {
      execFileSync('git', ['branch', '-D', branch], { cwd, stdio: 'pipe' })
      removedBranches.push(branch)
    } catch (e) {
      failures.push(`branch ${branch}: ${cleanErr(e)}`)
    }
  }

  // task branch feat/<gk>/*
  try {
    const out = execFileSync(
      'git',
      ['for-each-ref', '--format=%(refname:short)', `refs/heads/feat/${gk}/`],
      { cwd, stdio: 'pipe' },
    ).toString()
    for (const branch of out.split('\n').filter(Boolean)) {
      deleteBranch(branch)
    }
  } catch {
    // 해당 prefix task branch 0 — skip
  }

  // group branch feat/<gk>-group — 머지 후 로컬 정리 책임을 cleanup 으로 일원화 (로컬 leak 방지).
  const groupBranch = `feat/${gk}-group`
  try {
    execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${groupBranch}`], {
      cwd,
      stdio: 'pipe',
    })
    deleteBranch(groupBranch)
  } catch {
    // group branch 없음 — 이미 정리됨 (idempotent)
  }

  return { removedWorktrees, removedBranches, failures }
}

export interface WorktreeCreateTaskOpts {
  groupKey: string
  taskClientId: string
  cwd?: string
}

export interface WorktreeCreateTaskResult {
  path: string
  branch: string
}

export async function worktreeCreateTask(
  opts: WorktreeCreateTaskOpts,
): Promise<WorktreeCreateTaskResult> {
  assertValidGroupKey(opts.groupKey)
  assertValidTaskClientId(opts.taskClientId)
  const cwd = opts.cwd ?? process.cwd()
  const baseBranch = `feat/${opts.groupKey}-group`
  const branch = `feat/${opts.groupKey}/${opts.taskClientId}`
  const wtPath = path.join(cwd, '.tokb', 'worktrees', `${opts.groupKey}__${opts.taskClientId}`)

  if (existsSync(wtPath)) {
    return { path: wtPath, branch }
  }

  // base branch (feat/<groupKey>-group) 존재 검증
  try {
    execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${baseBranch}`], {
      cwd,
      stdio: 'pipe',
    })
  } catch {
    throw new Error(
      `base branch ${baseBranch} 부재. tokb worktree create ${opts.groupKey} 를 먼저 실행하세요.`,
    )
  }

  mkdirSync(path.dirname(wtPath), { recursive: true })

  // task branch 가 이미 존재 시 (옛 cleanup-task 후 cleanup 안 됨) — -b 없이 worktree add
  let branchExists = false
  try {
    execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
      cwd,
      stdio: 'pipe',
    })
    branchExists = true
  } catch {
    // branch 없음 — -b 로 새 branch from base
  }

  if (branchExists) {
    execFileSync('git', ['worktree', 'add', wtPath, branch], { cwd, stdio: 'pipe' })
  } else {
    execFileSync('git', ['worktree', 'add', '-b', branch, wtPath, baseBranch], {
      cwd,
      stdio: 'pipe',
    })
  }

  return { path: wtPath, branch }
}

export interface WorktreeCleanupTaskOpts {
  groupKey: string
  taskClientId: string
  cwd?: string
}

export async function worktreeCleanupTask(opts: WorktreeCleanupTaskOpts): Promise<void> {
  assertValidGroupKey(opts.groupKey)
  assertValidTaskClientId(opts.taskClientId)
  const cwd = opts.cwd ?? process.cwd()
  const wtPath = path.join(cwd, '.tokb', 'worktrees', `${opts.groupKey}__${opts.taskClientId}`)
  if (!existsSync(wtPath)) return
  execFileSync('git', ['worktree', 'remove', '--force', wtPath], { cwd, stdio: 'pipe' })
}

export function worktreeCommand(program: Command): void {
  const wt = program.command('worktree').description('group 별 git worktree 관리')

  wt.command('create <groupKey>')
    .description('group_key 별 worktree 생성 (.tokb/worktrees/<group_key>/ + feat/<group_key>-group branch)')
    .action(async (groupKey: string) => {
      const result = await worktreeCreate({ groupKey })
      console.log(`✓ worktree 생성: ${result.path}`)
      console.log(`  branch: ${result.branch}`)
      // group worktree 에서 group complete 시 push → pre-push hook(typecheck+test)이 돈다.
      // 그 검증에 node_modules 가 필요하므로 여기서 install. pnpm store hardlink 라 경미.
      try {
        execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: result.path, stdio: 'inherit' })
        console.log('  ✓ deps install 완료')
      } catch (e) {
        console.error(
          `  ⚠️ pnpm install 실패 — group push 시 pre-push hook 이 깨질 수 있음: ${
            e instanceof Error ? e.message : String(e)
          }`,
        )
      }
    })

  wt.command('cleanup <groupKey>')
    .description('group_key 의 worktree + branch 정리 (PR 머지 후). 못 지운 건 보고 — 누수 차단')
    .action(async (groupKey: string) => {
      const r = await worktreeCleanup({ groupKey })
      console.log(
        `✓ cleanup: worktree ${r.removedWorktrees.length} 개 + branch ${r.removedBranches.length} 개 제거`,
      )
      if (r.failures.length > 0) {
        console.error(`⚠️ 정리 실패 ${r.failures.length} 건 (누수 가능 — 수동 확인 필요):`)
        for (const f of r.failures) console.error(`  - ${f}`)
        process.exit(1)
      }
    })

  wt.command('create-task <groupKey> <taskClientId>')
    .description('group 의 task 단위 worktree 생성 (.tokb/worktrees/<group_key>__<task_client_id>/ + feat/<group_key>/<task_client_id> branch, base: feat/<group_key>-group)')
    .action(async (groupKey: string, taskClientId: string) => {
      const result = await worktreeCreateTask({ groupKey, taskClientId })
      console.log(`✓ task worktree 생성: ${result.path}`)
      console.log(`  branch: ${result.branch}`)
    })

  wt.command('cleanup-task <groupKey> <taskClientId>')
    .description('task 단위 worktree 만 제거 (task branch 는 group cleanup 시 일괄 삭제)')
    .action(async (groupKey: string, taskClientId: string) => {
      await worktreeCleanupTask({ groupKey, taskClientId })
      console.log(`✓ task worktree 제거: .tokb/worktrees/${groupKey}__${taskClientId}/`)
    })
}
