import { readFile } from 'node:fs/promises'
import { requireConfig } from './config.js'

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const cfg = await requireConfig()
  const res = await fetch(`${cfg.platform_base_url}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.push_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${path} failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

async function getJson<T>(path: string): Promise<T> {
  const cfg = await requireConfig()
  const res = await fetch(`${cfg.platform_base_url}${path}`, {
    headers: { 'Authorization': `Bearer ${cfg.push_token}` },
  })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export type ArtifactKind = 'spec' | 'code' | 'doc' | 'config' | 'test' | 'other'
export const ARTIFACT_KINDS = ['spec', 'code', 'doc', 'config', 'test', 'other'] as const

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'done' | 'skipped'
export const TASK_STATUSES = ['pending', 'in_progress', 'blocked', 'done', 'skipped'] as const

export type RunCompletionStatus = 'completed' | 'failed'
export const RUN_COMPLETION_STATUSES = ['completed', 'failed'] as const

export async function pushTaskProgress(taskId: string, status: TaskStatus, note?: string) {
  return postJson(`/api/agent/tasks/${taskId}/progress`, { status, notes: note })
}

export async function pushTaskArtifacts(
  taskId: string,
  artifacts: Array<{ path: string; kind: ArtifactKind }>,
) {
  return postJson(`/api/agent/tasks/${taskId}/artifacts`, { artifacts })
}

export type ProjectState = {
  plan: { id: string; status: string; current_phase_id: string | null } | null
  run: { id: string; status: string } | null
  tasks: Array<{ id: string; phase_slug: string; status: TaskStatus; title: string }>
}

export async function getProjectState(projectId: string): Promise<ProjectState> {
  return getJson<ProjectState>(`/api/agent/projects/${projectId}/state`)
}

export async function planUpsert(planId: string, jsonPath: string) {
  const body = JSON.parse(await readFile(jsonPath, 'utf-8'))
  return postJson(`/api/agent/plans/${planId}/upsert`, body)
}

export async function planTaskAdd(planId: string, jsonPath: string) {
  const body = JSON.parse(await readFile(jsonPath, 'utf-8'))
  return postJson(`/api/agent/plans/${planId}/tasks`, body)
}

export async function runAccept(runId: string) {
  return postJson(`/api/agent/runs/${runId}/accept`, {})
}

export async function runComplete(runId: string, status: 'completed' | 'failed', errorMessage?: string) {
  return postJson(`/api/agent/runs/${runId}/complete`, { status, error_message: errorMessage })
}
