import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { computeNextWave, validateDisjoint, mergeWave, attachRecommendedModel, buildWaveDispatch, partitionByGroup, type WaveTask, type WaveTaskWithModel } from '../wave'

const baseTask: Omit<WaveTask, 'client_id' | 'status' | 'depends_on_client_ids' | 'output_artifacts'> = {
  id: 'uuid-x',
  phase_slug: 'backend',
  group_key: 'auth',
  description: '',
  acceptance_criteria: '',
  test_file_path: null,
}

describe('computeNextWave (phase-wide)', () => {
  it('빈 task list — 빈 wave 반환', () => {
    const result = computeNextWave({ tasks: [], phaseSlug: 'backend' })
    expect(result.tasks).toEqual([])
  })

  it('모든 task done — 빈 wave 반환', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'done', depends_on_client_ids: [], output_artifacts: [] },
      { ...baseTask, client_id: 'T-002', status: 'done', depends_on_client_ids: [], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    expect(result.tasks).toEqual([])
  })

  it('depends_on 0 인 task 들이 wave 1', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'b.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-003', status: 'pending', depends_on_client_ids: ['T-001'], output_artifacts: [{ path: 'c.ts', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
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
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    const ids = result.tasks.map((t) => t.client_id).sort()
    expect(ids).toEqual(['T-003', 'T-004'])
  })

  // 핵심 변경: group 경계를 넘어 phase 안 task 를 한 wave 로 병렬화.
  // group A(1 task) + group B(5 task) → 6개 task 가 한 wave 에서 동시 병렬.
  it('phase-wide — 서로 다른 group 의 task 도 같은 wave 로 (group A 1개 + group B 5개 = 6 병렬)', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', group_key: 'common', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'common.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-002', group_key: 'auth', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'auth1.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-003', group_key: 'auth', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'auth2.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-004', group_key: 'auth', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'auth3.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-005', group_key: 'auth', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'auth4.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-006', group_key: 'auth', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'auth5.ts', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    const ids = result.tasks.map((t) => t.client_id).sort()
    expect(ids).toEqual(['T-001', 'T-002', 'T-003', 'T-004', 'T-005', 'T-006'])
  })

  it('phase 필터 — 다른 phase 의 task 무시', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', phase_slug: 'backend', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-002', phase_slug: 'frontend', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'b.ts', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    expect(result.tasks.map((t) => t.client_id)).toEqual(['T-001'])
  })

  it('disjoint-aware — 파일 겹치는 task 는 같은 wave 에 안 넣고 다음 wave 로 미룸', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', group_key: 'auth', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'shared.ts', kind: 'code' }, { path: 'a.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-002', group_key: 'auth', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'shared.ts', kind: 'code' }, { path: 'b.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-003', group_key: 'vehicle', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'c.ts', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    // T-001 선택 → shared.ts 점유 → T-002 는 shared.ts 충돌로 이번 wave 제외. T-003 은 disjoint 라 포함.
    const ids = result.tasks.map((t) => t.client_id).sort()
    expect(ids).toEqual(['T-001', 'T-003'])
  })

  it('disjoint-aware — 디렉토리 경로(끝 /)는 겹쳐도 같은 wave 허용 (마이그레이션 식별자)', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', phase_slug: 'schema', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'supabase/migrations/', kind: 'code' }] },
      { ...baseTask, client_id: 'T-002', phase_slug: 'schema', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'supabase/migrations/', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'schema' })
    const ids = result.tasks.map((t) => t.client_id).sort()
    expect(ids).toEqual(['T-001', 'T-002'])
  })

  it('disjoint-aware — output_artifacts 빈/null task 여러 개는 모두 같은 wave (충돌 없음)', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [] },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: null },
      { ...baseTask, client_id: 'T-003', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    expect(result.tasks.map((t) => t.client_id).sort()).toEqual(['T-001', 'T-002', 'T-003'])
  })

  it('disjoint-aware — 비정규 경로(./a.ts vs a.ts)도 정규화 후 같은 파일로 충돌 처리', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: './a.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    // 정규화 후 같은 파일 → T-001 만 이번 wave, T-002 는 다음 wave
    expect(result.tasks.map((t) => t.client_id)).toEqual(['T-001'])
  })

  it('blocked task 는 wave 후보 X', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'blocked', depends_on_client_ids: [], output_artifacts: [] },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    expect(result.tasks.map((t) => t.client_id)).toEqual(['T-002'])
  })

  // 토큰 끊김 재개: worker 가 작업 중 끊기면 task 가 in_progress 로 남는데, wave start 시점
  // (= 이전 wave 완료 시점)의 in_progress 는 stale(끊긴 것)이므로 다음 wave 후보로 흡수해야
  // 누락 없이 재투입된다. pending 만 잡던 옛 동작은 in_progress task 를 영영 방치했다 (t-026 사고).
  it('in_progress task 는 wave 후보에 포함 (토큰 끊김 stale 재개)', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'in_progress', depends_on_client_ids: [], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'b.ts', kind: 'code' }] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    expect(result.tasks.map((t) => t.client_id).sort()).toEqual(['T-001', 'T-002'])
  })

  it('in_progress task 도 depends_on 이 done 이어야 후보 (pending 과 동일 의존성 규칙)', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'in_progress', depends_on_client_ids: ['T-009'], output_artifacts: [{ path: 'a.ts', kind: 'code' }] },
    ]
    // 의존 T-009 가 done 아님 → in_progress 라도 후보 제외
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    expect(result.tasks).toEqual([])
  })

  it('순환 의존성 — 빈 wave 반환 + 안전 종료', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: ['T-002'], output_artifacts: [] },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: ['T-001'], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    expect(result.tasks).toEqual([])
  })

  it('빈 wave (모두 done) — wave_index = -1', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'done', depends_on_client_ids: [], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    expect(result.wave_index).toBe(-1)
  })

  it('candidates 존재 — wave_index 양수', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [] },
    ]
    const result = computeNextWave({ tasks, phaseSlug: 'backend' })
    expect(result.wave_index).toBeGreaterThan(0)
  })
})

