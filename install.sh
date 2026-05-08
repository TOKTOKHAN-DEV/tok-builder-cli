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

echo "=== preflight ==="
for cmd in node git gh tmux; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "✗ $cmd not found" >&2
    case "$cmd" in
      tmux) echo "  brew install tmux  # macOS" >&2 ;;
      gh)   echo "  brew install gh && gh auth login  # macOS" >&2 ;;
      node) echo "  install Node 20+ via nvm/asdf/brew" >&2 ;;
    esac
    exit 1
  fi
done

if ! gh auth status >/dev/null 2>&1; then
  echo "✗ not logged in to GitHub. Run: gh auth login" >&2
  exit 1
fi
echo "✓ preflight OK"

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

echo "=== installing dependencies ==="
npm install

echo "=== running pj init ==="
npx pj init "$TOKEN" --platform-url "$PLATFORM_URL"

echo ""
echo "✓ Bootstrap complete."
echo "Next: open Claude Code in this directory:"
echo "  cd $SLUG && claude"
