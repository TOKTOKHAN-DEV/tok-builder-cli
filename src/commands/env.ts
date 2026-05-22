import { Command } from 'commander'

import { requireConfig } from '../lib/config.js'
import { upsertEnvLocal } from '../lib/env-local.js'

interface SecretEntry {
  key: string
  value: string
}

interface SecretsResponse {
  secrets: SecretEntry[]
}

/**
 * platform 의 `/api/agent/projects/[id]/secrets` GET — project_secrets 를 fetch.
 * 404 → 빈 배열 (등록 키 없음).
 * non-2xx (404 외) → throw.
 */
export async function fetchProjectSecrets(
  platformBaseUrl: string,
  projectId: string,
  token: string,
): Promise<SecretEntry[]> {
  const url = `${platformBaseUrl}/api/agent/projects/${projectId}/secrets`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) {
    return []
  }
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`platform 응답 ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = (await response.json()) as Partial<SecretsResponse>
  if (!Array.isArray(data.secrets)) {
    throw new Error('platform 응답 형식 오류 — secrets 배열 없음')
  }
  return data.secrets
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
