import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readConfig, writeConfig, requireConfig } from '../config.js'

describe('config', () => {
  it('round-trips meta fields through write+read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      await writeConfig({ project_id: '11111111-1111-4111-8111-111111111111' }, dir)
      const cfg = await readConfig(dir)
      expect(cfg?.project_id).toBe('11111111-1111-4111-8111-111111111111')
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('returns null when no config exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      const cfg = await readConfig(dir)
      expect(cfg).toBeNull()
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('writeConfig 가 push_token 인자 받아도 config.json 에 안 박음 (env 분리 강제)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      // any cast 로 push_token 박기 시도 (type system 우회) — 무시되어야 함
      await writeConfig(
        {
          project_id: '11111111-1111-4111-8111-111111111111',
          push_token: 'tokb_apt_sneaky',
        } as Parameters<typeof writeConfig>[0],
        dir,
      )
      const cfg = await readConfig(dir)
      expect(cfg?.push_token).toBeUndefined()
      expect(cfg?.project_id).toBe('11111111-1111-4111-8111-111111111111')
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('writeConfig 가 기존 config.json 의 push_token 도 다음 write 때 제거 (마이그레이션)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      // 옛 구조 모사 — push_token 이 박혀있는 config.json 을 손으로 작성
      const configDir = join(dir, '.tokb')
      await mkdir(configDir, { recursive: true, mode: 0o700 })
      await writeFile(
        join(configDir, 'config.json'),
        JSON.stringify({
          push_token: 'tokb_apt_legacy',
          project_id: '11111111-1111-4111-8111-111111111111',
          platform_base_url: 'https://pj-platform.vercel.app',
        }),
        { mode: 0o600 },
      )
      // 다음 write 가 push_token 을 제거해야 함
      await writeConfig({ plan_id: '22222222-2222-4222-8222-222222222222' }, dir)
      const cfg = await readConfig(dir)
      expect(cfg?.push_token).toBeUndefined()
      expect(cfg?.project_id).toBe('11111111-1111-4111-8111-111111111111')
      expect(cfg?.plan_id).toBe('22222222-2222-4222-8222-222222222222')
    } finally {
      await rm(dir, { recursive: true })
    }
  })
})

describe('requireConfig — TOKB_PUSH_TOKEN env var 우선 + .env.local 자동 로드', () => {
  // dotenv mutates process.env, so we must isolate.
  const savedEnv = process.env.TOKB_PUSH_TOKEN

  beforeEach(() => {
    delete process.env.TOKB_PUSH_TOKEN
  })

  afterEach(() => {
    delete process.env.TOKB_PUSH_TOKEN
    if (savedEnv !== undefined) {
      process.env.TOKB_PUSH_TOKEN = savedEnv
    }
  })

  // 옛 config.json (push_token 박힌) 모사 헬퍼 — writeConfig 가 더이상 push_token 안 박으므로 손으로 작성
  async function writeLegacyConfigWithToken(dir: string, token: string): Promise<void> {
    const configDir = join(dir, '.tokb')
    await mkdir(configDir, { recursive: true, mode: 0o700 })
    await writeFile(
      join(configDir, 'config.json'),
      JSON.stringify({
        push_token: token,
        project_id: '11111111-1111-4111-8111-111111111111',
        platform_base_url: 'https://pj-platform.vercel.app',
      }),
      { mode: 0o600 },
    )
  }

  it('env var 가 config.json 의 legacy push_token 보다 우선', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      await writeLegacyConfigWithToken(dir, 'tokb_apt_config')
      process.env.TOKB_PUSH_TOKEN = 'tokb_apt_env'
      const cfg = await requireConfig(dir)
      expect(cfg.push_token).toBe('tokb_apt_env')
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('env var 없을 때 config.json 의 legacy push_token 으로 fallback', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      await writeLegacyConfigWithToken(dir, 'tokb_apt_config')
      const cfg = await requireConfig(dir)
      expect(cfg.push_token).toBe('tokb_apt_config')
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('env var 도 config.json 의 push_token 도 없으면 친절 에러', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      // write config without push_token (only project_id)
      const configDir = join(dir, '.tokb')
      await mkdir(configDir, { recursive: true, mode: 0o700 })
      await writeFile(
        join(configDir, 'config.json'),
        JSON.stringify({
          project_id: '11111111-1111-4111-8111-111111111111',
          platform_base_url: 'https://pj-platform.vercel.app',
        }),
        { mode: 0o600 },
      )
      await expect(requireConfig(dir)).rejects.toThrow(/TOKB_PUSH_TOKEN/)
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('.env.local 의 TOKB_PUSH_TOKEN 자동 로드', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      // write .env.local with TOKB_PUSH_TOKEN
      await writeFile(join(dir, '.env.local'), 'TOKB_PUSH_TOKEN=tokb_apt_envfile\n')
      // write config without push_token
      const configDir = join(dir, '.tokb')
      await mkdir(configDir, { recursive: true, mode: 0o700 })
      await writeFile(
        join(configDir, 'config.json'),
        JSON.stringify({
          project_id: '11111111-1111-4111-8111-111111111111',
          platform_base_url: 'https://pj-platform.vercel.app',
        }),
        { mode: 0o600 },
      )
      const cfg = await requireConfig(dir)
      expect(cfg.push_token).toBe('tokb_apt_envfile')
    } finally {
      await rm(dir, { recursive: true })
    }
  })
})
