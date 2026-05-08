import { Command } from 'commander'
import { writeConfig } from '../lib/config.js'

export function loginCommand(program: Command): void {
  program
    .command('login')
    .argument('<token>', 'tokb_apt_* token from platform UI')
    .description('Save token to .tokb/config.json')
    .action(async (token: string) => {
      await writeConfig({ push_token: token })
      console.log('Token saved to .tokb/config.json')
    })
}
