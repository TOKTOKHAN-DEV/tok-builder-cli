import { readFile } from 'node:fs/promises'
import { requireConfig } from './config.js'

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

export async function pushTaskProgress(taskId: string, status: TaskStatus, note?: string) {
  return request('POST', `/api/agent/tasks/${taskId}/progress`, { status, notes: note })
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
  tasks: Array<{ id: string; phase_slug: string; status: TaskStatus; title: string }>
}

export async function getProjectState(projectId: string): Promise<ProjectState> {
  return request<ProjectState>('GET', `/api/agent/projects/${projectId}/state`)
}

export async function planUpsert(planId: string, jsonPath: string) {
  if (!jsonPath.endsWith('.json')) throw new Error(`planUpsert: path must end with .json (got ${jsonPath})`)
  const body = JSON.parse(await readFile(jsonPath, 'utf-8'))
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
