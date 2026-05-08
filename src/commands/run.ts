import { Command } from 'commander'
import { runAccept, runComplete, getProjectState } from '../lib/api.js'
import { requireConfig } from '../lib/config.js'

export function runCommand(program: Command): void {
  const run = program.command('run').description('Build run lifecycle')

  run
    .command('accept <runId>')
    .description('Accept a run that is pending_review')
    .action(async (runId: string) => {
      await runAccept(runId)
      console.log(`run ${runId} accepted`)
    })

  run
    .command('complete <runId>')
    .description('Mark a run as completed or failed')
    .option('--status <status>', 'completed|failed', 'completed')
    .option('--error <msg>', 'Error message when --status=failed')
    .action(async (runId: string, opts: { status: 'completed' | 'failed'; error?: string }) => {
      if (opts.status !== 'completed' && opts.status !== 'failed') {
        console.error("--status must be 'completed' or 'failed'")
        process.exit(1)
      }
      await runComplete(runId, opts.status, opts.error)
      console.log(`run ${runId} ${opts.status}`)
    })

  run
    .command('state')
    .description('Print current project plan/run/tasks JSON')
    .action(async () => {
      const cfg = await requireConfig()
      if (!cfg.project_id) {
        console.error('project_id missing in .pj/config.json. Run `pj init` first.')
        process.exit(1)
      }
      const state = await getProjectState(cfg.project_id)
      console.log(JSON.stringify(state, null, 2))
    })
}
