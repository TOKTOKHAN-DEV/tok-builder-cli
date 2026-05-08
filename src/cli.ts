#!/usr/bin/env node
import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { taskCommand } from './commands/task.js'

const program = new Command()
program
  .name('pj')
  .description('pj-platform CLI for outsourcing build orchestration')
  .version('0.1.0')

loginCommand(program)
taskCommand(program)

program.parse()
