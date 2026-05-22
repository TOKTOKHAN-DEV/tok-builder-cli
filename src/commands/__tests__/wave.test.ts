import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { computeNextWave, validateDisjoint, mergeWave, type WaveTask } from '../wave'

const baseTask: Omit<WaveTask, 'client_id' | 'status' | 'depends_on_client_ids' | 'output_artifacts'> = {
  id: 'uuid-x',
  phase_slug: 'core-impl',
  group_key: 'auth',
  description: '',
  acceptance_criteria: '',
  test_file_path: null,
}

describe('computeNextWave', () => {
  it('빈 task list — 빈 wave 반환', () => {
    const result = computeNextWave({ tasks: [], groupKey: 'auth', phaseSlug: 'core-impl' })
    expect(result.tasks).toEqual([])
  })

  it('모든 task done — 빈 wave 반환', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'done', depends_on_client_ids: [], output_artifacts: [] },
      { ...baseTask, client_id: 'T-002', status: 'done', depends_on_client_ids: [], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, groupKey: 'auth', phaseSlug: 'core-impl' })
    expect(result.tasks).toEqual([])
  })

  it('depends_on 0 인 task 들이 wave 1', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'b.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-003', status: 'pending', depends_on_client_ids: ['T-001'], output_artifacts: [{ path: 'c.ts', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, groupKey: 'auth', phaseSlug: 'core-impl' })
    const ids = result.tasks.map((t) => t.client_id).sort()
    expect(ids).toEqual(['T-001', 'T-002'])
  })

  it('wave 1 모두 done — wave 2 는 의존성 만족 task', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'done', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-002', status: 'done', depends_on_client_ids: [], output_artifacts: [{ path: 'b.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-003', status: 'pending', depends_on_client_ids: ['T-001'], output_artifacts: [{ path: 'c.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-004', status: 'pending', depends_on_client_ids: ['T-001', 'T-002'], output_artifacts: [{ path: 'd.ts', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, groupKey: 'auth', phaseSlug: 'core-impl' })
    const ids = result.tasks.map((t) => t.client_id).sort()
    expect(ids).toEqual(['T-003', 'T-004'])
  })

  it('group_key 필터 — 다른 group 의 task 무시', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', group_key: 'auth', status: 'pending', depends_on_client_ids: [], output_artifacts: [] },
      { ...baseTask, client_id: 'T-002', group_key: 'vehicle', status: 'pending', depends_on_client_ids: [], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, groupKey: 'auth', phaseSlug: 'core-impl' })
    expect(result.tasks.map((t) => t.client_id)).toEqual(['T-001'])
  })

  it('blocked task 는 wave 후보 X (pending 만)', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'blocked', depends_on_client_ids: [], output_artifacts: [] },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, groupKey: 'auth', phaseSlug: 'core-impl' })
    expect(result.tasks.map((t) => t.client_id)).toEqual(['T-002'])
  })

  it('순환 의존성 — 빈 wave 반환 + 안전 종료', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: ['T-002'], output_artifacts: [] },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: ['T-001'], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, groupKey: 'auth', phaseSlug: 'core-impl' })
    expect(result.tasks).toEqual([])
  })

  it('빈 wave (모두 done) — wave_index = -1', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'done', depends_on_client_ids: [], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, groupKey: 'auth', phaseSlug: 'core-impl' })
    expect(result.wave_index).toBe(-1)
  })

  it('candidates 존재 — wave_index 양수', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, groupKey: 'auth', phaseSlug: 'core-impl' })
    expect(result.wave_index).toBeGreaterThan(0)
  })
})

describe('validateDisjoint', () => {
  it('빈 task list — ok', () => {
    const result = validateDisjoint({ tasks: [] })
    expect(result.ok).toBe(true)
    expect(result.conflicts).toEqual([])
  })

  it('1 task — ok (intersection 불가능)', () => {
    const result = validateDisjoint({
      tasks: [{ ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] }],
    })
    expect(result.ok).toBe(true)
  })

  it('2 task disjoint — ok', () => {
    const result = validateDisjoint({
      tasks: [
        { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }, { path: 'b.ts', kind: 'code' }] },
        { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'c.ts', kind: 'code' }] },
      ],
    })
    expect(result.ok).toBe(true)
  })

  it('2 task intersection — conflict 보고', () => {
    const result = validateDisjoint({
      tasks: [
        { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }, { path: 'b.ts', kind: 'code' }] },
        { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'b.ts', kind: 'code' }, { path: 'c.ts', kind: 'code' }] },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([{ tasks: ['T-001', 'T-002'], files: ['b.ts'] }])
  })

  it('3 task 다중 pair 충돌 — 모두 보고', () => {
    const result = validateDisjoint({
      tasks: [
        { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
        { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }, { path: 'b.ts', kind: 'code' }] },
        { ...baseTask, client_id: 'T-003', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'b.ts', kind: 'code' }] },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.conflicts).toHaveLength(2)
    expect(result.conflicts).toContainEqual({ tasks: ['T-001', 'T-002'], files: ['a.ts'] })
    expect(result.conflicts).toContainEqual({ tasks: ['T-002', 'T-003'], files: ['b.ts'] })
  })

  it('output_artifacts null / undefined task — 빈 set 으로 처리 (충돌 0)', () => {
    const result = validateDisjoint({
      tasks: [
        { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: null },
        { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
      ],
    })
    expect(result.ok).toBe(true)
  })
})

