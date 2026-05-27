import { describe, it, expect } from 'vitest'

import { toUtcIso } from '../commits'

describe('toUtcIso — git %cI (offset) → platform UTC Z 정규화', () => {
  it('KST +09:00 오프셋을 UTC Z 로 변환 (instant 보존)', () => {
    expect(toUtcIso('2026-05-27T10:06:27+09:00')).toBe('2026-05-27T01:06:27.000Z')
  })

  it('+00:00 오프셋도 Z 로 정규화', () => {
    expect(toUtcIso('2026-05-27T01:06:27+00:00')).toBe('2026-05-27T01:06:27.000Z')
  })

  it('음수 오프셋(-05:00)도 UTC 로 변환', () => {
    expect(toUtcIso('2026-05-26T20:06:27-05:00')).toBe('2026-05-27T01:06:27.000Z')
  })

  it('이미 Z 인 입력은 시각 그대로 Z 유지', () => {
    expect(toUtcIso('2026-05-27T01:06:27Z')).toBe('2026-05-27T01:06:27.000Z')
  })

  it('파싱 불가 입력은 throw', () => {
    expect(() => toUtcIso('not-a-date')).toThrow()
  })
})
