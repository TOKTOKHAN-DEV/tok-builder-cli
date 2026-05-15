import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('../config.js', () => ({
  requireConfig: vi.fn(async () => ({
    push_token: 'tokb_apt_test',
    platform_base_url: 'https://example.com',
  })),
}))

import { pushTaskProgress, pushTaskArtifacts, getProjectState } from '../api.js'
import { TokbAuthError, TokbValidationError, TokbServerError } from '../errors.js'

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })),
    )
  })

  it('pushTaskProgress posts with bearer token + status body', async () => {
    await pushTaskProgress('task-1', 'in_progress', 'starting')
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

  it('throws on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, text: async () => 'unauthorized' })),
    )
    await expect(pushTaskProgress('task-1', 'done')).rejects.toThrow(TokbAuthError)
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
