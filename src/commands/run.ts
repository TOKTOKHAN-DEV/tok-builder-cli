import { Command, Option } from 'commander'
import {
  runAccept,
  runComplete,
  getProjectState,
  getPlanState,
  RUN_COMPLETION_STATUSES,
  type RunCompletionStatus,
} from '../lib/api.js'
import { requireField } from '../lib/config.js'

export function runCommand(program: Command): void {
  const run = program.command('run').description('빌드 run 생애주기')

  run
    .command('accept <runId>')
    .description('pending_review 상태 run 승인')
    .action(async (runId: string) => {
      await runAccept(runId)
      console.log(`✓ run ${runId} 승인됨`)
    })

  run
    .command('complete <runId>')
    .description('run 을 completed 또는 failed 로 표시')
    .addOption(
      new Option('--status <status>', 'run 완료 상태')
        .choices([...RUN_COMPLETION_STATUSES])
        .default('completed'),
    )
    .option('--error <msg>', '--status=failed 일 때 에러 메시지')
    .action(async (runId: string, opts: { status: RunCompletionStatus; error?: string }) => {
      await runComplete(runId, opts.status, opts.error)
      console.log(`✓ run ${runId} ${opts.status}`)
    })

  run
    .command('state')
    .description('현재 프로젝트 plan/run/tasks JSON 출력')
    .action(async () => {
      const projectId = await requireField('project_id')
      const state = await getProjectState(projectId)
      console.log(JSON.stringify(state, null, 2))
    })

  run
    .command('plan')
    .description('phase 의 parallel_group 별 task 묶음 (병렬 호출용)')
    .option('--phase <slug>', 'phase slug. 생략 시 current_phase')
    .action(async (opts: { phase?: string }) => {
      const planId = await requireField('plan_id')
      const state = await getPlanState(planId, opts.phase)
      console.log(JSON.stringify(state, null, 2))
    })
}
