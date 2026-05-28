import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { requireConfig } from './config.js'
import { TokbAuthError, TokbValidationError, TokbServerError } from './errors.js'
import { assertInferredAcked } from './inferred.js'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const cfg = await requireConfig()
  const init: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${cfg.push_token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }
  const res = await fetch(`${cfg.platform_base_url}${path}`, init)
  if (!res.ok) {
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = undefined
    }
    if (res.status === 401) {
      throw new TokbAuthError()
    }
    if (res.status === 422) {
      const obj = (parsed && typeof parsed === 'object') ? (parsed as Record<string, unknown>) : {}
      const rawIssues = obj.issues
      const issues = Array.isArray(rawIssues)
        ? (rawIssues as { field: string; message: string }[])
        : [{ field: '', message: typeof obj.error === 'string' ? obj.error : text }]
      throw new TokbValidationError(issues)
    }
    if (res.status >= 500) {
      throw new TokbServerError(res.status)
    }
    const truncated = text.length > 200 ? text.slice(0, 200) + '…' : text
    throw new Error(`${method} ${path} failed: ${res.status} ${truncated}`)
  }
  return res.json() as Promise<T>
}

export type ArtifactKind = 'spec' | 'code' | 'doc' | 'config' | 'test' | 'other'
export const ARTIFACT_KINDS = ['spec', 'code', 'doc', 'config', 'test', 'other'] as const

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'done' | 'skipped'
export const TASK_STATUSES = ['pending', 'in_progress', 'blocked', 'done', 'skipped'] as const

export type RunCompletionStatus = 'completed' | 'failed'
export const RUN_COMPLETION_STATUSES = ['completed', 'failed'] as const

export interface PushTaskProgressOptions {
  note?: string
  commitShaTest?: string
  commitShaCode?: string
}

export async function pushTaskProgress(
  taskId: string,
  status: TaskStatus,
  opts: PushTaskProgressOptions = {},
) {
  return request('POST', `/api/agent/tasks/${taskId}/progress`, {
    status,
    notes: opts.note,
    commit_sha_test: opts.commitShaTest,
    commit_sha_code: opts.commitShaCode,
  })
}

export async function reportTaskCriteria(
  taskId: string,
  opts: { done?: number[]; undone?: number[] } = {},
) {
  return request('POST', `/api/agent/tasks/${taskId}/criteria`, {
    done: opts.done ?? [],
    undone: opts.undone ?? [],
  })
}

export async function pushTaskArtifacts(
  taskId: string,
  artifacts: Array<{ path: string; kind: ArtifactKind }>,
) {
  return request('POST', `/api/agent/tasks/${taskId}/artifacts`, { artifacts })
}

export type ProjectState = {
  plan: { id: string; status: string; current_phase_id: string | null } | null
  run: { id: string; status: string } | null
  tasks: Array<{
    id: string
    phase_slug: string
    status: TaskStatus
    title: string
    group_key: string | null
    group_type: string | null
    domain: string | null
  }>
}

export async function getProjectState(projectId: string): Promise<ProjectState> {
  return request<ProjectState>('GET', `/api/agent/projects/${projectId}/state`)
}

export type PlanStateResponse = {
  phase: string
  current_phase: string
  groups: Array<{
    parallel_group: string
    group_key: string | null
    phase_slug: string
    tasks: Array<{
      id: string
      client_id: string
      phase_slug: string
      group_key: string | null
      group_type: string | null
      domain: string | null
      parallel_group: string | null
      title: string
      description: string
      acceptance_criteria: string
      depends_on: string[]
      status: TaskStatus
      task_type: 'auto' | 'human_gate'
      test_file_path: string | null
      commit_sha_test: string | null
      commit_sha_code: string | null
      evidence_note: string | null
      sub_step?: string | null
      last_failed_event_meta?: {
        escalated_to_model?: 'haiku' | 'sonnet'
      } | null
      output_artifacts?: Array<{ path: string; kind: 'spec' | 'code' | 'doc' | 'config' | 'test' | 'other' }> | null
      depends_on_client_ids?: string[] | null
    }>
  }>
}

