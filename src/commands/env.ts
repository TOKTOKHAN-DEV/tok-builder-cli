import { Command } from 'commander'
import { z, ZodError } from 'zod'

import { requireConfig } from '../lib/config.js'
import { upsertEnvLocal } from '../lib/env-local.js'

const SECRET_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/
// platform `lib/projects/secrets/server.ts` 의 control char 차단 정합 — newline/NUL 외 모든 제어 문자.
const SECRET_VALUE_DENY = /[\x00-\x1F\x7F]/

const SecretsResponseSchema = z.object({
  secrets: z.array(
    z.object({
      key: z.string().regex(SECRET_KEY_PATTERN, 'key 형식 위반 (^[A-Z][A-Z0-9_]{0,63}$)'),
      value: z
        .string()
        .refine((v) => !SECRET_VALUE_DENY.test(v), 'value 에 제어 문자 포함 금지 (.env.local 깨짐 방어)'),
    }),
  ),
})

export type SecretEntry = z.infer<typeof SecretsResponseSchema>['secrets'][number]

/**
 * platform 의 `/api/agent/projects/[id]/secrets` GET — project_secrets 를 fetch.
 * 404 → 빈 배열 (등록 키 없음).
 * non-2xx (404 외) → throw (response body 노출 X — secret 누설 회피).
 * zod schema 로 응답 검증 (defense in depth — key regex + value newline 차단).
 */
export async function fetchProjectSecrets(
  platformBaseUrl: string,
  projectId: string,
  token: string,
): Promise<SecretEntry[]> {
  const url = `${platformBaseUrl}/api/agent/projects/${encodeURIComponent(projectId)}/secrets`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) {
    return []
  }
  if (!response.ok) {
    throw new Error(`platform secrets 응답 실패: ${response.status} ${response.statusText}`)
  }

  const raw = (await response.json()) as unknown
  try {
    const parsed = SecretsResponseSchema.parse(raw)
    return parsed.secrets
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join(', ')
      throw new Error(`platform 응답 secrets 검증 실패: ${issues}`)
    }
    throw err
  }
}

export function envCommand(program: Command): void {
  const env = program
    .command('env')
    .description('외부 환경 변수 sync — platform UI 에서 등록한 키를 .env.local 에 반영 (#12-A 흐름)')

  env
    .command('sync')
    .description('platform 의 project_secrets 를 .env.local 에 upsert')
    .action(async () => {
      const cfg = await requireConfig()
      if (!cfg.project_id) {
        console.error('project_id 가 config.json 에 없습니다. `tokb init <token>` 먼저 실행하세요.')
        process.exit(1)
      }
      if (!cfg.push_token) {
        console.error('TOKB_PUSH_TOKEN 이 .env.local 에도 없고 config.json 에도 없습니다.')
        process.exit(1)
      }

      let secrets: SecretEntry[]
      try {
        secrets = await fetchProjectSecrets(cfg.platform_base_url, cfg.project_id, cfg.push_token)
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }

      if (secrets.length === 0) {
        console.log('등록된 외부 키 없음 — platform UI 에서 키 등록 후 다시 sync 하세요.')
        return
      }

      await upsertEnvLocal(process.cwd(), secrets)
      console.log(`✓ .env.local 에 ${secrets.length} 개 키 sync:`)
      for (const s of secrets) {
        console.log(`  - ${s.key}`)
      }
    })
}
