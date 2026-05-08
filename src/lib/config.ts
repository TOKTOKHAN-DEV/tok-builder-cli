import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { z } from 'zod'

const ConfigSchema = z.object({
  push_token: z.string().min(1),
  project_id: z.uuid().optional(),
  plan_id: z.uuid().optional(),
  repo_url: z.url().optional(),
  vercel_url: z.url().optional(),
  supabase_url: z.url().optional(),
  platform_base_url: z.url().default('https://pj-platform.vercel.app'),
})

export type Config = z.infer<typeof ConfigSchema>

const CONFIG_DIR = '.pj'
const CONFIG_FILE = 'config.json'

export async function readConfig(cwd: string = process.cwd()): Promise<Config | null> {
  const path = join(cwd, CONFIG_DIR, CONFIG_FILE)
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf-8')
  return ConfigSchema.parse(JSON.parse(raw))
}

export async function writeConfig(cfg: Partial<Config>, cwd: string = process.cwd()): Promise<void> {
  const dir = join(cwd, CONFIG_DIR)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  const existing = (await readConfig(cwd)) ?? {}
  const merged = ConfigSchema.parse({ ...existing, ...cfg })
  await writeFile(join(dir, CONFIG_FILE), JSON.stringify(merged, null, 2), { mode: 0o600 })
}

export async function requireConfig(cwd: string = process.cwd()): Promise<Config> {
  const cfg = await readConfig(cwd)
  if (!cfg) throw new Error('No .pj/config.json. Run `pj login <token>` first.')
  return cfg
}
