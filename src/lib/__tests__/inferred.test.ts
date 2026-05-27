import { describe, it, expect } from 'vitest'
import { countInferred, assertInferredAcked } from '../inferred.js'

describe('countInferred', () => {
  it('필드 없으면 0', () => {
    expect(countInferred({})).toBe(0)
  })
  it('inferred_fields + accumulated.{analysis,design_spec} 합산', () => {
    const plan = {
      inferred_fields: ['tasks[1].domain', 'tasks[2].domain'],
      inferred_fields_accumulated: { analysis: ['flows[0]'], design_spec: ['status[3]'] },
    }
    expect(countInferred(plan)).toBe(4)
  })
  it('accumulated 일부만 있어도 안전', () => {
    expect(countInferred({ inferred_fields_accumulated: { analysis: ['a'] } })).toBe(1)
  })
})

describe('assertInferredAcked', () => {
  it('추론 0건이면 ack 없어도 통과', () => {
    expect(() => assertInferredAcked({}, false)).not.toThrow()
  })
  it('추론 ≥1 + ack 없음 → throw (개수 포함)', () => {
    expect(() => assertInferredAcked({ inferred_fields: ['x', 'y'] }, false)).toThrow(/추론 항목 2건/)
  })
  it('추론 ≥1 + ack 있음 → 통과', () => {
    expect(() => assertInferredAcked({ inferred_fields: ['x'] }, true)).not.toThrow()
  })
})

import { planUpsert } from '../api.js'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('planUpsert 게이트', () => {
  it('추론 ≥1 + ack 없음 → 네트워크 전 throw', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-plan-'))
    try {
      const p = join(dir, 'plan.json')
      await writeFile(p, JSON.stringify({ inferred_fields: ['tasks[1].domain'], tasks: [] }))
      await expect(planUpsert('plan-1', p, { ackInferred: false })).rejects.toThrow(/추론 항목 1건/)
    } finally {
      await rm(dir, { recursive: true })
    }
  })
})
