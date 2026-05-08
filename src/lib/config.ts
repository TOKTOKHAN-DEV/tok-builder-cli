import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

export const PUSH_TOKEN_PREFIX = 'pjp_apt_'

const httpsUrl = z
  .url()
  .refine((u) => new URL(u).protocol === 'https:', { message: 'must be https://' })

const ConfigSchema = z.object({
  push_token: z.string().regex(/^pjp_apt_/, 'must start with pjp_apt_'),
  project_id: z.uuid().optional(),
  plan_id: z.uuid().optional(),
  repo_url: httpsUrl.optional(),
  vercel_url: httpsUrl.optional(),
  supabase_url: httpsUrl.optional(),
  platform_base_url: httpsUrl.default('https://pj-platform.vercel.app'),
})

export type Config = z.infer<typeof ConfigSchema>

const CONFIG_DIR = '.pj'
const CONFIG_FILE = 'config.json'

export async function readConfig(cwd: string = process.cwd()): Promise<Config | null> {
  const path = join(cwd, CONFIG_DIR, CONFIG_FILE)
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
  return ConfigSchema.parse(JSON.parse(raw))
}

export async function writeConfig(cfg: Partial<Config>, cwd: string = process.cwd()): Promise<void> {
  const dir = join(cwd, CONFIG_DIR)
  await mkdir(dir, { recursive: true })
  const existing = (await readConfig(cwd)) ?? {}
  const merged = ConfigSchema.parse({ ...existing, ...cfg })
  await writeFile(join(dir, CONFIG_FILE), JSON.stringify(merged, null, 2), { mode: 0o600 })
}

export async function requireConfig(cwd: string = process.cwd()): Promise<Config> {
  const cfg = await readConfig(cwd)
  if (!cfg) throw new Error('No .pj/config.json. Run `pj login <token>` first.')
  return cfg
}

export async function requireField<K extends keyof Config>(
  field: K,
): Promise<NonNullable<Config[K]>> {
  const cfg = await requireConfig()
  const value = cfg[field]
  if (value === undefined || value === null) {
    throw new Error(`${String(field)} missing in .pj/config.json. Run \`pj init\` first.`)
  }
  return value as NonNullable<Config[K]>
}
