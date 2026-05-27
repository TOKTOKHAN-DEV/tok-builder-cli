import { Command } from 'commander'
import { planUpsert, planTaskAdd } from '../lib/api.js'
import { requireField } from '../lib/config.js'

export function planCommand(program: Command): void {
  const plan = program.command('plan').description('빌드 플랜 관리')

  plan
    .command('upsert <jsonPath>')
    .description('JSON 파일로 plan task 일괄 upsert')
    .option('--ack-inferred', '추론 항목을 사용자가 승인했음 — 추론 있어도 upsert 진행')
    .action(async (jsonPath: string, opts: { ackInferred?: boolean }) => {
      const planId = await requireField('plan_id')
      await planUpsert(planId, jsonPath, { ackInferred: opts.ackInferred })
      console.log('✓ plan upsert 완료')
    })

  plan
    .command('task-add <jsonPath>')
    .description('현재 plan 에 단일 task 추가')
    .action(async (jsonPath: string) => {
      const planId = await requireField('plan_id')
      await planTaskAdd(planId, jsonPath)
      console.log('✓ task 추가됨')
    })
}
