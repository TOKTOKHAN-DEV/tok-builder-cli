import { Command } from 'commander'
import { getProjectState } from '../lib/api.js'
import { requireField } from '../lib/config.js'

export function filterGroupTasks<
  T extends { group_key: string | null; phase_slug: string },
>(tasks: T[], groupKey: string, phaseSlug?: string): T[] {
  return tasks.filter((t) => {
    if (t.group_key !== groupKey) return false;
    if (phaseSlug !== undefined && t.phase_slug !== phaseSlug) return false;
    return true;
  });
}

export function groupCommand(program: Command): void {
  const group = program.command('group').description('group 단위 진행 관리')

  group
    .command('status <groupKey>')
    .description('group 의 모든 task 진행 상태 출력')
    .option('--phase <slug>', '특정 phase 로 범위 제한')
    .action(async (groupKey: string, opts: { phase?: string }) => {
      const projectId = await requireField('project_id')
      const state = await getProjectState(projectId)
      const groupTasks = filterGroupTasks(state.tasks, groupKey, opts.phase)

      if (groupTasks.length === 0) {
        console.log(`group '${groupKey}' 의 task 없음`)
        return
      }

      const doneCnt = groupTasks.filter((t) => t.status === 'done').length
      console.log(`group '${groupKey}': ${doneCnt}/${groupTasks.length} done`)
      for (const t of groupTasks) {
        console.log(`  [${t.status}] ${t.id} (domain: ${t.domain ?? '-'})`)
      }
    })

  group
    .command('complete <groupKey>')
    .description('group 모든 task done 시 PR 생성 trigger')
    .option('--dry-run', '실 실행 없이 조건 확인만')
    .option('--phase <slug>', '특정 phase 로 범위 제한')
    .action(async (groupKey: string, opts: { dryRun?: boolean; phase?: string }) => {
      const projectId = await requireField('project_id')
      const state = await getProjectState(projectId)
      const groupTasks = filterGroupTasks(state.tasks, groupKey, opts.phase)

      if (groupTasks.length === 0) {
        console.error(`group '${groupKey}' 의 task 없음`)
        process.exit(1)
      }

      const notDone = groupTasks.filter((t) => t.status !== 'done')
      if (notDone.length > 0) {
        console.error(`group '${groupKey}' 미완료 task ${notDone.length} 개:`)
        for (const t of notDone) {
          console.error(`  [${t.status}] ${t.id}`)
        }
        process.exit(1)
      }

      console.log(`group '${groupKey}' 모든 task done. PR 생성 trigger 진입.`)

      if (opts.dryRun) {
        console.log('--dry-run: 실 PR 생성 skip')
        return
      }

      // v1: PR 생성은 omc 가 gh CLI 로 자율 진행. cli 는 검증만.
      // v1.x: cli 가 직접 gh API 호출 (별도 PR 로 추가)
      console.log('다음 step: omc 가 gh pr create 호출 (또는 cli v1.x 자동화)')
    })
}
