import { Command } from 'commander'
import { writeConfig } from '../lib/config.js'

export function loginCommand(program: Command): void {
  program
    .command('login')
    .argument('<token>', 'platform UI 에서 발급된 tokb_apt_* 토큰')
    .description('토큰을 .tokb/config.json 에 저장')
    .action(async (token: string) => {
      await writeConfig({ push_token: token })
      console.log('✓ 토큰이 .tokb/config.json 에 저장되었습니다')
    })
}
