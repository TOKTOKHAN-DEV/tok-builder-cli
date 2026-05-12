#!/usr/bin/env bash
set -euo pipefail

MIN_NODE_MAJOR=24

TOKEN="${1:-}"
if [[ -z "$TOKEN" ]]; then
  echo "사용법: curl -fsSL https://raw.githubusercontent.com/toktokhan-dev/tok-builder-cli/main/install.sh | sh -s <토큰>" >&2
  exit 1
fi
if [[ ! "$TOKEN" =~ ^tokb_apt_[A-Za-z0-9_-]+$ ]]; then
  echo "토큰 형식 오류. tokb_apt_<base64url> 필요" >&2
  exit 1
fi

# 운영 main 도메인. develop / 다른 환경에서 빌드 시작 시 platform 이 응답에
# TOKB_PLATFORM_URL 을 inline prefix 로 전달하므로, default 는 운영용 fallback.
PLATFORM_URL="${TOKB_PLATFORM_URL:-${PJ_PLATFORM_URL:-https://pj-platform-nine.vercel.app}}"
if [[ ! "$PLATFORM_URL" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?(/.*)?$ ]]; then
  echo "TOKB_PLATFORM_URL 형식 오류 — https://<host> 형식이어야 합니다" >&2
  exit 1
fi

echo "=== 사전 점검 ==="
for cmd in node git gh tmux; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "✗ $cmd 가 설치되어 있지 않습니다" >&2
    case "$cmd" in
      tmux) echo "  brew install tmux  # macOS" >&2 ;;
      gh)   echo "  brew install gh && gh auth login  # macOS" >&2 ;;
      node) echo "  Node ${MIN_NODE_MAJOR}+ 를 nvm/asdf/brew 로 설치해주세요" >&2 ;;
    esac
    exit 1
  fi
  echo "✓ $cmd"
done

NODE_VER=$(node -v)
if [[ ! "$NODE_VER" =~ ^v([0-9]+)\. ]]; then
  echo "✗ Node 버전 파싱 실패: $NODE_VER" >&2
  exit 1
fi
NODE_MAJOR="${BASH_REMATCH[1]}"
if (( NODE_MAJOR < MIN_NODE_MAJOR )); then
  echo "✗ Node ${MIN_NODE_MAJOR}+ 필요, 현재 ${NODE_VER}" >&2
  echo "  nvm/asdf/brew 로 업그레이드 후 다시 실행해주세요" >&2
  exit 1
fi
echo "✓ Node 버전 ${NODE_VER} (>=${MIN_NODE_MAJOR})"

# Ensure pnpm is available. Node 16.10+ ships corepack; we activate the project's
# packageManager via corepack so dev/lockfile work even on a fresh machine.
if ! command -v pnpm >/dev/null 2>&1; then
  echo "  pnpm 없음 — corepack 으로 활성화 중..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@latest --activate >/dev/null 2>&1 || {
      echo "✗ corepack 으로 pnpm 활성화 실패. 다음 명령으로 직접 설치: npm i -g pnpm" >&2
      exit 1
    }
  else
    echo "✗ pnpm 과 corepack 모두 없음. 다음 명령으로 설치: npm i -g pnpm" >&2
    exit 1
  fi
fi
echo "✓ pnpm $(pnpm -v)"

if ! gh auth status >/dev/null 2>&1; then
  echo "✗ GitHub 로그인 안 됨. 다음 명령으로 로그인: gh auth login" >&2
  exit 1
fi
echo "✓ gh 인증"
echo "✓ 사전 점검 완료"

echo "=== platform 에서 프로젝트 정보 조회 ==="
META=$(curl -fsSL -H "Authorization: Bearer $TOKEN" "$PLATFORM_URL/api/agent/auth/verify")

# verify 응답이 JSON 인지 빠르게 확인 (HTML error page / 빈 응답 등 감지).
# 사용자에게 정확한 진단 메시지 노출 — 후속 node parse 실패 시 stack trace 만
# 보여서 원인 파악 어려운 사고 예방.
if [[ -z "$META" ]]; then
  echo "✗ platform verify 응답이 비어 있음. PLATFORM_URL 또는 토큰을 확인하세요." >&2
  echo "    PLATFORM_URL=$PLATFORM_URL" >&2
  exit 1
fi
if [[ "$META" != \{* ]]; then
  echo "✗ platform verify 응답이 JSON 형식이 아님 (HTML 오류 페이지 가능):" >&2
  echo "$META" | head -c 200 >&2
  echo "" >&2
  exit 1
fi

# Parse fields via process.argv (no shell interpolation into JS source).
parse_field() {
  TOKB_META="$META" node -e '
    try {
      const o = JSON.parse(process.env.TOKB_META);
      process.stdout.write(String(o[process.argv[1]] ?? ""));
    } catch (e) {
      process.stderr.write("✗ platform 응답 JSON 파싱 실패: " + e.message + "\n");
      process.exit(1);
    }
  ' "$1"
}

REPO_URL=$(parse_field repo_url)
SLUG=$(parse_field slug)

# Validate platform-supplied values before using them in shell/filesystem.
if [[ ! "$SLUG" =~ ^[a-zA-Z0-9_-]+$ ]] || [[ ${#SLUG} -gt 64 ]]; then
  echo "✗ platform 의 slug 응답이 유효하지 않습니다" >&2
  exit 1
fi
if [[ ! "$REPO_URL" =~ ^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(\.git)?$ ]]; then
  echo "✗ platform 의 repo_url 응답이 유효하지 않습니다" >&2
  exit 1
fi

echo "=== $REPO_URL 클론 ==="
gh repo clone -- "$REPO_URL" "$SLUG"
cd "./$SLUG"

# Configure npm auth for GitHub Packages (private registry for @toktokhan-dev/*).
# Without this, `npm install` of any @toktokhan-dev/* dep fails with 401.
echo "=== GitHub Packages 용 ~/.npmrc 설정 ==="
GH_TOKEN_VALUE=$(gh auth token | tr -d '\r\n[:space:]')
if [[ -z "$GH_TOKEN_VALUE" ]]; then
  echo "✗ gh auth token 읽기 실패" >&2
  exit 1
fi
NPMRC="$HOME/.npmrc"
touch "$NPMRC"
chmod 600 "$NPMRC"
# Idempotent: drop any existing @toktokhan-dev scope or npm.pkg.github.com auth lines, then append fresh.
TMP_NPMRC=$(mktemp)
grep -v -E '^(@toktokhan-dev:registry=|//npm\.pkg\.github\.com/:_authToken=)' "$NPMRC" > "$TMP_NPMRC" || true
mv "$TMP_NPMRC" "$NPMRC"
{
  echo "@toktokhan-dev:registry=https://npm.pkg.github.com"
  echo "//npm.pkg.github.com/:_authToken=$GH_TOKEN_VALUE"
} >> "$NPMRC"
chmod 600 "$NPMRC"
unset GH_TOKEN_VALUE
echo "✓ ~/.npmrc 설정 완료 (권한 0600)"

echo "=== 의존성 설치 (pnpm) ==="
pnpm install

echo "=== tokb init 실행 ==="
pnpm exec tokb init "$TOKEN" --platform-url "$PLATFORM_URL"
unset TOKEN

echo ""
echo "✓ 부트스트랩 완료."
echo "다음 단계: 이 디렉토리에서 Claude Code 열기"
echo "  cd $SLUG && claude"
