import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/env-local.js', () => ({
  upsertEnvLocal: vi.fn(),
}))

import { fetchProjectSecrets } from '../env'

describe('fetchProjectSecrets', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('200 응답 + secrets 배열 → 그대로 반환', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ secrets: [{ key: 'KAKAO_REST_API_KEY', value: 'abc' }] }),
    }) as unknown as typeof globalThis.fetch

    const result = await fetchProjectSecrets('https://platform.test', 'project-id', 'token')
    expect(result).toEqual([{ key: 'KAKAO_REST_API_KEY', value: 'abc' }])
  })

  it('404 응답 → 빈 배열 (등록된 키 없음)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'not found',
    }) as unknown as typeof globalThis.fetch

    const result = await fetchProjectSecrets('https://platform.test', 'project-id', 'token')
    expect(result).toEqual([])
  })

  it('500 응답 → throw', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    }) as unknown as typeof globalThis.fetch

    await expect(
      fetchProjectSecrets('https://platform.test', 'project-id', 'token'),
    ).rejects.toThrow('platform 응답 500')
  })

  it('secrets 가 배열 아니면 throw', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ secrets: 'invalid' }),
    }) as unknown as typeof globalThis.fetch

    await expect(
      fetchProjectSecrets('https://platform.test', 'project-id', 'token'),
    ).rejects.toThrow('secrets 배열 없음')
  })

  it('Authorization 헤더 + endpoint URL 정합', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ secrets: [] }),
    })
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch

    await fetchProjectSecrets('https://platform.test', 'project-123', 'token-xyz')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://platform.test/api/agent/projects/project-123/secrets',
      { headers: { Authorization: 'Bearer token-xyz' } },
    )
  })
})
