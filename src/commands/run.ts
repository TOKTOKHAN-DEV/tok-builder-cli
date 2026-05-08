import { Command, Option } from 'commander'
import {
  runAccept,
  runComplete,
  getProjectState,
  RUN_COMPLETION_STATUSES,
  type RunCompletionStatus,
} from '../lib/api.js'
import { requireField } from '../lib/config.js'

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
    .addOption(
      new Option('--status <status>', 'Run completion status')
        .choices([...RUN_COMPLETION_STATUSES])
        .default('completed'),
    )
    .option('--error <msg>', 'Error message when --status=failed')
    .action(async (runId: string, opts: { status: RunCompletionStatus; error?: string }) => {
      await runComplete(runId, opts.status, opts.error)
      console.log(`run ${runId} ${opts.status}`)
    })

  run
    .command('state')
    .description('Print current project plan/run/tasks JSON')
    .action(async () => {
      const projectId = await requireField('project_id')
      const state = await getProjectState(projectId)
      console.log(JSON.stringify(state, null, 2))
    })
}
