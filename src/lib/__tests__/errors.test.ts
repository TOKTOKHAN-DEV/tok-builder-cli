import { describe, it, expect } from 'vitest'
import { TokbAuthError, TokbValidationError, TokbServerError } from '../errors'

describe('TokbAuthError', () => {
  it('명확한 안내 메시지 포함', () => {
    const err = new TokbAuthError()
    expect(err.name).toBe('TokbAuthError')
    expect(err.message).toContain('push_token')
    expect(err.message).toContain('.env.local')
    expect(err.message).toContain('TOKB_PUSH_TOKEN')
  })
})

describe('TokbValidationError', () => {
  it('issues 배열 메시지로 변환', () => {
    const issues = [
      { field: 'tasks[0].phase_slug', message: 'Unknown phase' },
      { field: 'tasks[0].client_id', message: 'duplicate' },
    ]
    const err = new TokbValidationError(issues)
    expect(err.name).toBe('TokbValidationError')
    expect(err.issues).toEqual(issues)
    expect(err.message).toContain('Unknown phase')
    expect(err.message).toContain('duplicate')
  })
})

describe('TokbServerError', () => {
  it('status code + retry 안내 메시지', () => {
    const err = new TokbServerError(503)
    expect(err.name).toBe('TokbServerError')
    expect(err.status).toBe(503)
    expect(err.message).toContain('503')
    expect(err.message).toContain('재시도')
  })
})
