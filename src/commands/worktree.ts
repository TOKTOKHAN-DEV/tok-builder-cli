import { Command } from 'commander'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export interface WorktreeCreateOpts {
  groupKey: string
  cwd?: string
}

export interface WorktreeCreateResult {
  path: string
  branch: string
}

export async function worktreeCreate(opts: WorktreeCreateOpts): Promise<WorktreeCreateResult> {
  const cwd = opts.cwd ?? process.cwd()
  const branch = `feat/${opts.groupKey}`
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

export async function worktreeCleanup(opts: WorktreeCleanupOpts): Promise<void> {
  const cwd = opts.cwd ?? process.cwd()
  const wtPath = path.join(cwd, '.tokb', 'worktrees', opts.groupKey)
  if (!existsSync(wtPath)) return
  execFileSync('git', ['worktree', 'remove', '--force', wtPath], { cwd, stdio: 'pipe' })
}

export function worktreeCommand(program: Command): void {
  const wt = program.command('worktree').description('group 별 git worktree 관리')

  wt.command('create <groupKey>')
    .description('group_key 별 worktree 생성 (.tokb/worktrees/<group_key>/ + feat/<group_key> branch)')
    .action(async (groupKey: string) => {
      const result = await worktreeCreate({ groupKey })
      console.log(`✓ worktree 생성: ${result.path}`)
      console.log(`  branch: ${result.branch}`)
    })

  wt.command('cleanup <groupKey>')
    .description('group_key 의 worktree 제거 (PR 머지 후)')
    .action(async (groupKey: string) => {
      await worktreeCleanup({ groupKey })
      console.log(`✓ worktree 제거: .tokb/worktrees/${groupKey}/`)
    })
}
