import { Command } from 'commander'
import { writeConfig } from '../lib/config.js'
import { runPreflight } from '../lib/preflight.js'
import { verifyToken } from '../lib/api.js'

type VerifyResponse = {
  project_id: string
  plan_id?: string
  slug?: string
  repo_url?: string
  vercel_url?: string
  supabase_url?: string
}

export function initCommand(program: Command): void {
  program
    .command('init')
    .argument('<token>', 'tokb_apt_* token')
    .description('토큰 검증 + 프로젝트 정보를 .tokb/config.json 에 저장')
    .option('--platform-url <url>', 'platform 기본 URL', 'https://pj-platform.vercel.app')
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

      await writeConfig({
        push_token: token,
        project_id: verified.project_id,
        plan_id: verified.plan_id,
        repo_url: verified.repo_url,
        vercel_url: verified.vercel_url,
        supabase_url: verified.supabase_url,
        platform_base_url: opts.platformUrl,
      })

      console.log(`✓ 토큰 검증 완료, 프로젝트 ${verified.slug ?? verified.project_id} 설정 저장됨`)
      console.log('\n다음 단계: Claude Code 실행  claude')
    })
}
