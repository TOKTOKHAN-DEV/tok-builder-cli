# Changelog

## [0.16.1] - 2026-05-22

### Fixed

- `SECRET_VALUE_DENY` regex platform 정합 — `[\r\n\0]` → `[\x00-\x1F\x7F]` (platform `lib/projects/secrets/server.ts` 의 control char 차단 룰 sync). 옛 regex 는 newline/NUL 만 차단, ESC/TAB 등 일부 제어 문자 통과 — `.env.local` 깨짐 위험 잔존.
- `tsconfig.json` `exclude` 에 `src/**/__tests__/**` + `**/*.test.ts` 추가 — npm tarball 정리 (187.8 kB → 97.1 kB unpacked, 약 48% 감축).
- README `tokb group complete` v1.x stale 표현 정정 (이미 `gh pr create` 자동 호출 영역).

## [0.16.0] - 2026-05-22

### Added (#12-B — 외부 키 platform 입력 → 로컬 sync 흐름)

- `tokb env sync` — platform `/api/agent/projects/[id]/secrets` GET + 응답 secrets 배열을 `.env.local` 에 upsert. 비개발자가 platform UI 에서 외부 API 키 등록 → 로컬 build repo 가 sync 받는 흐름의 cli 측 1 단계.
- `fetchProjectSecrets()` export — testability + 다른 명령 (`tokb preflight` 자동 호출) 재사용용.
- 404 응답 = 등록 키 없음 (graceful skip, exit 0). non-2xx 응답 = throw + exit 1.

### Notes