describe('attachRecommendedModel', () => {
  it('sub_step 매핑 — build_test/infra → haiku, functional/codegen → sonnet', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [], sub_step: 'build_test' },
      { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [], sub_step: 'codegen' },
    ]
    const out = attachRecommendedModel(tasks)
    expect(out.find((t) => t.client_id === 'T-001')?.recommended_model).toBe('haiku')
    expect(out.find((t) => t.client_id === 'T-002')?.recommended_model).toBe('sonnet')
  })

  it('sub_step 없음/이상값 → sonnet 폴백', () => {
    const tasks: WaveTask[] = [
      { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [] },
    ]
    expect(attachRecommendedModel(tasks)[0].recommended_model).toBe('sonnet')
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

  it('디렉토리 경로(끝 /)는 비교 제외 — 마이그레이션 task 끼리 충돌 아님 (D3)', () => {
    const result = validateDisjoint({
      tasks: [
        { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'supabase/migrations/', kind: 'code' }] },
        { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'supabase/migrations/', kind: 'code' }] },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.conflicts).toEqual([])
  })

  it('디렉토리(끝 /) 는 제외하되 같은 파일 path 는 여전히 충돌로 잡음', () => {
    const result = validateDisjoint({
      tasks: [
        { ...baseTask, client_id: 'T-001', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'supabase/migrations/', kind: 'code' }, { path: 'lib/x.ts', kind: 'code' }] },
        { ...baseTask, client_id: 'T-002', status: 'pending', depends_on_client_ids: [], output_artifacts: [{ path: 'supabase/migrations/', kind: 'code' }, { path: 'lib/x.ts', kind: 'code' }] },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.conflicts).toEqual([{ tasks: ['T-001', 'T-002'], files: ['lib/x.ts'] }])
  })
})

// 실제 흐름 반영: group branch 는 group worktree(.tokb/worktrees/auth)가 점유,
// task 작업은 task worktree(.tokb/worktrees/auth__<id>)에서. mergeWave 는 group worktree 에서 cherry-pick.
function initRepoWithGroupWorktree(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'tokb-wave-merge-test-'))
  execSync('git init -q -b main', { cwd: dir })
  execSync('git config user.email test@x.com', { cwd: dir })
  execSync('git config user.name test', { cwd: dir })
  writeFileSync(path.join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir })
  execSync('git commit -m init -q', { cwd: dir })
  // group branch 생성(메인트리는 main 유지) + group worktree 가 그 branch 점유
  execSync('git branch feat/auth-group', { cwd: dir })
  execSync('git worktree add .tokb/worktrees/auth feat/auth-group -q', { cwd: dir })
  return dir
}

