import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('../config.js', () => ({
  requireConfig: vi.fn(async () => ({
    push_token: 'tokb_apt_test',
    platform_base_url: 'https://example.com',
  })),
}))

import { pushTaskProgress, pushTaskArtifacts, getProjectState, getPlanState, pushCommit, reportTaskCriteria, fetchDbTypes } from '../api.js'
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

  it('reportTaskCriteria posts done/undone indices', async () => {
    await reportTaskCriteria('task-1', { done: [0, 1], undone: [2] })
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api/agent/tasks/task-1/criteria',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tokb_apt_test',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ done: [0, 1], undone: [2] }),
      }),
    )
  })

  it('reportTaskCriteria defaults to empty arrays', async () => {
    await reportTaskCriteria('task-1')
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api/agent/tasks/task-1/criteria',
      expect.objectContaining({ body: JSON.stringify({ done: [], undone: [] }) }),
    )
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
      json: async () => ({ phase: 'backend', current_phase: 'backend', groups: [] }),
      text: async () => '',
    }))
    vi.stubGlobal('fetch', stub)

    await getPlanState('plan-1', 'backend')

    expect(stub).toHaveBeenCalledWith(
      'https://example.com/api/agent/plans/plan-1/state?phase=backend',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tokb_apt_test' }),
      }),
    )
  })

  it('getPlanState without phase omits query param', async () => {
    const stub = vi.fn(async (..._args: unknown[]) => ({
      ok: true, status: 200,
      json: async () => ({ phase: 'external', current_phase: 'external', groups: [] }),
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
        phase: 'backend',
        current_phase: 'backend',
        groups: [
          {
            parallel_group: 'auth',
            group_key: 'auth',
            phase_slug: 'backend',
            tasks: [{
              id: 't1',
              client_id: 'c1',
              phase_slug: 'backend',
              group_key: 'auth',
              domain: 'auth',
              description: 'A description',
              acceptance_criteria: '- ok',
              test_file_path: null,
              title: 'A',
              status: 'pending',
            }],
          },
        ],
      }),
      text: async () => '',
    })))

    const res = await getPlanState('plan-1', 'backend')
    expect(res.groups).toHaveLength(1)
    expect(res.groups[0].parallel_group).toBe('auth')
    expect(res.groups[0].tasks[0].id).toBe('t1')
  })

  it('shape guard — id 누락 응답 → zod throw', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      phase: 'backend',
      current_phase: 'backend',
      groups: [
        {
          parallel_group: 'auth',
          group_key: 'auth',
          phase_slug: 'backend',
          tasks: [{
            // id 누락
            client_id: 't-001',
            phase_slug: 'backend',
            group_key: 'auth',
            domain: 'auth',
            description: 'x',
            acceptance_criteria: '',
            test_file_path: null,
          }],
        },
      ],
    })))
    await expect(getPlanState('plan-1', 'backend')).rejects.toThrow()
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

describe('fetchDbTypes', () => {
  it('GET /api/agent/projects/<id>/db-types 호출 + 반환 텍스트', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('export type Database = { public: { Tables: {} } }', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    )

    const result = await fetchDbTypes('proj-1')

    expect(result).toContain('export type Database')
    const url = (vi.mocked(fetch).mock.calls[0]?.[0] ?? '').toString()
    expect(url).toMatch(/\/api\/agent\/projects\/proj-1\/db-types$/)
  })

  it('throws TokbAuthError on 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('unauthorized', { status: 401 }),
    )
    await expect(fetchDbTypes('proj-1')).rejects.toBeInstanceOf(TokbAuthError)
  })

  it('throws TokbServerError on 500', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('internal error', { status: 500 }),
    )
    await expect(fetchDbTypes('proj-1')).rejects.toBeInstanceOf(TokbServerError)
  })
})
