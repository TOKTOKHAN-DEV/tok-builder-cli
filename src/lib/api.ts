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

export async function pushTaskProgress(taskId: string, status: string, note?: string) {
  return postJson(`/api/agent/tasks/${taskId}/progress`, { status, notes: note })
}

export async function pushTaskArtifacts(
  taskId: string,
  artifacts: Array<{ path: string; kind: ArtifactKind }>,
) {
  return postJson(`/api/agent/tasks/${taskId}/artifacts`, { artifacts })
}

export type ProjectState = {
  plan: { id: string; status: string } | null
  run: { id: string; status: string } | null
  tasks: Array<{ id: string; phase_slug: string; status: string; title: string }>
}

export async function getProjectState(projectId: string): Promise<ProjectState> {
  return getJson<ProjectState>(`/api/agent/projects/${projectId}/state`)
}
