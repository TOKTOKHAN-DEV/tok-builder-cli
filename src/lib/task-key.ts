// task client_id pattern — `T-` prefix + 숫자. case-insensitive (skill 3 의 t-001 형식 / 화면 표시 T-001 두 케이스 정합).
const TASK_CLIENT_ID_PATTERN = /^[tT]-[0-9]+$/

export function assertValidTaskClientId(taskClientId: string): void {
  if (!TASK_CLIENT_ID_PATTERN.test(taskClientId)) {
    console.error(
      `taskClientId 형식 오류: '${taskClientId}' — 'T-숫자' (또는 't-숫자') 만 허용.`,
    )
    process.exit(1)
  }
}
