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

  it('500 응답 → throw (body 노출 X)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'leaked-secret-value',
    }) as unknown as typeof globalThis.fetch

    await expect(
      fetchProjectSecrets('https://platform.test', 'project-id', 'token'),
    ).rejects.toThrow('platform secrets 응답 실패: 500 Internal Server Error')
  })

  it('secrets 가 배열 아니면 zod throw', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ secrets: 'invalid' }),
    }) as unknown as typeof globalThis.fetch

    await expect(
      fetchProjectSecrets('https://platform.test', 'project-id', 'token'),
    ).rejects.toThrow('platform 응답 secrets 검증 실패')
  })

  it('invalid key (lowercase / 특수문자) → zod throw', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ secrets: [{ key: 'kakao_lower', value: 'abc' }] }),
    }) as unknown as typeof globalThis.fetch

    await expect(
      fetchProjectSecrets('https://platform.test', 'project-id', 'token'),
    ).rejects.toThrow('key 형식 위반')
  })

  it('value 에 newline 포함 → zod throw (.env.local 깨짐 방어)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ secrets: [{ key: 'KAKAO', value: 'real_value\nMALICIOUS=evil' }] }),
    }) as unknown as typeof globalThis.fetch

    await expect(
      fetchProjectSecrets('https://platform.test', 'project-id', 'token'),
    ).rejects.toThrow('newline/NUL')
  })

  it('Authorization 헤더 + endpoint URL 정합 (encodeURIComponent)', async () => {
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
