export class TokbAuthError extends Error {
  constructor() {
    super(
      'push_token 만료 또는 무효. ' +
      '.env.local 의 TOKB_PUSH_TOKEN 확인하거나 platform UI 에서 새 빌드 시작 후 새 토큰 받기.'
    )
    this.name = 'TokbAuthError'
  }
}

export class TokbValidationError extends Error {
  constructor(public readonly issues: { field: string; message: string }[]) {
    super(
      'plan validation 실패. AI 가 plan 재작성 후 재 upsert 필요. 이슈:\n' +
      issues.map((i) => `  - ${i.field}: ${i.message}`).join('\n')
    )
    this.name = 'TokbValidationError'
  }
}

export class TokbServerError extends Error {
  constructor(public readonly status: number) {
    super(
      `platform 서버 일시 오류 (${status}). 1분 후 재시도 가능. ` +
      `계속되면 사용자에게 platform 점검 안내.`
    )
    this.name = 'TokbServerError'
  }
}
