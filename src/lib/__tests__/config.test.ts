import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readConfig, writeConfig, requireConfig } from '../config.js'

describe('config', () => {
  it('round-trips through write+read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      await writeConfig({ push_token: 'tokb_apt_test' }, dir)
      const cfg = await readConfig(dir)
      expect(cfg?.push_token).toBe('tokb_apt_test')
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

  it('env var 가 config.json 보다 우선', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      await writeConfig({ push_token: 'tokb_apt_config' }, dir)
      process.env.TOKB_PUSH_TOKEN = 'tokb_apt_env'
      const cfg = await requireConfig(dir)
      expect(cfg.push_token).toBe('tokb_apt_env')
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('env var 없을 때 config.json 의 push_token 사용', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-test-'))
    try {
      await writeConfig({ push_token: 'tokb_apt_config' }, dir)
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
