import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readConfig, writeConfig } from '../config.js'

describe('config', () => {
  it('round-trips through write+read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pj-test-'))
    try {
      await writeConfig({ push_token: 'pjp_apt_test' }, dir)
      const cfg = await readConfig(dir)
      expect(cfg?.push_token).toBe('pjp_apt_test')
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('returns null when no config exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pj-test-'))
    try {
      const cfg = await readConfig(dir)
      expect(cfg).toBeNull()
    } finally {
      await rm(dir, { recursive: true })
    }
  })
})
