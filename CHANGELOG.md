# Changelog

## [0.27.0] - 2026-06-10

### Changed

- **아이콘 시스템 lucide 단일 통일** (`design-assets`). 빌드 산출물의 아이콘을 `lucide-react` 하나로 통일(PO 결정 — consistency 우선)하면서 bootstrap 의 Flaticon 자산 처리를 제거했다.
  - `bootstrapDesignAssets` 가 더 이상 `src/assets/icons` 의 style별 폴더를 prune 하지 않는다 (이제 globals.css 생성만). `git add` 대상도 `app/globals.css` 만.
  - `prune-design-icons` 모듈 + 테스트 삭제.
  - design token 스키마에서 `icons` 필드(Flaticon `style`/`source`/`rationale`) 제거. 스키마가 `.strict()` 가 아니라 기존 design.md 에 `icons` 섹션이 남아 있어도 무시되어 검증은 통과(하위호환). template(lucide 통일) + platform(design 생성에서 icons 제거)과 정합.

## [0.26.1] - 2026-06-05

### Fixed

- **`read:packages` scope 검사 false positive** (`install.sh` + `preflight.ts`). 0.26.0 의 scope 검사가 `read:packages` 문자열만 봐서, **`write:packages` 보유 토큰**(read 를 포함하므로 실제로는 패키지 읽기 가능 — 주로 개발자·관리자 계정)에 불필요한 경고를 띄웠다. `(read|write):packages` 로 완화 — 둘 중 하나만 있어도 통과. (실환경 재현·수정 확인: `write:packages` 보유 계정에서 사전 점검 통과)

## [0.26.0] - 2026-06-05

### Changed

- **부트스트랩 사전 점검(preflight) 에러 안내를 비개발자 기준으로 상세화** (`install.sh` + `src/lib/preflight.ts`). 막힌 항목마다 `[무엇이 막혔나] → [복붙할 정확한 명령] → [그래도 안 되면 누구에게]` 구조로 안내한다. Node 미설치/버전낮음(nodejs.org·`brew install node`), git 미설치(`xcode-select --install`), gh CLI 미설치(`brew install gh`), gh 인증 안 됨(`gh auth login --web --git-protocol https --scopes "read:org,read:packages"` + 브라우저·8자리 코드 안내), 조직 멤버 아님(현재 로그인 계정 노출 + 회사 계정 재로그인 + 관리자 초대 요청) 전부 커버. 빌드 담당자에 비개발자가 많아 "gh 연결 실패 후 무엇을 해야 할지 안내 부재"로 끝나던 문제 해결.
- **`install.sh` 사전 점검이 막힌 항목을 모아서 한 번에 안내** (기존: 첫 실패에서 즉시 중단 → 하나 고치고 재실행 반복). Node 없으면 이후 검사 스킵 등 의존 순서는 유지.
- **default platform URL 을 운영 정식 도메인 `https://builder.toktokhan.dev` 로 통일** (`install.sh` fallback `pj-platform-nine.vercel.app`, `init.ts` 기본값 `pj-platform.vercel.app` → 둘 다 교체). 정상 흐름은 platform 이 `TOKB_PLATFORM_URL`(요청 origin)을 주입하므로 환경별 자동 분리가 그대로 유지되고, fallback 은 URL 미지정 수동 실행 시의 안전망(운영 추정).

### Added

- **`read:packages` 권한 사전 검사** (`install.sh` + `preflight.ts`). gh 인증은 됐지만 토큰에 `read:packages` scope 가 없으면 한참 뒤 `pnpm install`(`@toktokhan-dev/*`)이 401 로 실패하던 함정을, 사전 점검 단계에서 미리 감지해 `gh auth refresh -h github.com -s read:packages -s read:org` 를 안내한다. (`gh auth login --web` 기본 scope 에 `read:packages` 미포함)

## [0.25.0] - 2026-06-01

### Fixed

