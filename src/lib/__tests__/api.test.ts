import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('../config.js', () => ({
  requireConfig: vi.fn(async () => ({
    push_token: 'tokb_apt_test',
    platform_base_url: 'https://example.com',
  })),
}))

import { pushTaskProgress, pushTaskArtifacts, getProjectState, getPlanState, pushCommit } from '../api.js'
import { TokbAuthError, TokbValidationError, TokbServerError } from '../errors.js'

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })),
    )
  })

  it('pushTaskProgress posts with bearer token + status body', async () => {
    await pushTaskProgress('task-1', 'in_progress', { note: 'starting' })
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api/agent/tasks/task-1/progress',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tokb_apt_test',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ status: 'in_progress', notes: 'starting' }),
      }),
    )
  })

  it('pushTaskProgress with commit_sha posts both fields', async () => {
    let capturedBody: unknown = null
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      capturedBody = JSON.parse(init.body)
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
    }))

    await pushTaskProgress('task-1', 'done', {
      note: 'OK',
      commitShaTest: 'abc',
      commitShaCode: 'def',
    })

    expect(capturedBody).toEqual({
      status: 'done',
      notes: 'OK',
      commit_sha_test: 'abc',
      commit_sha_code: 'def',
    })
  })

  it('pushTaskProgress without commit_sha still works (in_progress 등)', async () => {
    let capturedBody: unknown = null
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      capturedBody = JSON.parse(init.body)
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
    }))

    await pushTaskProgress('task-1', 'in_progress', { note: 'starting' })

    expect(capturedBody).toEqual({
      status: 'in_progress',
      notes: 'starting',
    })
  })

  it('pushTaskArtifacts posts artifacts array', async () => {
    await pushTaskArtifacts('task-1', [{ path: 'src/foo.ts', kind: 'code' }])
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api/agent/tasks/task-1/artifacts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ artifacts: [{ path: 'src/foo.ts', kind: 'code' }] }),
      }),
    )
  })

  it('getProjectState GETs with bearer token', async () => {
    await getProjectState('project-1')
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api/agent/projects/project-1/state',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tokb_apt_test' }),
      }),
    )
  })

  it('getPlanState calls GET state with phase query', async () => {
    const stub = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ phase: 'core-impl', current_phase: 'core-impl', groups: [] }),
      text: async () => '',
    }))
    vi.stubGlobal('fetch', stub)

    await getPlanState('plan-1', 'core-impl')

    expect(stub).toHaveBeenCalledWith(
      'https://example.com/api/agent/plans/plan-1/state?phase=core-impl',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tokb_apt_test' }),
      }),
    )
  })

  it('getPlanState without phase omits query param', async () => {
    const stub = vi.fn(async (..._args: unknown[]) => ({
      ok: true, status: 200,
      json: async () => ({ phase: 'design-spec', current_phase: 'design-spec', groups: [] }),
      text: async () => '',
    }))
    vi.stubGlobal('fetch', stub)

    await getPlanState('plan-1')

    const calledUrl = stub.mock.calls[0][0] as string
    expect(calledUrl).toBe('https://example.com/api/agent/plans/plan-1/state')
    expect(calledUrl).not.toContain('?phase=')
  })

  it('getPlanState returns groups array typed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({
        phase: 'core-impl',
        current_phase: 'core-impl',
        groups: [
          { parallel_group: 'auth', tasks: [{ id: 't1', client_id: 'c1', title: 'A', status: 'pending' }] },
        ],
      }),
      text: async () => '',
    })))

    const res = await getPlanState('plan-1', 'core-impl')
    expect(res.groups).toHaveLength(1)
    expect(res.groups[0].parallel_group).toBe('auth')
    expect(res.groups[0].tasks[0].id).toBe('t1')
  })

  it('throws TokbAuthError on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, text: async () => 'unauthorized' })),
    )
    await expect(pushTaskProgress('task-1', 'done')).rejects.toBeInstanceOf(TokbAuthError)
  })

  it('throws TokbValidationError on 422 with issues array', async () => {
    const issues = [{ field: 'x', message: 'bad' }]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ error: 'PlanValidationFailed', issues }),
      })),
    )
    try {
      await pushTaskProgress('task-1', 'done')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TokbValidationError)
      expect((err as TokbValidationError).issues).toEqual(issues)
    }
  })

  it('throws TokbServerError on 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, text: async () => 'internal' })),
    )
    try {
      await pushTaskProgress('task-1', 'done')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TokbServerError)
      expect((err as TokbServerError).status).toBe(500)
    }
  })

  it('pushCommit posts task_id / sha / committed_at / role', async () => {
    let capturedBody: unknown = null
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      capturedBody = JSON.parse(init.body)
      return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '' }
    }))

    await pushCommit('task-uuid', 'abc123', '2026-05-15T12:00:00Z', 'test')

    expect(capturedBody).toEqual({
      task_id: 'task-uuid',
      sha: 'abc123',
      committed_at: '2026-05-15T12:00:00Z',
      role: 'test',
    })
  })

  it('pushCommit URL is /api/build-plan/commits', async () => {
    const stub = vi.fn(async (..._args: unknown[]) => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }))
    vi.stubGlobal('fetch', stub)

    await pushCommit('t', 'sha', '2026-05-15T12:00:00Z', 'code')

    const calledUrl = stub.mock.calls[0][0] as string
    expect(calledUrl).toBe('https://example.com/api/build-plan/commits')
  })

  it('throws plain Error on unknown status (418)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 418, text: async () => 'teapot' })),
    )
    try {
      await pushTaskProgress('task-1', 'done')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      expect(err).not.toBeInstanceOf(TokbAuthError)
      expect(err).not.toBeInstanceOf(TokbValidationError)
      expect(err).not.toBeInstanceOf(TokbServerError)
      expect((err as Error).message).toMatch(/418/)
    }
  })
})
