import { Command } from 'commander'
import { execFileSync } from 'node:child_process'
import { pushCommit, type CommitRole } from '../lib/api.js'

const VALID_ROLES: ReadonlyArray<CommitRole> = ['test', 'code']

export function commitsCommand(program: Command): void {
  const commits = program.command('commits').description('worker commit 추적 (TDD 검증용)')

  commits
    .command('push <taskId> <sha>')
    .description('git commit timestamp 를 platform 에 등록 (TDD 강제용)')
    .requiredOption('--role <role>', `'test' 또는 'code'`)
    .action(async (taskId: string, sha: string, opts: { role: string }) => {
      if (!VALID_ROLES.includes(opts.role as CommitRole)) {
        throw new Error(`--role 은 'test' 또는 'code' 만 허용. 받음: ${opts.role}`)
      }

      // git log -1 --format=%cI <sha> 로 committer date (ISO 8601) 추출
      let committedAt: string
      try {
        committedAt = execFileSync('git', ['log', '-1', '--format=%cI', sha], { encoding: 'utf-8' }).trim()
      } catch {
        throw new Error(`git log 로 commit ${sha} 의 timestamp 추출 실패. 잘못된 sha 또는 git repo 아님`)
      }

      await pushCommit(taskId, sha, committedAt, opts.role as CommitRole)
      console.log(`✓ commit ${sha.slice(0, 8)} 등록 (${opts.role})`)
    })
}
