import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { upsertEnvLocal } from '../env-local.js'

describe('upsertEnvLocal', () => {
  it('파일이 없으면 새로 생성', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-env-test-'))
    try {
      await upsertEnvLocal(dir, [{ key: 'TOKB_PUSH_TOKEN', value: 'abc' }])
      const c = await readFile(join(dir, '.env.local'), 'utf-8')
      expect(c).toBe('TOKB_PUSH_TOKEN=abc\n')
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('기존 라인은 보존 + 새 키 append', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-env-test-'))
    try {
      await writeFile(join(dir, '.env.local'), 'EXISTING=foo\n')
      await upsertEnvLocal(dir, [{ key: 'TOKB_PUSH_TOKEN', value: 'abc' }])
      const c = await readFile(join(dir, '.env.local'), 'utf-8')
      expect(c).toContain('EXISTING=foo')
      expect(c).toContain('TOKB_PUSH_TOKEN=abc')
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('같은 키 존재 시 line replace (덮어쓰기)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-env-test-'))
    try {
      await writeFile(join(dir, '.env.local'), 'TOKB_PUSH_TOKEN=old\nOTHER=keep\n')
      await upsertEnvLocal(dir, [{ key: 'TOKB_PUSH_TOKEN', value: 'new' }])
      const c = await readFile(join(dir, '.env.local'), 'utf-8')
      expect(c).toContain('TOKB_PUSH_TOKEN=new')
      expect(c).not.toContain('TOKB_PUSH_TOKEN=old')
      expect(c).toContain('OTHER=keep')
    } finally {
      await rm(dir, { recursive: true })
    }
  })

  it('여러 entries 한꺼번에 처리', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokb-env-test-'))
    try {
      await upsertEnvLocal(dir, [
        { key: 'A', value: '1' },
        { key: 'B', value: '2' },
      ])
      const c = await readFile(join(dir, '.env.local'), 'utf-8')
      expect(c).toContain('A=1')
      expect(c).toContain('B=2')
    } finally {
      await rm(dir, { recursive: true })
    }
  })
})
