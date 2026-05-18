import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { worktreeCreate, worktreeCleanup } from '../worktree'

function initRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'tokb-worktree-test-'))
  execSync('git init -q', { cwd: dir })
  execSync('git config user.email test@x.com', { cwd: dir })
  execSync('git config user.name test', { cwd: dir })
  execSync('git commit --allow-empty -m init -q', { cwd: dir })
  return dir
}

describe('tokb worktree create', () => {
  let repo: string
  beforeEach(() => {
    repo = initRepo()
  })
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('group_key 별 worktree 를 .tokb/worktrees/<group_key>/ 에 생성 + feat/<group_key> branch', async () => {
    const result = await worktreeCreate({ groupKey: 'auth', cwd: repo })
    expect(result.path).toBe(path.join(repo, '.tokb', 'worktrees', 'auth'))
    expect(result.branch).toBe('feat/auth')
    expect(existsSync(result.path)).toBe(true)
    const branches = execSync('git branch', { cwd: repo }).toString()
    expect(branches).toContain('feat/auth')
  })

  it('이미 존재하는 worktree 는 idempotent (재호출 OK)', async () => {
    await worktreeCreate({ groupKey: 'users', cwd: repo })
    const result2 = await worktreeCreate({ groupKey: 'users', cwd: repo })
    expect(result2.path).toBe(path.join(repo, '.tokb', 'worktrees', 'users'))
    expect(result2.branch).toBe('feat/users')
  })
})

describe('tokb worktree cleanup', () => {
  let repo: string
  beforeEach(() => {
    repo = initRepo()
  })
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('worktree 제거 (branch 는 유지 — PR 머지 후 main 에 squash)', async () => {
    await worktreeCreate({ groupKey: 'chat', cwd: repo })
    await worktreeCleanup({ groupKey: 'chat', cwd: repo })
    expect(existsSync(path.join(repo, '.tokb', 'worktrees', 'chat'))).toBe(false)
  })

  it('존재하지 않는 worktree cleanup 시 idempotent (조용히 통과)', async () => {
    await expect(worktreeCleanup({ groupKey: 'nonexistent', cwd: repo })).resolves.toBeUndefined()
  })
})