- platform 측 `/api/agent/projects/[id]/secrets` endpoint 는 별 PR (pj-platform #12-A 후속) 에서 구현.
- worker dispatch 직전 자동 호출 흐름은 별 후속 (preflight 통합) 영역.

## [0.15.0] - 2026-05-22

### Added (AI-DLC Stage A — group 안 task 간 wave 병렬 dispatch)

- `tokb worktree create-task <group_key> <task_client_id>` — task 단위 격리 worktree (`.tokb/worktrees/<gk>__<id>/`) + branch `feat/<gk>/<task_client_id>` (base: `feat/<gk>-group`). git ref namespace 충돌 회피 위해 group branch 명에 `-group` suffix.
- `tokb worktree cleanup-task <group_key> <task_client_id>` — task worktree 만 제거 (branch 보존, group cleanup 시 일괄 삭제).
- `tokb worktree cleanup <group_key>` 확장 — group worktree + 모든 task worktree (`<gk>__*/`) + 모든 task branch (`refs/heads/feat/<gk>/*`) 일괄.
- `tokb wave next --phase <slug> --group <gk>` — depends_on 그래프 topological wave 계산. status='pending' + deps 모두 done 인 task list (JSON).
- `tokb wave validate-disjoint --tasks <ids> --phase --group` — wave 안 task 들의 output_artifacts (path 기준) pairwise intersection 검증. 충돌 시 exit 1 + conflicts JSON 보고.
- `tokb wave merge --group <gk> --tasks <ids>` — task branch 들의 group branch 이후 commits 을 group branch (`feat/<gk>-group`) 로 cherry-pick (task_client_id 순). 충돌 시 `cherry-pick --abort` + throw.
- `tokb worker prompt --task <task_uuid> --worktree <path>` — 단일 task prompt 빌더 (Stage A wave 정상 경로). 기존 `--group + --phase` 모드는 fallback (직렬) 로 보존.
- `buildWorkerPrompt` 시그니처에 `branch?: string` optional 추가. 미명시 시 default `feat/<groupKey>-group` (group 단위 fallback / 기존 흐름).
- `PlanStateResponse` task shape 에 `output_artifacts?` (Array of `{path, kind}`) + `depends_on_client_ids?` 추가.
- `assertValidTaskClientId` helper (`src/lib/task-key.ts`) — pattern `^[tT]-[0-9]+$` (path / branch injection 방어).

### Changed

- `tokb worktree create <group_key>` 의 branch 명 `feat/<gk>` → `feat/<gk>-group` (Stage A 의 task branch `feat/<gk>/<id>` 와 git ref namespace 충돌 회피).
- `tokb group complete <group_key>` 의 PR head 인자 정합 (`feat/<gk>-group`).

### Notes

- Stage A 본질: group 안 task 들을 wave (depends_on 그래프 topological level) 단위로 병렬 dispatch. file 충돌 안전을 위해 wave 안 task 들의 `output_artifacts` disjoint 의무 (skill 3 룰 + cli validate-disjoint 이중망).
- 자세한 흐름: `tok-builder-template` 의 `.claude/skills/tokb-core-workflow.md` "wave 흐름" 섹션 + `.claude/CLAUDE.md` §2 main loop.

## [0.14.0] - 2026-05-21

### Added
- `tokb group complete` 가 PR 생성 후 자동 머지 (`gh pr merge --squash --delete-branch`) — 비개발자 build 담당자가 PR 검증 / 머지 부담 X. PR 새로 생성된 경우만 머지 (already exists 케이스는 머지 건너뜀). 머지 실패 시 exit X (PR 자체는 만들어졌으니 수동 fallback 가능).

## [0.13.0] - 2026-05-20

### Added
- `buildWorkerPrompt` 의 각 task 줄 다음에 `[sub_step: X | 권장 SKILL: tokb-Y]` annotation 한 줄 — AI-DLC Stage 3 worker subagent 분리 (codegen / test-runner).
- `SUB_STEP_RECOMMENDED_SKILL` lookup table — `build_test` → `tokb-test-runner`, 그 외 / null → `tokb-codegen` default (platform `lib/build-plan/constants.ts SUB_STEPS` 와 동기 의무).
- `PlanStateResponse` task shape 에 `sub_step?: string | null` 추가 (zod `nullable().optional()` — 옛 platform 응답 호환).

### Notes
- AI-DLC Stage 3 PR A (`tok-builder-template`) 와 패키지로 머지. `tokb-codegen` / `tokb-test-runner` SKILL.md 가 외주 repo 에서 dispatch 진입.

## [0.12.0] - 2026-05-19

### Added
- `tokb group complete <group_key>` — 모든 task done 검증 후 자동 `git push -u origin feat/<group_key>` + `gh pr create --base main` 호출. PR 이미 존재 시 (`already exists` stderr 검출) skip 처리. `--dry-run` / `--phase <slug>` 옵션 (QA #5)

### Fixed
- `tokb worktree create <group_key>` — `feat/<group_key>` branch 이미 존재 시 `-b` 없이 `git worktree add` 호출. 옛 cleanup 후 branch 잔존 케이스 처리 (QA #6)
- `gh pr create` 의 `stdio: 'pipe'` 사용 — `e.stderr` 로 `already exists` 분기 정상 동작 (code review)

### Removed
- `preflight.ts` 의 `PJ_REQUIRE_TMUX` / `PJ_REQUIRE_OMC` env 검사 — 직접 harness 전환 후 omc plugin 의존 0 (QA #11)

## [0.6.1] - 2026-05-15

### Changed
- `init` 콘솔 출력 / 주석 / README / test description 의 "박음/박힘/박기" 표현을 "기록"으로 통일 (wording polish, 동작 변경 없음)

## [0.6.0] - 2026-05-15

### Added
- `tokb run plan --phase <slug>` — parallel_group 별 task 묶음 fetch (OMC team 병렬 dispatch 용)
- `tokb commits push <task_id> <sha> --role test|code` — TDD 검증용 commit timestamp 등록
- `tokb task progress` / `tokb task done` 에 `--commit-sha-test` / `--commit-sha-code` 옵션 — auto task done 시 TDD 강제
- error class 분리 — `TokbAuthError` (401) / `TokbValidationError` (422) / `TokbServerError` (5xx)
- `.env.local` 자동 로드 + `TOKB_PUSH_TOKEN` env var 우선
- `PJ_REQUIRE_OMC` env 시 OMC plugin 설치 확인 (preflight)
- `upsertEnvLocal` helper — `.env.local` upsert (mode 0600)

### Changed
- `init` 시 `.env.local` 자동 생성/append. `.tokb/config.json` 은 메타만 (token 제외)
- `writeConfig` signature 축소 — `Omit<Config, 'push_token'>` (token 분리)
- `pushTaskProgress` signature — 세 번째 인자 `note` 문자열 → `{ note, commitShaTest, commitShaCode }` options

### Backward Compatible
- 옛 빌드 (`.tokb/config.json` 에 `push_token` 박힌 경우) 그대로 동작 — `requireConfig` 가 fallback

### Security
- `tokb commits push` 의 git 호출을 `execFileSync` 사용 — shell injection 방어
