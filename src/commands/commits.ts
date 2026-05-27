import { Command } from 'commander'
import { execFileSync } from 'node:child_process'
import { pushCommit, type CommitRole } from '../lib/api.js'

const VALID_ROLES: ReadonlyArray<CommitRole> = ['test', 'code']

/**
 * git `%cI` 는 committer 로컬 타임존 오프셋(예: `2026-05-27T10:06:27+09:00`)이 붙은
 * ISO 8601 을 반환한다. platform 의 `committed_at` 검증은 `z.iso.datetime()` 으로
 * offset 표기를 거부하고 UTC `Z` 만 허용하므로 (`+09:00` → 422 Invalid ISO datetime),
 * 시각 instant 는 보존한 채 UTC `Z` 형식으로 정규화한다.
 */
export function toUtcIso(gitIsoDate: string): string {
  const d = new Date(gitIsoDate)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`commit timestamp 파싱 실패: "${gitIsoDate}" (ISO 8601 형식 아님)`)
  }
  return d.toISOString()
}

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

      // git log -1 --format=%cI <sha> 로 committer date (ISO 8601, 로컬 오프셋) 추출
      let rawDate: string
      try {
        rawDate = execFileSync('git', ['log', '-1', '--format=%cI', sha], { encoding: 'utf-8' }).trim()
      } catch {
        throw new Error(`git log 로 commit ${sha} 의 timestamp 추출 실패. 잘못된 sha 또는 git repo 아님`)
      }

      // platform 은 UTC `Z` 만 허용 (offset 거부) → 정규화 후 전송
      const committedAt = toUtcIso(rawDate)

      await pushCommit(taskId, sha, committedAt, opts.role as CommitRole)
      console.log(`✓ commit ${sha.slice(0, 8)} 등록 (${opts.role})`)
    })
}
