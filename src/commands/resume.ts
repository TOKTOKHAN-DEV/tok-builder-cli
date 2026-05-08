import { Command } from 'commander'
import { execSync } from 'node:child_process'
import { getProjectState } from '../lib/api.js'
import { requireField } from '../lib/config.js'

function safeGitStatus(): string {
  try {
    return execSync('git status --short', { encoding: 'utf-8' })
  } catch {
    return '(git unavailable)'
  }
}

export function resumeCommand(program: Command): void {
  program
    .command('resume')
    .description('Print resume context (plan status, in-progress tasks, git status)')
    .option(
      '--auto-push',
      'Reserved for v1.x — Stop-hook compatible; currently a no-op so the hook never fails.',
    )
    .action(async () => {
      const projectId = await requireField('project_id')
      const state = await getProjectState(projectId)
      const inProgress = state.tasks?.filter((t) => t.status === 'in_progress') ?? []

      console.log('=== Resume context ===')
      console.log(`Plan status: ${state.plan?.status ?? '(none)'}`)
      console.log(`Current phase: ${state.plan?.current_phase_id ?? '(none)'}`)
      console.log(`In-progress tasks (${inProgress.length}):`)
      for (const t of inProgress) {
        console.log(`  - ${t.id}: ${t.title}`)
      }
      console.log(`\nLocal git status:`)
      console.log(safeGitStatus() || '(clean)')
    })
}