- **토큰 끊김 재개 — `computeNextWave`(→ `wave start`/`wave next`)가 stale `in_progress` task 를 다음 wave 후보로 흡수.** worker 가 작업 중 토큰 리미트로 끊기면 task 가 `in_progress` 로 남는데, 옛 동작은 `pending` 만 wave 후보로 잡아 그 task 를 영영 방치했다 (재시도해도 누락 — frontend wave 의 t-026 사고). wave start 시점은 이전 wave 가 끝난 시점이라 남은 `in_progress` 는 끊긴 것이 확정 → `pending` 과 동일하게 후보(의존성·disjoint 규칙 동일 적용)로 흡수해 **재투입**한다(worker 가 이어서 완성). 끊겨도 화면 누락 0. ⚠️ 재개 흡수는 wave 계산부에만 — SessionStart/compact hook 에서 in_progress 를 건드리면 작업 중 task 를 날린다. (재투입 시 기존 task worktree 를 이어쓰므로 깨끗한 base reset 은 후속.)

## [0.24.0] - 2026-06-01

### Added

- **`tokb group review <gk> --simplify <pass|issues> --security <pass|issues>`** — group 의 simplify + security review 결과를 `.tokb/reviews/<gk>.json` 에 기록. `group complete` 의 머지 전 게이트로 작동: 두 review 가 모두 `pass` 여야 PR 생성/머지로 진행하고, 기록 없음 / `issues` 면 차단(이슈 수정 후 재기록). review 강제를 빌드 시스템에 내장 — 개인 글로벌 룰에 의존하지 않아 다른 사람 / 빌드 머신에서도 동일하게 작동.
- **`tokb wave merge` 의 group 자동 분류 모드** — `--group` 생략 + `--phase <slug>` 지정 시, cli 가 wave 전체 task(`--tasks`)를 plan state 의 `group_key` 로 분류해 group 별로 순차 cherry-pick. leader 가 `for g in $groups; do tokb wave merge --group $g …` 셸 루프(zsh 단어 분리로 깨짐)를 짤 필요를 제거 — worktree 생성 면역화(0.23.0)와 같은 철학. 기존 `--group --tasks` 단일 모드는 하위호환 유지.

### Changed

- **worker prompt 의 bypass / enforce 흐름에 `tokb task criteria` 보고 단계 추가** — task done 직전에 충족 정량(+정성) criterion 인덱스를 보고하도록 명시. 이 단계가 빠져 있어 task 는 done 인데 acceptance criteria 체크박스가 0/N 으로 남던 문제 해결(특히 bypass phase 는 platform 게이트도 없어 조용히 통과). enforce phase 는 done 게이트(422) 통과를 위해서도 필수.

## [0.23.0] - 2026-06-01

### Added

- **`tokb wave start --phase <p>`** — 다음 wave 의 worktree(group + task)를 CLI 내부에서 일괄 생성하고 `{ wave_index, tasks: [{ taskId, clientId, groupKey, worktree, model }] }` 를 JSON 출력. `wave next` 계산 + group/task worktree 생성을 한 명령으로 융합해, leader 가 `tokb worktree create-task` 를 task 마다 shell 루프로 호출하던 흐름을 제거한다. 출력 `tasks` 는 `wave-codegen` workflow args 계약과 일치 — leader 는 가공 없이 그대로 넘긴다.

### Fixed

- **zsh 단어 분리로 worktree 이름이 뭉개지던 버그 제거.** leader 가 `tokb wave next` 출력의 client_id 들을 shell 루프(`for id in $IDS`)로 돌려 worktree 를 만들 때, zsh 는 unquoted scalar 를 단어 분리하지 않아(bash 와 차이) 7 개 task 가 개행 포함 단일 worktree(`schema-auth__t-001\n…\nt-007`, 표시상 `…t-007`)로 뭉개졌다. `wave start` 가 worktree 생성을 전부 TS(`path.join` + `execFileSync` 배열 인자)로 옮겨 shell 분리에 원천 면역.

## [0.22.0] - 2026-06-01

### Added

- **`tokb wave next` 출력의 각 task 에 `recommended_model` 부착** (`'haiku' | 'sonnet'`). `sub_step → model` 매핑(+실패 시 `escalated_to_model` 우선)을 `worker prompt` 와 단일 출처(`resolveRecommendedModel`)로 공유한다. leader 가 `tokb wave next` 결과만으로 worker dispatch 의 model 을 정할 수 있어, wave-codegen Workflow 에 worker prompt 전문을 인라인할 필요가 없어진다(leader 부담 = Workflow 우회 동기 제거).

