import { Command } from 'commander'
import { planUpsert, planTaskAdd } from '../lib/api.js'
import { requireField } from '../lib/config.js'

export function planCommand(program: Command): void {
  const plan = program.command('plan').description('Build plan management')

  plan
    .command('upsert <jsonPath>')
    .description('Bulk upsert plan tasks from JSON file')
    .action(async (jsonPath: string) => {
      const planId = await requireField('plan_id')
      await planUpsert(planId, jsonPath)
      console.log('plan upserted')
    })

  plan
    .command('task-add <jsonPath>')
    .description('Add a single task to current plan')
    .action(async (jsonPath: string) => {
      const planId = await requireField('plan_id')
      await planTaskAdd(planId, jsonPath)
      console.log('task added')
    })
}