// runtime shape guard — type 만 의존 시 silent corruption 방지.
// z.looseObject 로 추가 필드 (title/depends_on/status/task_type/commit_sha 등) 허용.
const PlanStateTaskShape = z.looseObject({
  id: z.string(),
  client_id: z.string(),
  phase_slug: z.string(),
  group_key: z.string().nullable(),
  domain: z.string().nullable(),
  description: z.string(),
  acceptance_criteria: z.string(),
  test_file_path: z.string().nullable(),
  sub_step: z.string().nullable().optional(),
  output_artifacts: z.array(z.object({
    path: z.string(),
    kind: z.enum(['spec', 'code', 'doc', 'config', 'test', 'other']),
  }).loose()).nullable().optional(),
  depends_on_client_ids: z.array(z.string()).nullable().optional(),
  last_failed_event_meta: z.object({
    escalated_to_model: z.enum(['haiku', 'sonnet']).optional(),
  }).nullable().optional(),
})

const PlanStateGroupShape = z.looseObject({
  parallel_group: z.string(),
  group_key: z.string().nullable(),
  phase_slug: z.string(),
  tasks: z.array(PlanStateTaskShape),
})

const PlanStateResponseShape = z.looseObject({
  phase: z.string(),
  current_phase: z.string(),
  groups: z.array(PlanStateGroupShape),
})

export async function getPlanState(planId: string, phase?: string): Promise<PlanStateResponse> {
  const query = phase ? `?phase=${encodeURIComponent(phase)}` : ''
  const raw = await request<unknown>('GET', `/api/agent/plans/${planId}/state${query}`)
  return PlanStateResponseShape.parse(raw) as PlanStateResponse
}

export type CommitRole = 'test' | 'code'

export async function pushCommit(
  taskId: string,
  sha: string,
  committedAt: string,
  role: CommitRole,
): Promise<unknown> {
  return request('POST', '/api/build-plan/commits', {
    task_id: taskId,
    sha,
    committed_at: committedAt,
    role,
  })
}

export async function planUpsert(planId: string, jsonPath: string, opts: { ackInferred?: boolean } = {}) {
  if (!jsonPath.endsWith('.json')) throw new Error(`planUpsert: path must end with .json (got ${jsonPath})`)
  const body = JSON.parse(await readFile(jsonPath, 'utf-8'))
  assertInferredAcked(body, opts.ackInferred ?? false)
  return request('POST', `/api/agent/plans/${planId}/upsert`, body)
}

export async function planTaskAdd(planId: string, jsonPath: string) {
  if (!jsonPath.endsWith('.json')) throw new Error(`planTaskAdd: path must end with .json (got ${jsonPath})`)
  const body = JSON.parse(await readFile(jsonPath, 'utf-8'))
  return request('POST', `/api/agent/plans/${planId}/tasks`, body)
}

export async function runAccept(runId: string) {
  return request('POST', `/api/agent/runs/${runId}/accept`, {})
}

export async function runComplete(runId: string, status: 'completed' | 'failed', errorMessage?: string) {
  return request('POST', `/api/agent/runs/${runId}/complete`, { status, error_message: errorMessage })
}

export async function verifyToken(token: string, platformUrl: string): Promise<unknown> {
  const res = await fetch(`${platformUrl}/api/agent/auth/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    const truncated = text.length > 200 ? text.slice(0, 200) + '…' : text
    throw new Error(`Token verification failed: ${res.status} ${truncated}`)
  }
  return res.json()
}

/**
 * Schema phase types sync — 플랫폼이 Supabase Management API 를 proxy 해서
 *   database.types.ts 텍스트를 반환. 워커는 DB 자격증명 없음.
 *
 * 응답은 text/plain (raw TS) — JSON 아님 → 기존 request() helper 우회.
 */
export async function fetchDbTypes(projectId: string): Promise<string> {
  const cfg = await requireConfig()
  const res = await fetch(
    `${cfg.platform_base_url}/api/agent/projects/${projectId}/db-types`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${cfg.push_token}` },
    },
  )
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 401) throw new TokbAuthError()
    if (res.status >= 500) throw new TokbServerError(res.status)
    const truncated = text.length > 200 ? text.slice(0, 200) + '…' : text
    throw new Error(`fetchDbTypes failed: ${res.status} ${truncated}`)
  }
  return res.text()
}
