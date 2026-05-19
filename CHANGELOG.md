# Changelog

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
