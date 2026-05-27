import { Command, Argument, Option } from 'commander'
import {
  pushTaskProgress,
  pushTaskArtifacts,
  reportTaskCriteria,
  ARTIFACT_KINDS,
  TASK_STATUSES,
  type ArtifactKind,
  type TaskStatus,
} from '../lib/api.js'

/** "0,1, 2" → [0,1,2]. 쉼표 분리·trim·Number, 음수/비정수/빈 토큰 제외 (C1: 0-based 인덱스). */
export function parseIdx(s?: string): number[] {
  return (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0)
}

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

  task
    .command('criteria <taskId>')
    .description('acceptance criterion 충족 인덱스 보고 (0-based 체크박스 줄)')
    .option('--done <list>', '충족 criterion 인덱스 (쉼표 구분, 예: "0,1")')
    .option('--undone <list>', '미충족으로 되돌릴 criterion 인덱스 (쉼표 구분)')
    .action(async (taskId: string, opts: { done?: string; undone?: string }) => {
      const done = parseIdx(opts.done)
      const undone = parseIdx(opts.undone)
      await reportTaskCriteria(taskId, { done, undone })
      console.log(`✓ task ${taskId} criteria → done [${done.join(', ')}] undone [${undone.join(', ')}]`)
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
