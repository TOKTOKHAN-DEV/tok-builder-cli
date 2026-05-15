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
  const task = program.command('task').description('task 별 진행 상황 + 산출물 보고')

  task
    .command('progress')
    .description('task 상태 보고')
    .addArgument(new Argument('<id>', 'Task UUID'))
    .addArgument(new Argument('<status>', 'task 상태').choices([...TASK_STATUSES]))
    .option('--note <note>', '진행 이벤트에 첨부할 메모 (선택)')
    .option('--commit-sha-test <sha>', 'auto task done 시 test commit SHA (TDD 강제)')
    .option('--commit-sha-code <sha>', 'auto task done 시 code commit SHA (TDD 강제)')
    .action(
      async (
        id: string,
        status: TaskStatus,
        opts: { note?: string; commitShaTest?: string; commitShaCode?: string },
      ) => {
        await pushTaskProgress(id, status, {
          note: opts.note,
          commitShaTest: opts.commitShaTest,
          commitShaCode: opts.commitShaCode,
        })
        console.log(`✓ task ${id} → ${status}`)
      },
    )

  task
    .command('done <id>')
    .description('`tokb task progress <id> done` 단축형')
    .option('--commit-sha-test <sha>', 'auto task done 시 test commit SHA (TDD 강제)')
    .option('--commit-sha-code <sha>', 'auto task done 시 code commit SHA (TDD 강제)')
    .action(async (id: string, opts: { commitShaTest?: string; commitShaCode?: string }) => {
      await pushTaskProgress(id, 'done', {
        commitShaTest: opts.commitShaTest,
        commitShaCode: opts.commitShaCode,
      })
      console.log(`✓ task ${id} → done`)
    })

  const artifact = task.command('artifact').description('task 산출물 관리')
  artifact
    .command('add <id> <path>')
    .description('task 에 산출물 path 첨부')
    .addOption(
      new Option('--kind <kind>', '산출물 종류').choices([...ARTIFACT_KINDS]).default('other'),
    )
    .action(async (id: string, path: string, opts: { kind: ArtifactKind }) => {
      await pushTaskArtifacts(id, [{ path, kind: opts.kind }])
      console.log(`✓ task ${id} 산출물 추가: ${path}`)
    })
}