## [0.21.0] - 2026-05-29

### Changed

- **`tokb wave next` / `tokb wave validate-disjoint` — phase-wide 로 전환** (`--group` 옵션 제거). `computeNextWave` 가 group 경계 무관하게 phase 전체에서 의존성 없고 파일 안 겹치는(disjoint-aware) task 를 한 wave 로 반환한다. 병렬 단위가 "group 안" → "phase 전체" 로 승격되어, 한 phase 에 group A(1 task) + group B(5 task) 면 6 task 가 한 wave 로 병렬. 동시 실행 폭은 leader 의 dynamic workflow(`wave-codegen`)가 관리하므로 cli 는 상한을 두지 않는다.
- `computeNextWave` 에 disjoint-aware 선택 추가: 후보 중 `output_artifacts` 가 서로 겹치지 않는 task 를 client_id 순 greedy 로 한 wave 에 담고, 파일 겹치는 task 는 다음 wave 로 자동 분리(cherry-pick 충돌 0). 디렉토리 경로(끝 `/`)는 점유 대상 제외하고, 나머지는 `path.posix.normalize` 로 정규화 비교(`./a.ts`=`a.ts`).

### ⚠️ BREAKING

- `tokb wave next` / `tokb wave validate-disjoint` 의 `--group <groupKey>` 인자 제거. leader 흐름(`tok-builder-template` 의 `core-workflow.md` / `CLAUDE.md §2`)이 phase-wide wave 로 함께 갱신됨 — cli 단독 업그레이드 시 옛 group 단위 호출은 동작하지 않는다. group_key 는 `<phase>-<domain>` 네임스페이스 사용(template 분해규칙).

## [0.20.0] - 2026-05-29

### Changed

- `tokb wave merge` / `tokb group complete` — **group worktree(`.tokb/worktrees/<gk>`) 안에서 실행**하도록 변경. group branch(`feat/<gk>-group`)를 group worktree 가 점유한 상태에서 leader 메인트리가 `git checkout` 을 시도해 `already checked out` 으로 막히던 충돌을 해소. push 의 pre-push hook 도 cherry-pick 된 통합 코드를 검사하게 됨(leader 메인트리는 안 건드림).
- `tokb worktree create` — group worktree 생성 직후 `pnpm install --frozen-lockfile` 자동 실행(group complete push 시 pre-push hook 의 typecheck/test 에 필요한 node_modules 확보).
- `tokb worktree cleanup` — 정리 견고화: 실패를 silent skip 하지 않고 보고(`failures`), `git worktree prune`, group branch 로컬 삭제까지 일원화해 **worktree/branch 누수 0**. `{ removedWorktrees, removedBranches, failures }` 반환.
- `tokb wave validate-disjoint` — `output_artifacts` 의 디렉토리 경로(끝이 `/`)는 겹침 검사에서 제외. 마이그레이션 task 는 timestamp 파일이라 plan 시점에 경로를 못 박으므로 `supabase/migrations/` 디렉토리로 명시한다.

### Fixed

- worker prompt 의 미등록 명령 `tokb preflight` 참조 제거(bootstrap 4→3 단계 — `runPreflight` 는 `init` 내부 전용).

### 기타

- 사용자 노출 문구 한글화: 외주/오케스트레이션 제거(`tokb --help` 첫 줄), `dispatch`→호출, `controller`→리더, `disjoint`(산문)→겹침.
- schema phase worker prompt 에 마이그레이션 `output_artifacts` 안내 추가(디렉토리는 식별자일 뿐, `supabase migration new` 로 생성·그 경로 직접 생성/symlink 금지).

## [0.18.1] - 2026-05-27

### Fixed

- `tokb commits push` — git `%cI` 의 로컬 타임존 오프셋(예: `+09:00`)을 UTC `Z` 로 정규화 후 전송. platform `committed_at` 검증이 `z.iso.datetime()` 으로 offset 표기를 거부(`422 Invalid ISO datetime`)해 TDD enforce phase(frontend/backend)의 commit 등록 + `task progress done` 이 전부 막히던 버그 수정. 시각 instant 는 보존(표기만 UTC 변환)되어 test/code commit timestamp 순서 검증에 영향 없음. (`toUtcIso` 헬퍼 + 단위 테스트 추가)

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
