# Changelog

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
