import { execSync } from 'node:child_process'

export type PreflightResult = { ok: boolean; failures: string[] }

export const MIN_NODE_MAJOR = 24

function tryCmd(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function runPreflight(): PreflightResult {
  const failures: string[] = []

  const major = parseInt(process.versions.node.split('.')[0]!, 10)
  if (Number.isNaN(major) || major < MIN_NODE_MAJOR) {
    failures.push(`Node ${MIN_NODE_MAJOR}+ 필요, 현재 ${process.versions.node}`)
  }

  if (!tryCmd('git --version')) failures.push('git 설치 안 됨')
  if (!tryCmd('gh --version')) failures.push('gh CLI 설치 안 됨 — `brew install gh`')
  if (process.env.PJ_REQUIRE_TMUX === '1' && !tryCmd('tmux -V')) {
    failures.push('tmux 설치 안 됨 — `brew install tmux`')
  }

  if (!tryCmd('gh auth status')) {
    failures.push('GitHub 로그인 안 됨. `gh auth login` 실행')
  } else {
    try {
      const orgs = execSync('gh api user/orgs --jq ".[].login"', { encoding: 'utf-8' })
      // GitHub org login 은 case-insensitive (실제 응답이 `TOKTOKHAN-DEV` 대문자)
      const requiredOrg = (process.env.PJ_GH_ORG ?? 'toktokhan-dev').toLowerCase()
      const userOrgs = orgs
        .split('\n')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
      if (!userOrgs.includes(requiredOrg)) {
        failures.push(`${requiredOrg} GitHub org 멤버 아님`)
      }
    } catch {
      failures.push('GitHub org 멤버십 확인 실패')
    }
  }

  return { ok: failures.length === 0, failures }
}
