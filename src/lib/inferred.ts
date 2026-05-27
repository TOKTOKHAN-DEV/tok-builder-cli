// 추론 게이트 — spec G1/G2/G3 (pj-platform docs/superpowers/specs/2026-05-27-inferred-gate-design.md)
// ⚠️ SSOT: 이 파일이 게이트 로직 단일 출처. 변경 시 tok-builder-template 의
//          common/workflow-changes.md "추론 게이트 동기 의무" 참조.

interface InferredAccumulated {
  analysis?: unknown[]
  design_spec?: unknown[]
}
interface PlanLike {
  inferred_fields?: unknown
  inferred_fields_accumulated?: InferredAccumulated
}

function arrLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0
}

/** G1: plan.json 추론 항목 총 개수 (inferred_fields ∪ accumulated.analysis ∪ accumulated.design_spec) */
export function countInferred(plan: PlanLike): number {
  const acc = plan.inferred_fields_accumulated ?? {}
  return arrLen(plan.inferred_fields) + arrLen(acc.analysis) + arrLen(acc.design_spec)
}

/** G2/G3: 추론 ≥1 인데 ack 안 했으면 throw */
export function assertInferredAcked(plan: PlanLike, ackInferred: boolean): void {
  const n = countInferred(plan)
  if (n > 0 && !ackInferred) {
    throw new Error(
      `✗ 추론 항목 ${n}건 감지 (inferred_fields / accumulated).\n` +
        `  사용자에게 제시·승인 후 --ack-inferred 로 재실행하세요.`,
    )
  }
}
