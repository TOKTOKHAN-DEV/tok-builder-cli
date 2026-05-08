import { Command } from 'commander'
import { planUpsert, planTaskAdd } from '../lib/api.js'
import { requireConfig } from '../lib/config.js'

export function planCommand(program: Command): void {
  const plan = program.command('plan').description('Build plan management')

  plan
    .command('upsert <jsonPath>')
    .description('Bulk upsert plan tasks from JSON file')
    .action(async (jsonPath: string) => {
      const cfg = await requireConfig()
      if (!cfg.plan_id) {
        console.error('plan_id missing in .pj/config.json. Run `pj init` first.')
        process.exit(1)
      }
      await planUpsert(cfg.plan_id, jsonPath)
      console.log('plan upserted')
    })

  plan
    .command('task-add <jsonPath>')
    .description('Add a single task to current plan')
    .action(async (jsonPath: string) => {
      const cfg = await requireConfig()
      if (!cfg.plan_id) {
        console.error('plan_id missing in .pj/config.json. Run `pj init` first.')
        process.exit(1)
      }
      await planTaskAdd(cfg.plan_id, jsonPath)
      console.log('task added')
    })
}
