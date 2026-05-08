import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('../config.js', () => ({
  requireConfig: vi.fn(async () => ({
    push_token: 'tokb_apt_test',
    platform_base_url: 'https://example.com',
  })),
}))

import { pushTaskProgress, pushTaskArtifacts, getProjectState } from '../api.js'

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
    await expect(pushTaskProgress('task-1', 'done')).rejects.toThrow(/401/)
  })
})
