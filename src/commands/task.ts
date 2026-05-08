import { Command, Argument, Option } from 'commander'
import {
  pushTaskProgress,
  pushTaskArtifacts,
  ARTIFACT_KINDS,
  TASK_STATUSES,
  type ArtifactKind,
  type TaskStatus,
} from '../lib/api.js'

export function taskCommand(program: Command): void {
  const task = program.command('task').description('Per-task progress + artifact reporting')

  task
    .command('progress')
    .description('Report task status')
    .addArgument(new Argument('<id>', 'Task UUID'))
    .addArgument(new Argument('<status>', 'Task status').choices([...TASK_STATUSES]))
    .option('--note <note>', 'Optional note attached to the progress event')
    .action(async (id: string, status: TaskStatus, opts: { note?: string }) => {
      await pushTaskProgress(id, status, opts.note)
      console.log(`task ${id} → ${status}`)
    })

  task
    .command('done <id>')
    .description('Shortcut for `tokb task progress <id> done`')
    .action(async (id: string) => {
      await pushTaskProgress(id, 'done')
      console.log(`task ${id} → done`)
    })

  const artifact = task.command('artifact').description('Manage task artifacts')
  artifact
    .command('add <id> <path>')
    .description('Attach an artifact path to a task')
    .addOption(
      new Option('--kind <kind>', 'Artifact kind').choices([...ARTIFACT_KINDS]).default('other'),
    )
    .action(async (id: string, path: string, opts: { kind: ArtifactKind }) => {
      await pushTaskArtifacts(id, [{ path, kind: opts.kind }])
      console.log(`artifact added to task ${id}: ${path}`)
    })
}