// task worktree 에서 작업 + commit (실제 흐름: worker 가 task worktree 에서 작업)
function addTaskWithCommit(
  repo: string,
  taskId: string,
  files: { path: string; content: string }[],
  message: string,
): void {
  const wt = path.join(repo, '.tokb', 'worktrees', `auth__${taskId}`)
  execSync(`git worktree add -b feat/auth/${taskId} "${wt}" feat/auth-group -q`, { cwd: repo })
  for (const f of files) {
    const full = path.join(wt, f.path)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, f.content)
  }
  execSync('git add -A', { cwd: wt })
  execSync(`git commit -m "${message}" -q`, { cwd: wt })
}

describe('mergeWave', () => {
  it('빈 task list — no-op + merged_commits=0', async () => {
    const repo = initRepoWithGroupWorktree()
    try {
      const result = await mergeWave({ groupKey: 'auth', taskClientIds: [], cwd: repo })
      expect(result.merged_commits).toBe(0)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('group worktree 부재 시 throw (checkout 충돌 회피 — worktree 에서만 동작)', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'tokb-wave-merge-nowt-'))
    execSync('git init -q -b main', { cwd: dir })
    execSync('git config user.email test@x.com', { cwd: dir })
    execSync('git config user.name test', { cwd: dir })
    execSync('git commit --allow-empty -m init -q', { cwd: dir })
    try {
      await expect(
        mergeWave({ groupKey: 'auth', taskClientIds: ['T-001'], cwd: dir }),
      ).rejects.toThrow(/group worktree 부재/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('disjoint 한 2 task — group worktree 에서 cherry-pick 성공 (leader 메인트리 미점유)', async () => {
    const repo = initRepoWithGroupWorktree()
    try {
      addTaskWithCommit(repo, 'T-001', [{ path: 'a.ts', content: 'a' }], 'feat(T-001)')
      addTaskWithCommit(repo, 'T-002', [{ path: 'b.ts', content: 'b' }], 'feat(T-002)')

      const result = await mergeWave({ groupKey: 'auth', taskClientIds: ['T-001', 'T-002'], cwd: repo })
      expect(result.merged_commits).toBe(2)

      // group worktree 에 a.ts + b.ts 둘 다 cherry-pick 됨
      const gwt = path.join(repo, '.tokb', 'worktrees', 'auth')
      expect(existsSync(path.join(gwt, 'a.ts'))).toBe(true)
      expect(existsSync(path.join(gwt, 'b.ts'))).toBe(true)
      // 메인트리(main)는 안 건드림 — a.ts/b.ts 없음
      expect(existsSync(path.join(repo, 'a.ts'))).toBe(false)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('cherry-pick 충돌 — abort + throw + 명확한 보고', async () => {
    const repo = initRepoWithGroupWorktree()
    try {
      addTaskWithCommit(repo, 'T-001', [{ path: 'shared.ts', content: 'A version\n' }], 'feat(T-001)')
      addTaskWithCommit(repo, 'T-002', [{ path: 'shared.ts', content: 'B version\n' }], 'feat(T-002)')

      let err: Error | undefined
      try {
        await mergeWave({ groupKey: 'auth', taskClientIds: ['T-001', 'T-002'], cwd: repo })
      } catch (e) {
        err = e as Error
      }
      expect(err?.message).toMatch(/cherry-pick conflict|충돌/)
      // worktree-aware CHERRY_PICK_HEAD 검출 — 정상 abort 시 "git 상태 불일치" 오경고가 없어야 함
      expect(err?.message).not.toMatch(/git 상태 불일치/)

      // group worktree 에서 cherry-pick state 정리됐는지 (abort 됐는지)
      const gwt = path.join(repo, '.tokb', 'worktrees', 'auth')
      const status = execSync('git status', { cwd: gwt }).toString()
      expect(status).not.toMatch(/cherry-pick in progress/i)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})

// buildWaveDispatch 는 worktree(group + task)를 전부 TS 로 생성 → leader shell 루프(zsh 단어 분리) 제거.
function initPlainRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'tokb-wave-start-test-'))
  execSync('git init -q -b main', { cwd: dir })
  execSync('git config user.email test@x.com', { cwd: dir })
  execSync('git config user.name test', { cwd: dir })
  writeFileSync(path.join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir })
  execSync('git commit -m init -q', { cwd: dir })
  return dir
}

function modelTask(over: Partial<WaveTaskWithModel> & { client_id: string }): WaveTaskWithModel {
  return {
    id: `uuid-${over.client_id}`,
    phase_slug: 'schema',
    group_key: 'schema-auth',
    description: '',
    acceptance_criteria: '',
    test_file_path: null,
    status: 'pending',
    depends_on_client_ids: [],
    output_artifacts: [],
    recommended_model: 'sonnet',
    ...over,
  }
}

describe('buildWaveDispatch', () => {
  it('단일 group + 2 task — group worktree 1개(멱등) + task worktree 2개 생성, dispatch 반환', async () => {
    const repo = initPlainRepo()
    try {
      const tasks = [modelTask({ client_id: 't-001' }), modelTask({ client_id: 't-002' })]
      const dispatch = await buildWaveDispatch(tasks, { cwd: repo, install: false })

      // group worktree 1개 (두 task 가 같은 group_key — 두 번째 worktreeCreate 는 멱등 skip)
      expect(existsSync(path.join(repo, '.tokb', 'worktrees', 'schema-auth'))).toBe(true)
      // task worktree 2개 — 이름이 <gk>__<id> 로 정확 (zsh 뭉개짐 없음)
      expect(existsSync(path.join(repo, '.tokb', 'worktrees', 'schema-auth__t-001'))).toBe(true)
      expect(existsSync(path.join(repo, '.tokb', 'worktrees', 'schema-auth__t-002'))).toBe(true)

      expect(dispatch).toHaveLength(2)
      expect(dispatch[0]).toEqual({
        taskId: 'uuid-t-001',
        clientId: 't-001',
        groupKey: 'schema-auth',
        worktree: path.join(repo, '.tokb', 'worktrees', 'schema-auth__t-001'),
        model: 'sonnet',
      })
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('빈 task list — worktree 0개, dispatch 빈 배열', async () => {
    const repo = initPlainRepo()
    try {
      const dispatch = await buildWaveDispatch([], { cwd: repo, install: false })
      expect(dispatch).toEqual([])
      expect(existsSync(path.join(repo, '.tokb', 'worktrees'))).toBe(false)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('group_key 없는 task — throw (worktree 생성 전 차단)', async () => {
    const repo = initPlainRepo()
    try {
      const tasks = [modelTask({ client_id: 't-001', group_key: null })]
      await expect(buildWaveDispatch(tasks, { cwd: repo, install: false })).rejects.toThrow(
        /group_key 가 없어/,
      )
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  it('재호출 멱등 — 같은 wave 두 번 호출해도 에러 없이 같은 dispatch', async () => {
    const repo = initPlainRepo()
    try {
      const tasks = [modelTask({ client_id: 't-001' })]
      const first = await buildWaveDispatch(tasks, { cwd: repo, install: false })
      const second = await buildWaveDispatch(tasks, { cwd: repo, install: false })
      expect(second).toEqual(first)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})

// partitionByGroup: wave 전체 task 를 group_key 별로 분류 (leader 셸 루프 제거 — cli 가 분류).
// wave merge 가 group 자동 분류 모드에서 사용. 입력 순서 보존 (cherry-pick 은 task_client_id 순).
describe('partitionByGroup', () => {
  it('빈 입력 — 빈 배열', () => {
    expect(partitionByGroup([])).toEqual([])
  })

  it('단일 group 여러 task — 1 그룹, client_id 순서 보존', () => {
    const result = partitionByGroup([
      { client_id: 'T-001', group_key: 'auth' },
      { client_id: 'T-002', group_key: 'auth' },
    ])
    expect(result).toEqual([{ groupKey: 'auth', taskClientIds: ['T-001', 'T-002'] }])
  })

  it('여러 group 섞임 — group 별 분리, 각 group 의 client_id 순서·group 첫 등장 순서 보존', () => {
    const result = partitionByGroup([
      { client_id: 'T-001', group_key: 'auth' },
      { client_id: 'T-002', group_key: 'vehicle' },
      { client_id: 'T-003', group_key: 'auth' },
      { client_id: 'T-004', group_key: 'vehicle' },
    ])
    expect(result).toEqual([
      { groupKey: 'auth', taskClientIds: ['T-001', 'T-003'] },
      { groupKey: 'vehicle', taskClientIds: ['T-002', 'T-004'] },
    ])
  })

  it('group_key null — throw (분류 불가)', () => {
    expect(() =>
      partitionByGroup([{ client_id: 'T-001', group_key: null }]),
    ).toThrow(/group_key/)
  })
})
