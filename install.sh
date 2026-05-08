#!/usr/bin/env bash
set -euo pipefail

TOKEN="${1:-}"
if [[ -z "$TOKEN" ]]; then
  echo "Usage: curl -fsSL https://raw.githubusercontent.com/toktokhan-dev/tok-builder-cli/main/install.sh | sh -s <token>" >&2
  exit 1
fi
if [[ ! "$TOKEN" =~ ^pjp_apt_[A-Za-z0-9_-]+$ ]]; then
  echo "Invalid token format. Expected pjp_apt_<base64url>" >&2
  exit 1
fi

PLATFORM_URL="${PJ_PLATFORM_URL:-https://pj-platform.vercel.app}"
if [[ ! "$PLATFORM_URL" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?(/.*)?$ ]]; then
  echo "Invalid PJ_PLATFORM_URL — must be https://<host>" >&2
  exit 1
fi

MIN_NODE_MAJOR=24

echo "=== preflight ==="
for cmd in node git gh tmux; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "✗ $cmd not found" >&2
    case "$cmd" in
      tmux) echo "  brew install tmux  # macOS" >&2 ;;
      gh)   echo "  brew install gh && gh auth login  # macOS" >&2 ;;
      node) echo "  install Node ${MIN_NODE_MAJOR}+ via nvm/asdf/brew" >&2 ;;
    esac
    exit 1
  fi
done

NODE_VER=$(node -v)
if [[ ! "$NODE_VER" =~ ^v([0-9]+)\. ]]; then
  echo "✗ failed to parse Node version: $NODE_VER" >&2
  exit 1
fi
NODE_MAJOR="${BASH_REMATCH[1]}"
if (( NODE_MAJOR < MIN_NODE_MAJOR )); then
  echo "✗ Node >=${MIN_NODE_MAJOR} required, got ${NODE_VER}" >&2
  echo "  upgrade via nvm/asdf/brew, then retry" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "✗ not logged in to GitHub. Run: gh auth login" >&2
  exit 1
fi
echo "✓ preflight OK (Node ${NODE_VER})"

echo "=== fetching project metadata from platform ==="
META=$(curl -fsSL -H "Authorization: Bearer $TOKEN" "$PLATFORM_URL/api/agent/auth/verify")

# Parse fields via process.argv (no shell interpolation into JS source).
parse_field() {
  PJ_META="$META" node -e '
    const o = JSON.parse(process.env.PJ_META);
    process.stdout.write(String(o[process.argv[1]] ?? ""));
  ' "$1"
}

REPO_URL=$(parse_field repo_url)
SLUG=$(parse_field slug)

# Validate platform-supplied values before using them in shell/filesystem.
if [[ ! "$SLUG" =~ ^[a-zA-Z0-9_-]+$ ]] || [[ ${#SLUG} -gt 64 ]]; then
  echo "✗ platform returned invalid slug" >&2
  exit 1
fi
if [[ ! "$REPO_URL" =~ ^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(\.git)?$ ]]; then
  echo "✗ platform returned invalid repo_url" >&2
  exit 1
fi

echo "=== cloning $REPO_URL ==="
gh repo clone -- "$REPO_URL" "$SLUG"
cd "./$SLUG"

# Configure npm auth for GitHub Packages (private registry for @toktokhan-dev/*).
# Without this, `npm install` of any @toktokhan-dev/* dep fails with 401.
echo "=== configuring ~/.npmrc for GitHub Packages ==="
GH_TOKEN_VALUE=$(gh auth token | tr -d '\r\n[:space:]')
if [[ -z "$GH_TOKEN_VALUE" ]]; then
  echo "✗ failed to read gh auth token" >&2
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
echo "✓ ~/.npmrc configured (mode 0600)"

echo "=== installing dependencies ==="
npm install

echo "=== running pj init ==="
npx pj init "$TOKEN" --platform-url "$PLATFORM_URL"

echo ""
echo "✓ Bootstrap complete."
echo "Next: open Claude Code in this directory:"
echo "  cd $SLUG && claude"
