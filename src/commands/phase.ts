import { Command } from 'commander'
import { getProjectState } from '../lib/api.js'
import { requireField } from '../lib/config.js'

export function phaseCommand(program: Command): void {
  const phase = program.command('phase').description('Phase 진행 현황 + 전이')

  phase
    .command('status')
    .description('현재 phase + 완료/전체 task 수 출력')
    .action(async () => {
      const projectId = await requireField('project_id')
      const state = await getProjectState(projectId)
      const total = state.tasks.length
      const done = state.tasks.filter((t) => t.status === 'done').length
      console.log(`phase: ${state.plan?.current_phase_id ?? '?'}`)
      console.log(`진행률: ${done}/${total}`)
    })

  phase
    .command('next')
    .description('다음 phase 로 전이 (v1 미구현 — platform UI 사용)')
    .action(() => {
      console.error('phase next: v1 에선 미구현. platform UI 에서 phase 전이하세요.')
      process.exit(1)
    })
}
