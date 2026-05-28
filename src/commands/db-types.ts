import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

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
    .option('-o, --output <path>', '출력 경로', DEFAULT_OUTPUT)
    .action(async (opts: { output: string }) => {
      const projectId = await requireField('project_id')
      const types = await fetchDbTypes(projectId)
      await mkdir(dirname(opts.output), { recursive: true })
      await writeFile(opts.output, types, 'utf-8')
      console.log(`✔ ${opts.output} (${types.length} bytes)`)
    })

  program.addCommand(cmd)
}
