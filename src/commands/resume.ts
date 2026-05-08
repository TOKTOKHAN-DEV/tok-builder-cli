import { Command } from 'commander'
import { execSync } from 'node:child_process'
import { getProjectState } from '../lib/api.js'
import { requireConfig } from '../lib/config.js'

export function resumeCommand(program: Command): void {
  program
    .command('resume')
    .description('Print resume context (plan status, in-progress tasks, git status)')
    .option('--auto-push', 'Best-effort push of pending progress (Stop hook usage)')
    .action(async (opts: { autoPush?: boolean }) => {
      const cfg = await requireConfig()
      if (!cfg.project_id) {
        console.error('No project_id in config. Run `pj init` first.')
        process.exit(1)
      }
      const state = await getProjectState(cfg.project_id)
      const inProgress = state.tasks?.filter((t) => t.status === 'in_progress') ?? []
      const gitStatus = (() => {
        try {
          return execSync('git status --short', { encoding: 'utf-8' })
        } catch {
          return '(git unavailable)'
        }
      })()

      console.log('=== Resume context ===')
      console.log(`Plan status: ${state.plan?.status ?? '(none)'}`)
      console.log(`Current phase: ${state.plan?.current_phase_id ?? '(none)'}`)
      console.log(`In-progress tasks (${inProgress.length}):`)
      for (const t of inProgress) {
        console.log(`  - ${t.id}: ${t.title}`)
      }
      console.log(`\nLocal git status:`)
      console.log(gitStatus || '(clean)')

      if (opts.autoPush) {
        // v1: best-effort auto-push is not yet wired. Silent no-op for Stop hook safety.
        // v1.x: derive likely progress events from git status diff and push to platform.
      }
    })
}