function initBareRepoWithBranches(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'tokb-wave-merge-test-'))
  execSync('git init -q -b main', { cwd: dir })
  execSync('git config user.email test@x.com', { cwd: dir })
  execSync('git config user.name test', { cwd: dir })
  // main 의 init commit
  writeFileSync(path.join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir })
  execSync('git commit -m init -q', { cwd: dir })
  // feat/<gk>-group (group branch, base) 생성. 본 test 에선 group_key=auth.
  execSync('git checkout -b feat/auth-group -q', { cwd: dir })
  execSync('git checkout main -q', { cwd: dir })
  return dir
}

function commitTaskWork(repo: string, branchName: string, files: { path: string; content: string }[], message: string): string {
  execSync(`git checkout ${branchName} -q`, { cwd: repo })
  for (const f of files) {
    const full = path.join(repo, f.path)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, f.content)
  }
  execSync('git add -A', { cwd: repo })
  execSync(`git commit -m "${message}" -q`, { cwd: repo })
  return execSync('git rev-parse HEAD', { cwd: repo }).toString().trim()
}

describe('mergeWave', () => {
  it('빈 task list — no-op + merged_commits=0', async () => {
    const repo = initBareRepoWithBranches()
    try {
      const result = await mergeWave({ groupKey: 'auth', taskClientIds: [], cwd: repo })
      expect(result.merged_commits).toBe(0)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('disjoint 한 2 task — cherry-pick 성공', async () => {
    const repo = initBareRepoWithBranches()
    try {
      // feat/auth/T-001 — file a.ts 박음 (base feat/auth-group)
      execSync('git checkout -b feat/auth/T-001 feat/auth-group -q', { cwd: repo })
      commitTaskWork(repo, 'feat/auth/T-001', [{ path: 'a.ts', content: 'a' }], 'feat(T-001)')

      // feat/auth/T-002 — file b.ts 박음
      execSync('git checkout -b feat/auth/T-002 feat/auth-group -q', { cwd: repo })
      commitTaskWork(repo, 'feat/auth/T-002', [{ path: 'b.ts', content: 'b' }], 'feat(T-002)')

      // feat/auth-group 로 cherry-pick
      const result = await mergeWave({
        groupKey: 'auth',
        taskClientIds: ['T-001', 'T-002'],
        cwd: repo,
      })

      expect(result.merged_commits).toBe(2)

      // feat/auth-group 에 a.ts + b.ts 둘 다 있어야 함
      execSync('git checkout feat/auth-group -q', { cwd: repo })
      expect(existsSync(path.join(repo, 'a.ts'))).toBe(true)
      expect(existsSync(path.join(repo, 'b.ts'))).toBe(true)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('cherry-pick 충돌 — abort + throw + 명확한 보고', async () => {
    const repo = initBareRepoWithBranches()
    try {
      // 두 task 가 같은 file 변경 (충돌 시나리오 — validate-disjoint 누락 케이스)
      execSync('git checkout -b feat/auth/T-001 feat/auth-group -q', { cwd: repo })
      commitTaskWork(repo, 'feat/auth/T-001', [{ path: 'shared.ts', content: 'A version\n' }], 'feat(T-001)')

      execSync('git checkout -b feat/auth/T-002 feat/auth-group -q', { cwd: repo })
      commitTaskWork(repo, 'feat/auth/T-002', [{ path: 'shared.ts', content: 'B version\n' }], 'feat(T-002)')

      await expect(
        mergeWave({ groupKey: 'auth', taskClientIds: ['T-001', 'T-002'], cwd: repo })
      ).rejects.toThrow(/cherry-pick conflict|충돌/)

      // cherry-pick state 정리됐는지 (abort 됐는지) — feat/auth-group 의 HEAD 가 cherry-pick 중 아니어야 함
      const status = execSync('git status', { cwd: repo }).toString()
      expect(status).not.toMatch(/cherry-pick in progress/i)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})
