#!/usr/bin/env node
import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { taskCommand } from './commands/task.js'
import { planCommand } from './commands/plan.js'
import { runCommand } from './commands/run.js'
import { phaseCommand } from './commands/phase.js'
import { resumeCommand } from './commands/resume.js'
import { initCommand } from './commands/init.js'

const program = new Command()
program
  .name('pj')
  .description('pj-platform CLI for outsourcing build orchestration')
  .version('0.1.0')

loginCommand(program)
taskCommand(program)
planCommand(program)
runCommand(program)
phaseCommand(program)
resumeCommand(program)
initCommand(program)

program.parse()
