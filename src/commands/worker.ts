import { Command } from 'commander'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// ⚠️ pj-platform 의 lib/build-plan/constants.ts TDD_BYPASS_PHASES 와 동기 필수.
// phase set 변경 시 양쪽 같이 업데이트. (cli 와 platform 의 drift 방지)
const TDD_BYPASS_PHASES = new Set<string>([
  'design-spec',
  'infra-setup',
  'qa',
  'release',
  'handoff',
])

const WorkerTaskSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  phase_slug: z.string(),
  group_key: z.string(),
  domain: z.string().nullable(),
  description: z.string(),
  acceptance_criteria: z.string().nullable(),
  test_file_path: z.string().nullable(),
})

const PlanSchema = z.object({
  tasks: z.array(WorkerTaskSchema),
})

export interface WorkerTask {
  id: string
  client_id: string
  phase_slug: string
  group_key: string
  domain: string | null
  description: string
  acceptance_criteria: string | null
  test_file_path: string | null
}

export interface BuildWorkerPromptArgs {
  groupKey: string
  phaseSlug: string
  worktreePath: string
  tasks: WorkerTask[]
}

export function buildWorkerPrompt(args: BuildWorkerPromptArgs): string {
  const { groupKey, phaseSlug, worktreePath, tasks } = args
  const isBypass = TDD_BYPASS_PHASES.has(phaseSlug)

  const tddSection = isBypass
    ? `## TDD 흐름 — bypass (phase_slug: ${phaseSlug})

이 phase 의 task 는 산출물이 md/config/수동 점검 영역. **test 작성 X**, mechanical 검증 (file 존재 / 형식 / grep) 으로 충분.

각 task 진행:
1. \`tokb task progress <uuid> in_progress\`
2. 산출물 작성 (md / config / spec)
3. mechanical 검증 (예: ls / grep / schema check)
4. commit (\`git commit -m "feat({group}): {title}"\`)
5. \`tokb task progress <uuid> done --note "mechanical N/N 통과"\`
`
    : `## TDD 흐름 — enforce (phase_slug: ${phaseSlug})

각 task 마다 TDD red→green:

1. \`tokb task progress <uuid> in_progress\`
2. test 파일 작성 (task.test_file_path 에) → red 확인
3. test commit (\`git commit -m "test(...): ... (red)"\`)
4. \`tokb commits push <task_id> <test_sha> --role test\`
5. 코드 작성 → green 확인
6. code commit (\`git commit -m "feat(...): ..."\`)
7. \`tokb commits push <task_id> <code_sha> --role code\`
8. \`tokb task progress <uuid> done --commit-sha-test <test_sha> --commit-sha-code <code_sha> --note "mechanical N/N + semantic M/M 통과"\`
`

  const taskLines = tasks
    .map((t) => {
      const ac = t.acceptance_criteria ?? '- (acceptance_criteria 없음)'
      const tf = t.test_file_path ? `\n   test_file_path: ${t.test_file_path}` : ''
      return `### ${t.client_id} (uuid: ${t.id})

${t.description}${tf}

acceptance_criteria:
${ac}
`
    })
    .join('\n---\n\n')

  return `# Worker subagent prompt — group ${groupKey} (phase ${phaseSlug})

## 작업 위치

- worktree: ${worktreePath}
- branch: feat/${groupKey}
- cd 후 작업 진행

## bootstrap

1. \`cd ${worktreePath}\`
2. leader workspace 의 \`.env.local\` symlink (\`TOKB_PUSH_TOKEN\` 공유):
   \`\`\`bash
   LEADER_ROOT=$(git rev-parse --show-superproject-working-tree 2>/dev/null || \\
                 dirname "$(dirname "$(dirname "$(pwd)")")")
   ln -sf "\${LEADER_ROOT}/.env.local" .env.local
   \`\`\`
3. \`pnpm install --frozen-lockfile\`
4. \`pnpm exec tokb preflight\`

## task 목록

${taskLines}

${tddSection}

## 완료 시

자기 group 의 모든 task done 후 controller 에 보고 — _자체 호출 X_. controller 가 사용자 한 줄 confirm 후 \`tokb group complete ${groupKey}\` 호출.

## Report Format

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED
- 완료 task: id 리스트
- 각 task 의 결과 (mechanical 통과 N/N + semantic M/M)
- self-review 발견
`
}

export function workerCommand(program: Command): void {
  const worker = program.command('worker').description('worker subagent prompt 생성')

  worker
    .command('prompt')
    .description('group / phase 별 worker subagent prompt 자동 생성 (.tokb/plan.json read)')
    .requiredOption('--group <groupKey>', 'group_key')
    .requiredOption('--phase <phaseSlug>', 'phase_slug')
    .requiredOption('--worktree <path>', 'worktree absolute path')
    .action((opts: { group: string; phase: string; worktree: string }) => {
      const planPath = path.join(process.cwd(), '.tokb', 'plan.json')
      if (!existsSync(planPath)) {
        console.error('✗ .tokb/plan.json 없음 — Phase 1 (tokb-generate-build-plan) 먼저 진행')
        process.exit(1)
      }
      const rawPlan: unknown = JSON.parse(readFileSync(planPath, 'utf-8'))
      const parseResult = PlanSchema.safeParse(rawPlan)
      if (!parseResult.success) {
        console.error('✗ .tokb/plan.json schema 오류:', parseResult.error.message)
        process.exit(1)
      }
      const plan = parseResult.data
      const tasks = plan.tasks.filter(
        (t) => t.phase_slug === opts.phase && t.group_key === opts.group,
      )
      if (tasks.length === 0) {
        console.error(`✗ phase=${opts.phase} group=${opts.group} 의 task 없음`)
        process.exit(1)
      }
      const prompt = buildWorkerPrompt({
        groupKey: opts.group,
        phaseSlug: opts.phase,
        worktreePath: opts.worktree,
        tasks,
      })
      process.stdout.write(prompt)
    })
}
