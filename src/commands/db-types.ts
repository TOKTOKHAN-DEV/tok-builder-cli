import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

import { Command } from 'commander'

import { fetchDbTypes } from '../lib/api.js'
import { requireField } from '../lib/config.js'

const DEFAULT_OUTPUT = 'lib/supabase/database.types.ts'

export function dbTypesCommand(program: Command): void {
  const cmd = new Command('db-types')
    .description('Supabase 스키마 → database.types.ts 동기 (schema phase 마지막 task)')

  cmd
    .command('sync')
    .description('플랫폼에서 최신 타입을 받아 lib/supabase/database.types.ts 저장')
    .option('-o, --output <path>', '출력 경로 (cwd 안만 허용)', DEFAULT_OUTPUT)
    .action(async (opts: { output: string }) => {
      try {
        // --output 경로는 cwd 범위 안만 — path traversal / 시스템 경로 쓰기 차단.
        const cwd = process.cwd()
        const resolved = resolve(cwd, opts.output)
        if (resolved !== cwd && !resolved.startsWith(cwd + sep)) {
          throw new Error(`--output 경로가 현재 디렉터리 밖입니다: ${resolved}`)
        }

        const projectId = await requireField('project_id')
        const types = await fetchDbTypes(projectId)

        // 응답 형태 검증 — 플랫폼이 비정상 응답을 돌려도 디스크에 박지 않도록.
        if (!types.includes('export type Database')) {
          throw new Error('db-types 응답이 유효한 타입 파일 형식이 아닙니다 (export type Database 부재).')
        }

        await mkdir(dirname(resolved), { recursive: true })
        await writeFile(resolved, types, 'utf-8')
        console.log(`✔ ${opts.output} (${types.length} chars)`)
      } catch (e) {
        console.error('✗', e instanceof Error ? e.message : String(e))
        process.exit(1)
      }
    })

  program.addCommand(cmd)
}
