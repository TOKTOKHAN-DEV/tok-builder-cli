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

/** `gh auth status` 출력(stdout+stderr)을 반환. 인증 안 됐으면 null. */
function ghAuthOutput(): string | null {
  try {
    return execSync('gh auth status 2>&1', { encoding: 'utf-8' })
  } catch {
    return null
  }
}

export function runPreflight(): PreflightResult {
  const failures: string[] = []
  const requiredOrg = (process.env.PJ_GH_ORG ?? 'toktokhan-dev').toLowerCase()

  // Node 버전
  const major = parseInt(process.versions.node.split('.')[0]!, 10)
  if (Number.isNaN(major) || major < MIN_NODE_MAJOR) {
    failures.push(
      `Node ${MIN_NODE_MAJOR}+ 필요, 현재 ${process.versions.node}\n` +
        '      → https://nodejs.org 에서 최신 LTS 를 설치하세요. (또는 `brew install node`)',
    )
  }

  // git 설치
  if (!tryCmd('git --version')) {
    failures.push('git 이 설치되어 있지 않습니다\n      → macOS: `xcode-select --install` 를 실행하세요.')
  }

  // gh 설치 (없으면 이후 gh 기반 검사는 무의미하므로 여기서 반환)
  if (!tryCmd('gh --version')) {
    failures.push(
      'GitHub CLI(gh) 가 설치되어 있지 않습니다\n      → macOS: `brew install gh` (설치 안내: https://cli.github.com)',
    )
    return { ok: failures.length === 0, failures }
  }

  // gh 인증
  const authOut = ghAuthOutput()
  if (authOut === null) {
    failures.push(
      'GitHub 계정이 연결(로그인)되어 있지 않습니다\n' +
        '      → 아래 명령을 실행하세요. 브라우저가 열리고, 터미널의 8자리 코드를 입력하면 됩니다:\n' +
        '          gh auth login --web --git-protocol https --scopes "read:org,read:packages"\n' +
        `      → 로그인할 때 '${requiredOrg}' 조직 소속인 회사 GitHub 계정인지 꼭 확인하세요.`,
    )
    return { ok: failures.length === 0, failures }
  }

  // read:packages 권한 (없으면 @toktokhan-dev/* 의존성 설치가 401 로 실패)
  if (!/read:packages/i.test(authOut)) {
    failures.push(
      "GitHub 토큰에 'read:packages' 권한이 없습니다 (이대로면 의존성 설치가 401 오류로 실패)\n" +
        '      → 권한만 추가하세요 (브라우저로 재인증):\n' +
        '          gh auth refresh -h github.com -s read:packages -s read:org',
    )
  }

  // 조직 멤버십
  try {
    const orgs = execSync('gh api user/orgs --jq ".[].login"', { encoding: 'utf-8' })
    const userOrgs = orgs
      .split('\n')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    if (!userOrgs.includes(requiredOrg)) {
      const acct = /account ([A-Za-z0-9_-]+)/i.exec(authOut)?.[1]
      failures.push(
        `현재 GitHub 계정이 '${requiredOrg}' 조직 소속이 아닙니다${acct ? ` (로그인 계정: ${acct})` : ''}\n` +
          '      → 개인 계정으로 로그인했을 수 있습니다. 회사 계정으로 다시 로그인하세요:\n' +
          '          gh auth login --web --git-protocol https --scopes "read:org,read:packages"\n' +
          `      → 회사 계정이 맞다면 관리자에게 '${requiredOrg}' 조직 초대를 요청하세요.`,
      )
    }
  } catch {
    failures.push(
      `'${requiredOrg}' 조직 멤버십 확인에 실패했습니다 (read:org 권한 부족일 수 있음)\n` +
        '      → gh auth refresh -h github.com -s read:packages -s read:org',
    )
  }

  return { ok: failures.length === 0, failures }
}
