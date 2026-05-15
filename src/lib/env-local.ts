import { writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface EnvLocalUpsert {
  key: string
  value: string
}

/**
 * .env.local 의 entries 를 upsert (append or replace by key).
 * 기존 파일 보존, 같은 키 존재 시 line replace.
 * 파일 없으면 새로 생성.
 */
export async function upsertEnvLocal(
  cwd: string,
  entries: EnvLocalUpsert[],
): Promise<void> {
  const path = join(cwd, '.env.local')
  let content = ''
  if (existsSync(path)) {
    content = await readFile(path, 'utf-8')
  }

  for (const { key, value } of entries) {
    const lineRegex = new RegExp(`^${key}=.*$`, 'm')
    const newLine = `${key}=${value}`
    if (lineRegex.test(content)) {
      content = content.replace(lineRegex, newLine)
    } else {
      if (content.length > 0 && !content.endsWith('\n')) content += '\n'
      content += newLine + '\n'
    }
  }

  await writeFile(path, content, { mode: 0o600 })
}
