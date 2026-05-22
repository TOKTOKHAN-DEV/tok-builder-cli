import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { worktreeCreate, worktreeCleanup, worktreeCreateTask, worktreeCleanupTask } from '../worktree'

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

  it('group_key 별 worktree 를 .tokb/worktrees/<group_key>/ 에 생성 + feat/<group_key>-group branch', async () => {
    const result = await worktreeCreate({ groupKey: 'auth', cwd: repo })
    expect(result.path).toBe(path.join(repo, '.tokb', 'worktrees', 'auth'))
    expect(result.branch).toBe('feat/auth-group')
    expect(existsSync(result.path)).toBe(true)
    const branches = execSync('git branch', { cwd: repo }).toString()
    expect(branches).toContain('feat/auth-group')
  })

  it('이미 존재하는 worktree 는 idempotent (재호출 OK)', async () => {
    await worktreeCreate({ groupKey: 'users', cwd: repo })
    const result2 = await worktreeCreate({ groupKey: 'users', cwd: repo })
    expect(result2.path).toBe(path.join(repo, '.tokb', 'worktrees', 'users'))
    expect(result2.branch).toBe('feat/users-group')
  })

  it('branch 는 존재하지만 worktree 는 없는 경우 (옛 cleanup 잔존) — -b 없이 worktree add 성공', async () => {
    // worktree 생성 후 cleanup (worktree 제거, branch 유지)
    await worktreeCreate({ groupKey: 'payments', cwd: repo })
    await worktreeCleanup({ groupKey: 'payments', cwd: repo })

    // branch 가 살아 있는지 확인
    const branches = execSync('git branch', { cwd: repo }).toString()
    expect(branches).toContain('feat/payments-group')

    // worktree 경로는 없어야 함
    const wtPath = path.join(repo, '.tokb', 'worktrees', 'payments')
    expect(existsSync(wtPath)).toBe(false)

    // 재생성 — -b 없이 기존 branch 로 worktree add 돼야 함
    const result = await worktreeCreate({ groupKey: 'payments', cwd: repo })
    expect(result.path).toBe(wtPath)
    expect(result.branch).toBe('feat/payments-group')
    expect(existsSync(wtPath)).toBe(true)
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

describe('tokb worktree create-task', () => {
  let repo: string
  beforeEach(() => {
    repo = initRepo()
  })
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('group worktree 가 사전 존재해야 함 (base branch feat/<gk>-group 가 있어야 task branch 가능)', async () => {
    await worktreeCreate({ groupKey: 'auth', cwd: repo })
    const result = await worktreeCreateTask({
      groupKey: 'auth',
      taskClientId: 'T-001',
      cwd: repo,
    })
    expect(result.path).toBe(path.join(repo, '.tokb', 'worktrees', 'auth__T-001'))
    expect(result.branch).toBe('feat/auth/T-001')
    expect(existsSync(result.path)).toBe(true)
    const branches = execSync('git branch', { cwd: repo }).toString()
    expect(branches).toContain('feat/auth/T-001')
  })

  it('group worktree 부재 시 throw (feat/<gk>-group base 없음)', async () => {
    await expect(worktreeCreateTask({
      groupKey: 'missing',
      taskClientId: 'T-001',
      cwd: repo,
    })).rejects.toThrow(/feat\/missing-group/)
  })

  it('이미 존재하는 task worktree — idempotent (재호출 OK)', async () => {
    await worktreeCreate({ groupKey: 'auth', cwd: repo })
    await worktreeCreateTask({ groupKey: 'auth', taskClientId: 'T-001', cwd: repo })
    const result2 = await worktreeCreateTask({
      groupKey: 'auth',
      taskClientId: 'T-001',
      cwd: repo,
    })
    expect(result2.path).toBe(path.join(repo, '.tokb', 'worktrees', 'auth__T-001'))
    expect(result2.branch).toBe('feat/auth/T-001')
  })
})

describe('tokb worktree cleanup (확장)', () => {
  let repo: string
  beforeEach(() => {
    repo = initRepo()
  })
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('확장 — task worktree N + task branch N 모두 일괄 제거 (Stage A)', async () => {
    await worktreeCreate({ groupKey: 'auth', cwd: repo })
    await worktreeCreateTask({ groupKey: 'auth', taskClientId: 'T-001', cwd: repo })
    await worktreeCreateTask({ groupKey: 'auth', taskClientId: 'T-002', cwd: repo })

    await worktreeCleanup({ groupKey: 'auth', cwd: repo })

    // group worktree + task worktree 모두 제거됨
    expect(existsSync(path.join(repo, '.tokb', 'worktrees', 'auth'))).toBe(false)
    expect(existsSync(path.join(repo, '.tokb', 'worktrees', 'auth__T-001'))).toBe(false)
    expect(existsSync(path.join(repo, '.tokb', 'worktrees', 'auth__T-002'))).toBe(false)

    // task branch 도 제거됨 (group branch feat/auth-group 는 PR 머지 후 자동 삭제)
    const branches = execSync('git branch', { cwd: repo }).toString()
    expect(branches).not.toContain('feat/auth/T-001')
    expect(branches).not.toContain('feat/auth/T-002')
  })
})

describe('tokb worktree cleanup-task', () => {
  let repo: string
  beforeEach(() => {
    repo = initRepo()
  })
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('task worktree 만 제거 (branch 보존)', async () => {
    await worktreeCreate({ groupKey: 'auth', cwd: repo })
    await worktreeCreateTask({ groupKey: 'auth', taskClientId: 'T-001', cwd: repo })
    await worktreeCleanupTask({ groupKey: 'auth', taskClientId: 'T-001', cwd: repo })

    expect(existsSync(path.join(repo, '.tokb', 'worktrees', 'auth__T-001'))).toBe(false)
    const branches = execSync('git branch', { cwd: repo }).toString()
    expect(branches).toContain('feat/auth/T-001') // branch 는 살아 있음
  })

  it('존재하지 않는 task worktree cleanup-task 시 idempotent', async () => {
    await expect(
      worktreeCleanupTask({ groupKey: 'auth', taskClientId: 'T-999', cwd: repo })
    ).resolves.toBeUndefined()
  })
})
