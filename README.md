# @toktokhan-dev/tok-builder-cli

`tokb` CLI for **pj-platform** build-plan tracking. Internal to toktokhan-dev.

Implementers receive a one-time `tokb_apt_*` token from the platform UI and use
this CLI to scaffold the workspace, report task progress, attach artifacts, and
resume work after a Claude Code session restart.

## Bootstrap (one-shot)

> **권장:** 실행 전 [install.sh 내용](https://raw.githubusercontent.com/toktokhan-dev/tok-builder-cli/main/install.sh)을 직접 확인하세요.

```bash
curl -fsSL https://raw.githubusercontent.com/toktokhan-dev/tok-builder-cli/main/install.sh | sh -s tokb_apt_<token>
```

The installer runs preflight (`node` ≥24, `git`, `gh`, `tmux` + `gh auth`),
fetches project metadata from `/api/agent/auth/verify`, validates the
platform-supplied slug + repo URL, clones the project repo, writes `~/.npmrc`
so `npm install` can authenticate to the private GitHub Packages registry,
runs `npm install`, and finalizes `.tokb/config.json` via `tokb init`.

## Manual install

```bash
pnpm add -g @toktokhan-dev/tok-builder-cli
# or: npm install -g @toktokhan-dev/tok-builder-cli
```

(Requires `~/.npmrc` with `@toktokhan-dev:registry=https://npm.pkg.github.com`
and a `_authToken=` line for `npm.pkg.github.com`. The bootstrap installer
above writes this for you automatically; for manual installs, run
`gh auth token` and put it in `~/.npmrc` yourself.)

## Commands

| Command | Purpose |
|---|---|
| `tokb login <token>` | Save token to `.tokb/config.json` (mode 0600). |
| `tokb init <token>` | Preflight + verify + persist project metadata (slug, repo/vercel/supabase URLs). |
| `tokb task progress <id> <status> [--note]` | Report task status (`pending`, `in_progress`, `blocked`, `done`, `skipped`). |
| `tokb task done <id>` | Shortcut for `progress <id> done`. |
| `tokb task artifact add <id> <path> [--kind]` | Attach an artifact (`spec`, `code`, `doc`, `config`, `test`, `other`). |
| `tokb plan upsert <jsonPath>` | Bulk upsert tasks for the current plan. |
| `tokb plan task-add <jsonPath>` | Add a single task to the current plan. |
| `tokb run accept <runId>` | Accept a `pending_review` run. |
| `tokb run complete <runId> [--status] [--error]` | Mark a run `completed` or `failed`. |
| `tokb run state` | Print current plan/run/tasks JSON. |
| `tokb phase status` | Print current phase + done/total task count. |
| `tokb resume [--auto-push]` | Stop-hook context (plan status, in-progress tasks, git status). `--auto-push` is reserved for v1.x. |

## Configuration

Per-project state lives in `.tokb/config.json` (chmod `0600`) with these fields:

- `push_token` (`tokb_apt_*`)
- `project_id`, `plan_id` (UUIDs)
- `repo_url`, `vercel_url`, `supabase_url` (`https://` only)
- `platform_base_url` (defaults to `https://pj-platform.vercel.app`, must be
  `https://`)

## Releases

Push to `main` with a `package.json` change triggers
`.github/workflows/publish.yml` → npm publish to GitHub Packages.

For a new release, bump the `version` field in `package.json` and merge to
`main`. Same-version republishes are not allowed.

## Migration from `pj` (0.1.x → 0.2.0)

- bin name: `pj` → `tokb` (every command, replace `pj <subcmd>` with `tokb <subcmd>`)
- token prefix: `pjp_apt_*` → `tokb_apt_*` (re-issue tokens via the platform UI; old tokens are no longer accepted)
- config dir: `.pj/config.json` → `.tokb/config.json` (rename the directory or run `tokb init` again)
- env var: `PJ_PLATFORM_URL` is still honored as a fallback; prefer `TOKB_PLATFORM_URL`
