# @toktokhan-dev/tok-builder-cli

`pj` CLI for **pj-platform** build-plan tracking. Internal to toktokhan-dev.

Implementers receive a one-time `pjp_apt_*` token from the platform UI and use this
CLI to scaffold the workspace, report task progress, attach artifacts, and resume
work after a Claude Code session restart.

## Bootstrap (one-shot)

```bash
curl -fsSL https://raw.githubusercontent.com/toktokhan-dev/tok-builder-cli/main/install.sh | sh -s pjp_apt_<token>
```

The installer runs preflight (`node`, `git`, `gh`, `tmux` + `gh auth`), fetches
project metadata from `/api/agent/auth/verify`, validates the platform-supplied
slug + repo URL, clones the project repo, runs `npm install`, and finalizes
`.pj/config.json` via `pj init`.

## Manual install

```bash
npm install -g @toktokhan-dev/tok-builder-cli
```

(Requires authenticated access to the toktokhan-dev GitHub Packages registry —
see `~/.npmrc` setup in the platform docs.)

## Commands

| Command | Purpose |
|---|---|
| `pj login <token>` | Save token to `.pj/config.json` (mode 0600). |
| `pj init <token>` | Preflight + verify + persist project metadata (slug, repo/vercel/supabase URLs). |
| `pj task progress <id> <status> [--note]` | Report task status (`pending`, `in_progress`, `blocked`, `done`, `skipped`). |
| `pj task done <id>` | Shortcut for `progress <id> done`. |
| `pj task artifact add <id> <path> [--kind]` | Attach an artifact (`spec`, `code`, `doc`, `config`, `test`, `other`). |
| `pj plan upsert <jsonPath>` | Bulk upsert tasks for the current plan. |
| `pj plan task-add <jsonPath>` | Add a single task to the current plan. |
| `pj run accept <runId>` | Accept a `pending_review` run. |
| `pj run complete <runId> [--status] [--error]` | Mark a run `completed` or `failed`. |
| `pj run state` | Print current plan/run/tasks JSON. |
| `pj phase status` | Print current phase + done/total task count. |
| `pj resume [--auto-push]` | Stop-hook context (plan status, in-progress tasks, git status). `--auto-push` is reserved for v1.x. |

## Configuration

Per-project state lives in `.pj/config.json` (chmod `0600`) with these fields:

- `push_token` (`pjp_apt_*`)
- `project_id`, `plan_id` (UUIDs)
- `repo_url`, `vercel_url`, `supabase_url` (`https://` only)
- `platform_base_url` (defaults to `https://pj-platform.vercel.app`, must be
  `https://`)

## Releases

Push to `main` with a `package.json` change triggers
`.github/workflows/publish.yml` → npm publish to GitHub Packages.

For a new release, bump the `version` field in `package.json` and merge to
`main`. Same-version republishes are not allowed.
