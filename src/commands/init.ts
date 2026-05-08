import { Command } from 'commander'
import { writeConfig } from '../lib/config.js'
import { runPreflight } from '../lib/preflight.js'

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
    .argument('<token>', 'pjp_apt_* token')
    .description('Verify token + persist project metadata to .pj/config.json')
    .option('--platform-url <url>', 'platform base URL', 'https://pj-platform.vercel.app')
    .action(async (token: string, opts: { platformUrl: string }) => {
      if (!token.startsWith('pjp_apt_')) {
        console.error('Invalid token format. Expected pjp_apt_*')
        process.exit(1)
      }

      console.log('=== preflight ===')
      const pf = runPreflight()
      if (!pf.ok) {
        console.error('Preflight failed:')
        for (const f of pf.failures) console.error(`  - ${f}`)
        process.exit(1)
      }
      console.log('preflight OK')

      console.log('=== verifying token ===')
      const res = await fetch(`${opts.platformUrl}/api/agent/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        console.error(`Token verification failed: ${res.status}`)
        process.exit(1)
      }
      const verified = (await res.json()) as VerifyResponse

      await writeConfig({
        push_token: token,
        project_id: verified.project_id,
        plan_id: verified.plan_id,
        repo_url: verified.repo_url,
        vercel_url: verified.vercel_url,
        supabase_url: verified.supabase_url,
        platform_base_url: opts.platformUrl,
      })

      console.log(`✓ token verified, config written for project ${verified.slug ?? verified.project_id}`)
      console.log('\nNext: open Claude Code to start:  claude')
    })
}
