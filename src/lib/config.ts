import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

export const PUSH_TOKEN_PREFIX = 'tokb_apt_'

const httpsUrl = z
  .url()
  .refine((u) => new URL(u).protocol === 'https:', { message: 'must be https://' })

const ConfigSchema = z.object({
  push_token: z.string().regex(/^tokb_apt_/, 'must start with tokb_apt_').optional(),
  project_id: z.uuid().optional(),
  plan_id: z.uuid().optional(),
  repo_url: httpsUrl.optional(),
  vercel_url: httpsUrl.optional(),
  supabase_url: httpsUrl.optional(),
  platform_base_url: httpsUrl.default('https://pj-platform.vercel.app'),
})

export type Config = z.infer<typeof ConfigSchema>

const CONFIG_DIR = '.tokb'
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
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const existing = (await readConfig(cwd)) ?? {}
  const merged = ConfigSchema.parse({ ...existing, ...cfg })
  await writeFile(join(dir, CONFIG_FILE), JSON.stringify(merged, null, 2), { mode: 0o600 })
}

export async function requireConfig(cwd: string = process.cwd()): Promise<Config> {
  // .env.local 자동 로드 (있을 때만). dotenv 는 동적 import 로 늦게 부른다.
  const envPath = join(cwd, '.env.local')
  try {
    await access(envPath)
    const dotenv = await import('dotenv')
    dotenv.config({ path: envPath, override: false })
  } catch {
    // .env.local 없으면 skip
  }

  const cfg = await readConfig(cwd)
  if (!cfg) throw new Error('No .tokb/config.json. Run `tokb login <token>` first.')

  // env var 우선 — 있으면 cfg.push_token 을 override
  const envToken = process.env.TOKB_PUSH_TOKEN
  if (envToken) {
    cfg.push_token = envToken
  }

  if (!cfg.push_token) {
    throw new Error(
      'TOKB_PUSH_TOKEN 이 .env.local 에도 없고 .tokb/config.json 에도 없습니다. ' +
        'platform UI 에서 새 빌드 시작 후 받은 토큰을 .env.local 에 박으세요.',
    )
  }

  return cfg
}

export async function requireField<K extends keyof Config>(
  field: K,
): Promise<NonNullable<Config[K]>> {
  const cfg = await requireConfig()
  const value = cfg[field]
  if (value === undefined || value === null) {
    throw new Error(`${String(field)} missing in .tokb/config.json. Run \`tokb init\` first.`)
  }
  return value as NonNullable<Config[K]>
}
