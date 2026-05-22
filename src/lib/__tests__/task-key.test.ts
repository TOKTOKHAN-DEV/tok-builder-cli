import { describe, it, expect, vi } from 'vitest'
import { assertValidTaskClientId } from '../task-key'

describe('assertValidTaskClientId', () => {
  it('정상 client_id pattern (T-1, T-001, T-123) 통과', () => {
    expect(() => assertValidTaskClientId('T-1')).not.toThrow()
    expect(() => assertValidTaskClientId('T-001')).not.toThrow()
    expect(() => assertValidTaskClientId('T-123')).not.toThrow()
  })

  it('소문자 t-001 통과 (skill 3 의 t-001 형식 — group-key.ts 의 case-insensitive 패턴 정합)', () => {
    expect(() => assertValidTaskClientId('t-001')).not.toThrow()
  })

  it('잘못된 pattern — exit 1 (path / branch injection 방어)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`)
    }) as never)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => assertValidTaskClientId('T-001/../malicious')).toThrow()
    expect(() => assertValidTaskClientId('T-001;rm')).toThrow()
    expect(() => assertValidTaskClientId('')).toThrow()
    expect(() => assertValidTaskClientId('001')).toThrow()  // T- prefix 없음

    exitSpy.mockRestore()
    errSpy.mockRestore()
  })
})
