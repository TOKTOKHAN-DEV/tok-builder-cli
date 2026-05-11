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
    .action(async () => {
      const projectId = await requireField('project_id')
      const state = await getProjectState(projectId)
      const inProgress = state.tasks.filter((t) => t.status === 'in_progress')

      console.log('=== Resume context ===')
      console.log(`Plan status: ${state.plan?.status ?? '(none)'}`)
      console.log(`Current phase: ${state.plan?.current_phase_id ?? '(none)'}`)
      console.log(`In-progress tasks (${inProgress.length}):`)
      for (const t of inProgress) {
        const safeTitle = t.title.replace(/[\x00-\x08\x0b-\x1f\x7f]|\x1b\[[0-9;]*m/g, '')
        console.log(`  - ${t.id}: ${safeTitle}`)
      }
      console.log(`\nLocal git status:`)
      console.log(safeGitStatus() || '(clean)')
    })
}
