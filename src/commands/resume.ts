import { Command } from 'commander'
import { execSync } from 'node:child_process'

import { getProjectState, pushTaskProgress, type ProjectState } from '../lib/api.js'
import { requireField } from '../lib/config.js'

function safeGitStatus(): string {
  try {
    return execSync('git status --short', { encoding: 'utf-8' })
  } catch {
    return '(git unavailable)'
  }
}

function formatContext(state: ProjectState, inProgressLen: number): string {
  const lines: string[] = []
  lines.push('=== Resume context ===')
  lines.push(`Plan status: ${state.plan?.status ?? '(none)'}`)
  lines.push(`Current phase: ${state.plan?.current_phase_id ?? '(none)'}`)
  lines.push(`In-progress tasks (${inProgressLen}):`)
  const inProgress = state.tasks.filter((t) => t.status === 'in_progress')
  for (const t of inProgress) {
    const safeTitle = t.title.replace(/[\x00-\x08\x0b-\x1f\x7f]|\x1b\[[0-9;]*m/g, '')
    lines.push(`  - ${t.id}: ${safeTitle}`)
  }
  lines.push('')
  lines.push('Local git status:')
  lines.push(safeGitStatus() || '(clean)')
  return lines.join('\n')
}

export function resumeCommand(program: Command): void {
  program
    .command('resume')
    .description('Print resume context (plan status, in-progress tasks, git status)')
    .option('--auto-push', 'silently push in_progress task progress to platform (Stop hook 용)')
    .option('--hook-context', 'wrap output as SessionStart hookSpecificOutput JSON (SessionStart hook 용)')
    .action(async (opts: { autoPush?: boolean; hookContext?: boolean }) => {
      // config / network 실패 시 silent fail — hook 실행 중 세션 흐름 방해 X
      let state: ProjectState
      try {
        const projectId = await requireField('project_id')
        state = await getProjectState(projectId)
      } catch {
        if (opts.hookContext) {
          // 빈 context 라도 JSON 응답 — Claude Code 가 stdout 파싱 fail 안 하게
          process.stdout.write(JSON.stringify({
            hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '' },
          }))
        }
        return
      }

      const inProgress = state.tasks.filter((t) => t.status === 'in_progress')

      if (opts.autoPush) {
        // spec 의 --auto-push 의도: in_progress task progress best-effort push, idempotent, silent
        for (const t of inProgress) {
          try {
            await pushTaskProgress(t.id, 'in_progress')
          } catch {
            // silent — 무리하지 않음
          }
        }
        return
      }

      const context = formatContext(state, inProgress.length)

      if (opts.hookContext) {
        // SessionStart hook: stdout 의 JSON 이 claude system prompt 의 additionalContext 로 들어감
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: context,
          },
        }))
        return
      }

      // 기본 동작: 사람 가독 context print
      console.log(context)
    })
}
