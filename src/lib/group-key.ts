const GROUP_KEY_PATTERN = /^[a-z0-9][a-z0-9\-_]*$/i

export function assertValidGroupKey(groupKey: string): void {
  if (!GROUP_KEY_PATTERN.test(groupKey)) {
    console.error(
      `groupKey 형식 오류: '${groupKey}' — 영문/숫자/하이픈/언더스코어만 허용 (첫 글자는 영문/숫자).`,
    )
    process.exit(1)
  }
}

const PHASE_SLUG_PATTERN = /^[a-z0-9][a-z0-9\-_]*$/i

export function assertValidPhaseSlug(phaseSlug: string): void {
  if (!PHASE_SLUG_PATTERN.test(phaseSlug)) {
    console.error(
      `phaseSlug 형식 오류: '${phaseSlug}' — 영문/숫자/하이픈/언더스코어만 허용 (첫 글자는 영문/숫자).`,
    )
    process.exit(1)
  }
}
