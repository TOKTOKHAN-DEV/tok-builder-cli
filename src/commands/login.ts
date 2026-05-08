import { Command } from 'commander'
import { writeConfig } from '../lib/config.js'

export function loginCommand(program: Command): void {
  program
    .command('login')
    .argument('<token>', 'pjp_apt_* token from platform UI')
    .description('Save token to .pj/config.json')
    .action(async (token: string) => {
      if (!token.startsWith('pjp_apt_')) {
        console.error('Invalid token format. Expected pjp_apt_*')
        process.exit(1)
      }
      await writeConfig({ push_token: token })
      console.log('Token saved to .pj/config.json')
    })
}
