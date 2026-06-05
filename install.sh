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
# (환경 분리는 platform 의 req.nextUrl.origin 이 담당 — fallback 은 수동 실행 시 안전망.)
PLATFORM_URL="${TOKB_PLATFORM_URL:-${PJ_PLATFORM_URL:-https://builder.toktokhan.dev}}"
if [[ ! "$PLATFORM_URL" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?(/.*)?$ ]]; then
  echo "TOKB_PLATFORM_URL 형식 오류 — https://<host> 형식이어야 합니다" >&2
  exit 1
fi

REQUIRED_ORG="${PJ_GH_ORG:-toktokhan-dev}"

echo "=== 사전 점검 ==="
# 막힌 항목을 모아서 한 번에 안내한다 (하나 고치고 재실행하는 반복을 줄이기 위함).
FAILS=()

# 1) 필수 도구 설치 여부
for cmd in node git gh; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "✓ $cmd"
  else
    case "$cmd" in
      node) FAILS+=("Node.js 가 설치되어 있지 않습니다.
      → https://nodejs.org 에서 LTS(${MIN_NODE_MAJOR}+) 를 받아 설치하세요. (또는 'brew install node')
      → 설치 후 터미널을 새로 열고 같은 명령을 다시 붙여넣으세요.") ;;
      git)  FAILS+=("git 이 설치되어 있지 않습니다.
      → macOS: 'xcode-select --install' 를 실행하고 안내를 따르세요.") ;;
      gh)   FAILS+=("GitHub CLI(gh) 가 설치되어 있지 않습니다.
      → macOS: 'brew install gh' 를 실행하세요. (설치 안내: https://cli.github.com)") ;;
    esac
  fi
done

# 2) Node 버전 (node 가 있을 때만)
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v)
  if [[ "$NODE_VER" =~ ^v([0-9]+)\. ]]; then
    if (( ${BASH_REMATCH[1]} < MIN_NODE_MAJOR )); then
      FAILS+=("Node 버전이 낮습니다 (현재 ${NODE_VER}, 필요 ${MIN_NODE_MAJOR}+).
      → https://nodejs.org 에서 최신 LTS 를 설치하세요. (또는 'brew upgrade node')")
    else
      echo "✓ Node 버전 ${NODE_VER} (>=${MIN_NODE_MAJOR})"
    fi
  else
    FAILS+=("Node 버전 확인 실패: ${NODE_VER}")
  fi
fi

# 3) GitHub 연결 — 인증 / 권한(scope) / 조직 멤버십 (gh 가 있을 때만)
if command -v gh >/dev/null 2>&1; then
  # gh auth status 를 한 번만 호출해 인증 여부(exit code) + 출력(scope/계정 파싱) 동시 확보.
  if ! AUTH_OUT=$(gh auth status 2>&1); then
    FAILS+=("GitHub 계정이 연결(로그인)되어 있지 않습니다.
      → 아래 명령을 복사해 실행하세요. 브라우저가 열리고, 터미널에 표시된 8자리 코드를 입력하면 됩니다:
          gh auth login --web --git-protocol https --scopes \"read:org,read:packages\"
      → 로그인할 때 '${REQUIRED_ORG}' 조직 소속인 회사 GitHub 계정인지 꼭 확인하세요.")
  else
    echo "✓ gh 인증"
    # read:packages 권한이 없으면 뒤에서 pnpm install(@toktokhan-dev/*) 이 401 로 실패한다 — 미리 차단.
    # write:packages 는 read:packages 를 포함하므로 둘 중 하나만 있어도 통과.
    if ! printf '%s' "$AUTH_OUT" | grep -qiE "(read|write):packages"; then
      FAILS+=("GitHub 토큰에 'read:packages' 권한이 없습니다. (이대로 진행하면 잠시 뒤 의존성 설치가 401 오류로 실패합니다)
      → 권한만 추가하면 됩니다 (브라우저로 재인증):
          gh auth refresh -h github.com -s read:packages -s read:org")
    fi
    # 조직 멤버십 (read:org 권한이 있어야 조회 가능 — 조회 실패 시 위 scope 안내로 커버됨)
    if ORGS=$(gh api user/orgs --jq '.[].login' 2>/dev/null); then
      REQ_LC=$(printf '%s' "$REQUIRED_ORG" | tr '[:upper:]' '[:lower:]')
      if ! printf '%s' "$ORGS" | tr '[:upper:]' '[:lower:]' | grep -qx "$REQ_LC"; then
        CUR_ACCT=$(printf '%s' "$AUTH_OUT" | grep -oiE "account [A-Za-z0-9_-]+" | head -1 | awk '{print $2}')
        FAILS+=("현재 GitHub 계정이 '${REQUIRED_ORG}' 조직 소속이 아닙니다${CUR_ACCT:+ (로그인 계정: ${CUR_ACCT})}.
      → 개인 계정으로 로그인했을 수 있습니다. 회사 계정으로 다시 로그인하세요:
          gh auth login --web --git-protocol https --scopes \"read:org,read:packages\"
      → 회사 계정이 맞다면 관리자에게 '${REQUIRED_ORG}' 조직 초대를 요청하세요.")
      fi
    fi
  fi
fi

# 종합 — 막힌 게 있으면 전부 안내하고 중단
if (( ${#FAILS[@]} > 0 )); then
  {
    echo ""
    echo "✗ 사전 점검에서 ${#FAILS[@]}건이 막혔습니다. 아래를 해결한 뒤 같은 명령을 다시 붙여넣어 주세요:"
    echo ""
    n=1
    for f in "${FAILS[@]}"; do
      echo "  [$n] $f"
      echo ""
      n=$((n + 1))
    done
    echo "  해결이 어려우면 위 내용을 그대로 복사해 빌드 담당자에게 전달해 주세요."
  } >&2
  exit 1
fi

# pnpm 보장 (검사 통과 후 — 실제 조치). Node 16.10+ 의 corepack 으로 packageManager 활성화.
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
PROJECT_ID=$(parse_field project_id)

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

echo "=== Supabase 환경변수 주입 (.env.local) ==="
# build repo 의 로컬 .env.local 에 Supabase keys 기록.
# GitHub commit X (.gitignore 의 .env*.local 패턴으로 강제 차단).
ENV_RESPONSE=$(curl -fsSL \
  -H "Authorization: Bearer $TOKEN" \
  "${PLATFORM_URL}/api/agent/projects/${PROJECT_ID}/env" 2>&1) || true

if [[ -z "$ENV_RESPONSE" ]] || [[ "$ENV_RESPONSE" != \{* ]]; then
  echo "⚠  .env.local fetch 실패 — omc 가 supabase 명령 실행 시 막힐 수 있음 (빌드는 계속)" >&2
  echo "   응답: $(echo "$ENV_RESPONSE" | head -c 100)" >&2
else
  # Node 로 JSON parsing — jq 의존성 없이 기존 패턴 유지
  parse_env_field() {
    TOKB_ENV="$ENV_RESPONSE" node -e '
      try {
        const o = JSON.parse(process.env.TOKB_ENV);
        process.stdout.write(String(o[process.argv[1]] ?? ""));
      } catch (e) {
        process.stderr.write("env JSON parse 실패: " + e.message + "\n");
        process.exit(1);
      }
    ' "$1"
  }
  SUPABASE_URL=$(parse_env_field supabase_url)
  ANON_KEY=$(parse_env_field supabase_anon_key)
  SERVICE_ROLE_KEY=$(parse_env_field supabase_service_role_key)

  if [[ -z "$SUPABASE_URL" ]] || [[ -z "$ANON_KEY" ]] || [[ -z "$SERVICE_ROLE_KEY" ]]; then
    echo "⚠  .env.local: Supabase keys 미프로비저닝 — platform 에서 설정 후 재실행" >&2
  else
    # 현재 디렉터리 = clone 후 cd 된 build repo root
    {
      printf '%s\n' "NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}"
      printf '%s\n' "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}"
      printf '%s\n' "SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
    } > .env.local
    chmod 600 .env.local
    unset SUPABASE_URL ANON_KEY SERVICE_ROLE_KEY
    echo "✓ .env.local 작성 완료 (로컬 only, 권한 0600)"
  fi
fi
unset ENV_RESPONSE

echo "=== tokb init 실행 ==="
pnpm exec tokb init "$TOKEN" --platform-url "$PLATFORM_URL"
unset TOKEN

echo ""
echo "✓ 부트스트랩 완료."
echo ""
echo "다음 단계: 이 디렉토리에서 Claude Code 열기"
echo "  cd $SLUG && claude"
