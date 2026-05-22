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

// commander 등록은 Task 14 에서.
