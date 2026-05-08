import { execSync } from 'node:child_process'

export type PreflightResult = { ok: boolean; failures: string[] }

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

  if (!tryCmd('node --version')) failures.push('node not found')
  if (!tryCmd('git --version')) failures.push('git not found')
  if (!tryCmd('gh --version')) failures.push('gh CLI not found — `brew install gh`')
  if (!tryCmd('tmux -V')) failures.push('tmux not found — required for omc team. `brew install tmux`')

  if (!tryCmd('gh auth status')) {
    failures.push('not logged in to GitHub. Run `gh auth login`')
  } else {
    try {
      const orgs = execSync('gh api user/orgs --jq ".[].login"', { encoding: 'utf-8' })
      const requiredOrg = process.env.PJ_GH_ORG ?? 'toktokhan-dev'
      if (!orgs.split('\n').map((s) => s.trim()).filter(Boolean).includes(requiredOrg)) {
        failures.push(`not a member of ${requiredOrg} GitHub org`)
      }
    } catch {
      failures.push('failed to check GitHub org membership')
    }
  }

  return { ok: failures.length === 0, failures }
}
