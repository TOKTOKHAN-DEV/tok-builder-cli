import { Command } from 'commander'
import { upsertEnvLocal } from '../lib/env-local.js'

export function loginCommand(program: Command): void {
  program
    .command('login')
    .argument('<token>', 'platform UI 에서 발급된 tokb_apt_* 토큰')
    .description('토큰을 .env.local 의 TOKB_PUSH_TOKEN 으로 저장')
    .action(async (token: string) => {
      await upsertEnvLocal(process.cwd(), [{ key: 'TOKB_PUSH_TOKEN', value: token }])
      console.log('✓ 토큰이 .env.local 의 TOKB_PUSH_TOKEN 으로 저장되었습니다')
    })
}
