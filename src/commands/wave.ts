export interface WaveTask {
  id: string
  client_id: string
  phase_slug: string
  group_key: string | null
  description: string
  acceptance_criteria: string
  test_file_path: string | null
  status: string
  depends_on_client_ids: string[] | null | undefined
  output_artifacts: Array<{ path: string; kind: string }> | null | undefined
}

export interface ComputeNextWaveInput {
  tasks: WaveTask[]
  groupKey: string
  phaseSlug: string
}

export interface ComputeNextWaveResult {
  wave_index: number
  tasks: WaveTask[]
}

/**
 * 다음 wave 의 task 집합 반환.
 * 정의: status='pending' + 모든 depends_on_client_ids 의 task 가 같은 task list 안에서 status='done'.
 * 순환 의존성 / blocked / 다른 group / 다른 phase 는 wave 후보에서 제외.
 */
export function computeNextWave(input: ComputeNextWaveInput): ComputeNextWaveResult {
  const inGroup = input.tasks.filter(
    (t) => t.group_key === input.groupKey && t.phase_slug === input.phaseSlug,
  )

  const doneSet = new Set(inGroup.filter((t) => t.status === 'done').map((t) => t.client_id))

  const totalCount = inGroup.length
  const allDoneCount = doneSet.size

  const candidates = inGroup.filter((t) => {
    if (t.status !== 'pending') return false
    const deps = t.depends_on_client_ids ?? []
    return deps.every((dep) => doneSet.has(dep))
  })

  if (candidates.length === 0) {
    return { wave_index: -1, tasks: [] }
  }

  // wave_index: done 된 task 수 기반 단순 추정 (debugging / UI 표시 용도)
  const waveIndex =
    totalCount === 0 ? 0 : Math.floor(allDoneCount / Math.max(1, totalCount - allDoneCount)) + 1

  return {
    wave_index: waveIndex,
    tasks: candidates,
  }
}

export interface ValidateDisjointInput {
  tasks: WaveTask[]
}

export interface DisjointConflict {
  tasks: [string, string]  // [client_id_a, client_id_b]
  files: string[]          // intersection files (path 기준)
}

export interface ValidateDisjointResult {
  ok: boolean
  conflicts: DisjointConflict[]
}

/**
 * wave 안 task 들의 output_artifacts pairwise intersection 검증.
 * 충돌 = 같은 file path 를 2+ task 가 변경. 모든 pair 의 intersection 보고.
 * null / undefined output_artifacts = 빈 set (충돌 0).
 * path 기준 비교 (kind 무관).
 */
export function validateDisjoint(input: ValidateDisjointInput): ValidateDisjointResult {
  const conflicts: DisjointConflict[] = []
  const tasks = input.tasks

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const aPaths = new Set((tasks[i].output_artifacts ?? []).map((a) => a.path))
      const bPaths = new Set((tasks[j].output_artifacts ?? []).map((a) => a.path))
      const intersection = [...aPaths].filter((p) => bPaths.has(p))
      if (intersection.length > 0) {
        conflicts.push({
          tasks: [tasks[i].client_id, tasks[j].client_id],
          files: intersection,
        })
      }
    }
  }

  return { ok: conflicts.length === 0, conflicts }
}

// commander 등록은 Task 14 에서.
