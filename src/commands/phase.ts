import { Command } from 'commander'
import { getProjectState } from '../lib/api.js'
import { requireConfig } from '../lib/config.js'

export function phaseCommand(program: Command): void {
  const phase = program.command('phase').description('Phase progress + transitions')

  phase
    .command('status')
    .description('Print current phase + done/total task count')
    .action(async () => {
      const cfg = await requireConfig()
      if (!cfg.project_id) {
        console.error('project_id missing in .pj/config.json. Run `pj init` first.')
        process.exit(1)
      }
      const state = await getProjectState(cfg.project_id)
      const total = state.tasks?.length ?? 0
      const done = state.tasks?.filter((t) => t.status === 'done').length ?? 0
      console.log(`phase: ${state.plan?.current_phase_id ?? '?'}`)
      console.log(`progress: ${done}/${total}`)
    })

  phase
    .command('next')
    .description('Advance to next phase (not yet implemented — use platform UI)')
    .action(() => {
      console.error('phase next: not yet implemented in v1. Use platform UI to advance phases.')
      process.exit(2)
    })
}
