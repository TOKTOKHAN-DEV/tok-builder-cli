import { Command } from 'commander'
import { pushTaskProgress, pushTaskArtifacts, type ArtifactKind } from '../lib/api.js'

const ARTIFACT_KINDS: ReadonlyArray<ArtifactKind> = ['spec', 'code', 'doc', 'config', 'test', 'other']

export function taskCommand(program: Command): void {
  const task = program.command('task').description('Per-task progress + artifact reporting')

  task
    .command('progress <id> <status>')
    .description('Report task status (pending|in_progress|blocked|done|skipped)')
    .option('--note <note>', 'Optional note attached to the progress event')
    .action(async (id: string, status: string, opts: { note?: string }) => {
      await pushTaskProgress(id, status, opts.note)
      console.log(`task ${id} → ${status}`)
    })

  task
    .command('done <id>')
    .description('Shortcut for `pj task progress <id> done`')
    .action(async (id: string) => {
      await pushTaskProgress(id, 'done')
      console.log(`task ${id} → done`)
    })

  const artifact = task.command('artifact').description('Manage task artifacts')
  artifact
    .command('add <id> <path>')
    .description('Attach an artifact path to a task')
    .option('--kind <kind>', `One of: ${ARTIFACT_KINDS.join('|')}`, 'other')
    .action(async (id: string, path: string, opts: { kind: string }) => {
      if (!ARTIFACT_KINDS.includes(opts.kind as ArtifactKind)) {
        console.error(`Invalid --kind. Expected one of: ${ARTIFACT_KINDS.join(', ')}`)
        process.exit(1)
      }
      await pushTaskArtifacts(id, [{ path, kind: opts.kind as ArtifactKind }])
      console.log(`artifact added to task ${id}: ${path}`)
    })
}
