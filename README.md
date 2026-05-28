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
npm install -g @toktokhan-dev/tok-builder-cli
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

## 새 명령 (v0.6.0)

시범 4차에서 추가된 명령. 병렬 dispatch + TDD 검증 흐름 지원.

- `tokb run plan --phase <slug>` — 같은 phase 내 `parallel_group` 별 task 묶음 fetch. OMC team 병렬 dispatch 용.
- `tokb commits push <task_id> <sha> --role test|code` — worker 가 commit 마다 호출. platform 의 TDD 검증에 사용 (test commit < code commit timestamp).
- `tokb task progress <uuid> done --commit-sha-test <sha> --commit-sha-code <sha>` — auto task done 시 TDD 강제. test/code commit sha 두 개 모두 등록되어 있어야 done 처리됨.

## tokb group — group 단위 진행 관리

group_key (예: backend phase의 `data-model`, frontend의 `auth-login`) 단위로 task 묶음 관리.

```bash
tokb group status <groupKey>                       # group의 task 진행 상태 출력
tokb group status <groupKey> --phase <phaseSlug>   # 특정 phase 로 범위 제한
tokb group complete <groupKey>                     # 모든 task done 검증 후 PR 생성 trigger
tokb group complete <groupKey> --phase <phaseSlug> # 특정 phase 로 범위 제한
tokb group complete <groupKey> --dry-run           # 검증만, PR 생성 skip
```

`--phase` 옵션은 같은 group_key 가 여러 phase 에 있을 때 (예: Phase 2 frontend 의 `auth` 페이지 + Phase 3 backend 의 `auth` 도메인) phase 차원 분리용. 없으면 group_key 만 매칭 (옛 동작 호환).

CLAUDE.md (template)의 group 마지막 task done 흐름에서 leader claude 가 자율 호출.
`tokb group complete` 는 모든 task done 검증 후 `gh pr create` 자동 호출 (title/labels 표준 형식).

## tokb init

토큰 검증 + 프로젝트 정보 저장 + design assets bootstrap.

### Bootstrap 단계

`.tokb/design.md` 가 platform 에서 inject 되어 있으면 (시범 빌드 흐름) `tokb init` 마지막에 자동 실행:

1. `.tokb/design.md` parse + zod schema 검증 (실패 시 platform 에서 design 재생성 안내)
2. `app/globals.css` 생성 (Tailwind v4 + shadcn-v4 호환, design tokens 기반)
3. `src/assets/icons/{style}/` 만 유지하고 나머지 5 style 폴더 정리 (template fork 가 시작점에 6 style 다 들고 옴)
4. `git commit -m "chore: bootstrap design assets from .tokb/design.md"`

`.tokb/design.md` 가 없으면 (예: 로컬 dev / re-init) skip 후 안내 메시지만 출력.

### 사용

```bash
tokb init tokb_apt_<your_token>
```

## Configuration

Per-project state lives in `.tokb/config.json` (chmod `0600`) with these fields:

- `push_token` (`tokb_apt_*`) — v0.6.0 부터 `.env.local` 의 `TOKB_PUSH_TOKEN` 으로 이관. config.json 의 `push_token` 은 backward compat 용 fallback.
- `project_id`, `plan_id` (UUIDs)
- `repo_url`, `vercel_url`, `supabase_url` (`https://` only)
- `platform_base_url` (defaults to `https://pj-platform.vercel.app`, must be
  `https://`)

## 환경 변수 (TOKB_PUSH_TOKEN)

tok-builder-cli 는 `.env.local` 의 `TOKB_PUSH_TOKEN` 을 platform 인증에 사용합니다.

빌드 시작 시 `tokb init` 이 자동으로 `.env.local` 에 기록합니다. 사용자가 따로 만질 필요 없음.

만료 시 platform UI 에서 새 빌드 시작 → 새 토큰 자동 기록.

옛 빌드 (config.json 의 `push_token` 기반) 도 그대로 동작 — `.env.local` 없으면 config.json fallback.

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
