import { Command } from 'commander'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { bootstrapDesignAssets } from '../lib/design-assets/index.js'
import { verifyToken } from '../lib/api.js'
import { writeConfig } from '../lib/config.js'
import { upsertEnvLocal } from '../lib/env-local.js'
import { runPreflight } from '../lib/preflight.js'

type VerifyResponse = {
  project_id: string
  plan_id?: string
  slug?: string
  repo_url?: string
  vercel_url?: string
  supabase_url?: string
}

type EnvResponse = {
  supabase_url: string
  supabase_anon_key: string
  supabase_service_role_key: string
}

export function initCommand(program: Command): void {
  program
    .command('init')
    .argument('<token>', 'tokb_apt_* token')
    .description('토큰 검증 + 프로젝트 정보 저장 + design assets bootstrap')
    .option('--platform-url <url>', 'platform 기본 URL', 'https://builder.toktokhan.dev')
    .action(async (token: string, opts: { platformUrl: string }) => {
      console.log('=== 사전 점검 ===')
      const pf = runPreflight()
      if (!pf.ok) {
        console.error('사전 점검 실패:')
        for (const f of pf.failures) console.error(`  - ${f}`)
        process.exit(1)
      }
      console.log('사전 점검 완료')

      console.log('=== 토큰 검증 ===')
      let verified: VerifyResponse
      try {
        verified = (await verifyToken(token, opts.platformUrl)) as VerifyResponse
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }

      // config.json 에는 메타만 — push_token 은 .env.local 의 TOKB_PUSH_TOKEN 으로 분리
      await writeConfig({
        project_id: verified.project_id,
        plan_id: verified.plan_id,
        repo_url: verified.repo_url,
        vercel_url: verified.vercel_url,
        supabase_url: verified.supabase_url,
        platform_base_url: opts.platformUrl,
      })

      console.log(`✓ 토큰 검증 완료, 프로젝트 ${verified.slug ?? verified.project_id} 설정 저장됨`)

      // === .env.local 에 TOKB_PUSH_TOKEN 기록 (항상 — Supabase fetch 실패해도 token 은 기록됨) ===
      // build repo 의 로컬 working tree 에만 write. GitHub commit X (.gitignore 의 .env*.local 패턴).
      await upsertEnvLocal(process.cwd(), [{ key: 'TOKB_PUSH_TOKEN', value: token }])
      console.log('✓ .env.local 에 TOKB_PUSH_TOKEN 기록 (로컬 only, 권한 0600)')

      // === .env.local: Supabase keys 로컬 주입 (fetch 가능할 때만, 기존 키 보존) ===
      if (verified.project_id) {
        try {
          const envRes = await fetch(
            `${opts.platformUrl}/api/agent/projects/${verified.project_id}/env`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          if (envRes.status === 409) {
            console.log('⚠  .env.local: Supabase keys 미프로비저닝 — platform 에서 설정 후 재실행')
          } else if (!envRes.ok) {
            console.log(`⚠  .env.local fetch 실패 (${envRes.status}) — omc 가 supabase 명령 실행 시 막힐 수 있음`)
          } else {
            const env = (await envRes.json()) as EnvResponse
            await upsertEnvLocal(process.cwd(), [
              { key: 'NEXT_PUBLIC_SUPABASE_URL', value: env.supabase_url },
              { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: env.supabase_anon_key },
              { key: 'SUPABASE_SERVICE_ROLE_KEY', value: env.supabase_service_role_key },
            ])
            console.log('✓ .env.local 에 Supabase keys 기록')
          }
        } catch (err) {
          console.log(`⚠  .env.local fetch 실패 — ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      // === design assets bootstrap ===
      const repoRoot = process.cwd()
      const designMdPath = join(repoRoot, '.tokb/design.md')
      if (!existsSync(designMdPath)) {
        console.log('\n.tokb/design.md 없음 — design assets bootstrap 건너뜀')
        console.log('platform 에서 빌드 시작 안 됐거나 inject 실패. platform 으로 회귀하세요.')
        console.log('\n다음 단계: Claude Code 실행  claude')
        return
      }

      console.log('\n=== design assets bootstrap ===')
      try {
        const r = bootstrapDesignAssets({ repoRoot })
        console.log(`✓ app/globals.css 생성`)
        console.log(`✓ src/assets/icons/ : ${r.iconCount}개 SVG (style 외 5 폴더 정리)`)
        console.log(`✓ git commit: ${r.committed ? '완료' : '건너뜀 (수동 commit 필요)'}`)
        console.log(`✓ git push:   ${r.pushed ? '완료' : r.committed ? '건너뜀 (수동 push 필요)' : '건너뜀 (commit 없음)'}`)
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }

      console.log('\n다음 단계: Claude Code 실행  claude')
    })
}
