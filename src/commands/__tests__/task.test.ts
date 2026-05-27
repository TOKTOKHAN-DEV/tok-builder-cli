import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'
import { taskCommand, parseIdx } from '../task'

vi.mock('../../lib/api.js', () => ({
  pushTaskProgress: vi.fn(),
  pushTaskArtifacts: vi.fn(),
  reportTaskCriteria: vi.fn(),
  ARTIFACT_KINDS: ['spec', 'code', 'doc', 'config', 'test', 'other'],
  TASK_STATUSES: ['pending', 'in_progress', 'blocked', 'done', 'skipped'],
}))

import { reportTaskCriteria } from '../../lib/api.js'

function makeProgram() {
  const program = new Command()
  program.exitOverride() // process.exit 대신 throw
  taskCommand(program)
  return program
}

describe('parseIdx', () => {
  it('쉼표 분리 + trim + Number', () => {
    expect(parseIdx('0,1, 2')).toEqual([0, 1, 2])
  })

  it('음수 / 비정수 / 빈 토큰 제외', () => {
    expect(parseIdx('0, -1, 1.5, 2, abc, ')).toEqual([0, 2])
  })

  it('undefined / 빈 문자열 → []', () => {
    expect(parseIdx(undefined)).toEqual([])
    expect(parseIdx('')).toEqual([])
  })
})

describe('task criteria', () => {
  beforeEach(() => {
    vi.mocked(reportTaskCriteria).mockReset()
    vi.mocked(reportTaskCriteria).mockResolvedValue(undefined as never)
  })

  it('criteria <id> --done "0,1" --undone "2" → reportTaskCriteria(id, {done:[0,1], undone:[2]})', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const program = makeProgram()
    await program.parseAsync(
      ['task', 'criteria', 'task-uuid-1', '--done', '0,1', '--undone', '2'],
      { from: 'user' },
    )

    expect(reportTaskCriteria).toHaveBeenCalledWith('task-uuid-1', {
      done: [0, 1],
      undone: [2],
    })
    consoleSpy.mockRestore()
  })

  it('--done 만 지정 → undone 은 빈 배열', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const program = makeProgram()
    await program.parseAsync(['task', 'criteria', 'task-uuid-2', '--done', '3'], {
      from: 'user',
    })

    expect(reportTaskCriteria).toHaveBeenCalledWith('task-uuid-2', {
      done: [3],
      undone: [],
    })
    consoleSpy.mockRestore()
  })
})
