#!/usr/bin/env node
import { createRequire } from 'node:module'
import { Command } from 'commander'
import { ZodError } from 'zod'
import { loginCommand } from './commands/login.js'
import { taskCommand } from './commands/task.js'
import { planCommand } from './commands/plan.js'
import { runCommand } from './commands/run.js'
import { phaseCommand } from './commands/phase.js'
import { resumeCommand } from './commands/resume.js'
import { initCommand } from './commands/init.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

process.on('unhandledRejection', (err) => {
  if (err instanceof ZodError) {
    console.error('Invalid input:')
    for (const issue of err.issues) {
      console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
  } else if (err instanceof Error) {
    console.error(err.message)
  } else {
    console.error(err)
  }
  process.exit(1)
})

const program = new Command()
program
  .name('tokb')
  .description('tok-builder CLI for outsourcing build orchestration (formerly `pj`)')
  .version(pkg.version)

for (const register of [
  loginCommand,
  taskCommand,
  planCommand,
  runCommand,
  phaseCommand,
  resumeCommand,
  initCommand,
]) {
  register(program)
}

program.parse()
