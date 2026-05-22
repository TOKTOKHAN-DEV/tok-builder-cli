import { describe, it, expect } from 'vitest'
import { computeNextWave, type WaveTask } from '../wave'

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
})
