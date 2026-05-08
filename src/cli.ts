#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()
program
  .name('pj')
  .description('pj-platform CLI for outsourcing build orchestration')
  .version('0.1.0')

program.parse()
