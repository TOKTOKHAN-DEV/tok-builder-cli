import { describe, it, expect, vi, afterEach } from 'vitest'
import { assertValidGroupKey } from '../group-key.js'

describe('assertValidGroupKey', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // 정상 case — process.exit 호출 없이 통과
  it.each([
    'auth',
    'auth-login',
    'vehicles_register',
    'staging',
    'A1',
    'myGroup_123',
  ])('정상 groupKey "%s" — process.exit 미호출', (key) => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((_code?: number | string | null) => {
        throw new Error('process.exit')
      })

    expect(() => assertValidGroupKey(key)).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  // 비정상 case — console.error 출력 + process.exit(1) 호출
  it.each([
    ['../etc', '경로 traversal'],
    ['a/b', '슬래시 포함'],
    ['auth/login', '슬래시 포함'],
    ['foo bar', '공백 포함'],
    ['', '빈 문자열'],
    ['-leading-hyphen', '첫 글자 하이픈'],
  ])('비정상 groupKey "%s" (%s) — process.exit(1) + 에러 메시지', (key) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((_code?: number | string | null) => {
        throw new Error('process.exit')
      })

    expect(() => assertValidGroupKey(key)).toThrow('process.exit')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('groupKey 형식 오류'))
  })
})
