import { execFileSync } from 'node:child_process'
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

      console.log(`group '${groupKey}' 모든 task done. PR 생성 진입.`)

      if (opts.dryRun) {
        console.log('--dry-run: 실 PR 생성 skip')
        return
      }

      const branch = `feat/${groupKey}`

      // 1) push (이미 push 된 경우 no-op)
      try {
        execFileSync('git', ['push', '-u', 'origin', branch], { stdio: 'inherit' })
      } catch (e) {
        console.error(`git push fail: ${e instanceof Error ? e.message : String(e)}`)
        process.exit(1)
      }

      // 2) gh pr create
      const title = `feat(${groupKey}): group complete`
      try {
        execFileSync(
          'gh',
          [
            'pr',
            'create',
            '--base',
            'main',
            '--head',
            branch,
            '--title',
            title,
            '--body',
            `group '${groupKey}' 모든 task done. 자동 PR.`,
          ],
          { stdio: 'inherit' },
        )
        console.log(`✓ PR 생성 완료 (group: ${groupKey})`)
      } catch (e) {
        // PR 이미 존재하는 경우 (예: 재 호출) — gh pr create 가 fail. 그래도 group complete 자체는 OK 처리.
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('already exists')) {
          console.log(`PR already exists for ${branch} — skip`)
        } else {
          console.error(`gh pr create fail: ${msg}`)
          process.exit(1)
        }
      }
    })
}
