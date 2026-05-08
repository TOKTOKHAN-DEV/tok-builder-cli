#!/usr/bin/env bash
set -euo pipefail

TOKEN="${1:-}"
if [[ -z "$TOKEN" ]]; then
  echo "Usage: curl -fsSL https://raw.githubusercontent.com/toktokhan-dev/pj-cli/main/install.sh | sh -s <token>" >&2
  exit 1
fi
if [[ ! "$TOKEN" =~ ^pjp_apt_ ]]; then
  echo "Invalid token format. Expected pjp_apt_*" >&2
  exit 1
fi

PLATFORM_URL="${PJ_PLATFORM_URL:-https://pj-platform.vercel.app}"

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
parse_field() {
  echo "$META" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);process.stdout.write(o['$1']||'')})"
}
REPO_URL=$(parse_field repo_url)
SLUG=$(parse_field slug)

if [[ -z "$REPO_URL" || -z "$SLUG" ]]; then
  echo "✗ platform did not return repo metadata (repo_url or slug missing)" >&2
  exit 1
fi

echo "=== cloning $REPO_URL ==="
gh repo clone "$REPO_URL" "$SLUG"
cd "$SLUG"

echo "=== installing dependencies ==="
npm install

echo "=== running pj init ==="
npx pj init "$TOKEN" --platform-url "$PLATFORM_URL"

echo ""
echo "✓ Bootstrap complete."
echo "Next: open Claude Code in this directory:"
echo "  cd $SLUG && claude"
