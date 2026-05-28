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
import { envCommand } from './commands/env.js'
import { groupCommand } from './commands/group.js'
import { commitsCommand } from './commands/commits.js'
import { worktreeCommand } from './commands/worktree.js'
import { workerCommand } from './commands/worker.js'
import { waveCommand } from './commands/wave.js'
import { dbTypesCommand } from './commands/db-types.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

process.on('unhandledRejection', (err) => {
  if (err instanceof ZodError) {
    console.error('입력 검증 실패:')
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
  .description('외주 빌드 오케스트레이션용 tok-builder CLI')
  .version(pkg.version)

for (const register of [
  loginCommand,
  taskCommand,
  planCommand,
  runCommand,
  phaseCommand,
  resumeCommand,
  initCommand,
  envCommand,
  groupCommand,
  commitsCommand,
  worktreeCommand,
  workerCommand,
  waveCommand,
  dbTypesCommand,
]) {
  register(program)
}

program.parse()
