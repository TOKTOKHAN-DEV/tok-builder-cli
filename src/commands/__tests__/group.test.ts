import { describe, it, expect, vi, beforeEach } from 'vitest';
import { filterGroupTasks, groupCommand, reviewGate, type ReviewRecord } from '../group';
import { Command } from 'commander';

// node:child_process, node:fs, config, api mock
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))
// group complete 가 group worktree 존재를 existsSync 로 가드 → mock 으로 통과
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() =>
    JSON.stringify({ groupKey: 'auth', simplify: 'pass', security: 'pass', reviewed_at: 'x' }),
  ),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
}))
vi.mock('../../lib/config.js', () => ({
  requireField: vi.fn(),
}))
vi.mock('../../lib/api.js', () => ({
  getProjectState: vi.fn(),
}))

import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { requireField } from '../../lib/config.js'
import { getProjectState } from '../../lib/api.js'

// group complete 가 push/pr 을 실행하는 group worktree 경로
const wtCwd = path.join(process.cwd(), '.tokb', 'worktrees', 'auth')

const fakeTasks = [
  { id: 't1', group_key: 'auth', phase_slug: 'external', status: 'pending' as const },
  { id: 't2', group_key: 'auth', phase_slug: 'backend', status: 'done' as const },
  { id: 't3', group_key: 'vehicle', phase_slug: 'external', status: 'pending' as const },
  { id: 't4', group_key: null as string | null, phase_slug: 'qa', status: 'pending' as const },
];

describe('filterGroupTasks', () => {
  it('group_key + phase_slug 둘 다 매칭', () => {
    const result = filterGroupTasks(fakeTasks, 'auth', 'external');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('phase_slug 미지정 시 group_key 만 매칭 (옛 동작 호환)', () => {
    const result = filterGroupTasks(fakeTasks, 'auth');
    expect(result).toHaveLength(2);
  });

  it('빈 배열 → 빈 배열', () => {
    const result = filterGroupTasks([], 'auth');
    expect(result).toEqual([]);
  });

  it('group_key 가 null 인 task 는 매칭에서 제외', () => {
    const result = filterGroupTasks(fakeTasks, 'auth');
    expect(result.every((t) => t.group_key === 'auth')).toBe(true);
    expect(result.find((t) => t.id === 't4')).toBeUndefined();
  });

  it("phaseSlug 가 빈 문자열 '' → undefined 와 다르게 명시적 매칭 시도 (해당 phase 없으면 빈 결과)", () => {
    // 빈 문자열을 명시 전달하면 phase_slug === '' 매칭 시도 — 어느 task 도 매칭 X
    const result = filterGroupTasks(fakeTasks, 'auth', '');
    expect(result).toEqual([]);
  });
});

// complete 서브커맨드 통합 테스트
function makeProgram() {
  const program = new Command()
  program.exitOverride() // process.exit 대신 throw
  groupCommand(program)
  return program
}

const allDoneTasks = [
  { id: 't1', group_key: 'auth', phase_slug: 'external', status: 'done' as const, title: 'task1', domain: null, group_type: null },
  { id: 't2', group_key: 'auth', phase_slug: 'backend', status: 'done' as const, title: 'task2', domain: null, group_type: null },
]

const pendingTasks = [
  { id: 't1', group_key: 'auth', phase_slug: 'external', status: 'done' as const, title: 'task1', domain: null, group_type: null },
  { id: 't2', group_key: 'auth', phase_slug: 'backend', status: 'pending' as const, title: 'task2', domain: null, group_type: null },
]

describe('group complete', () => {
  beforeEach(() => {
    vi.mocked(requireField).mockResolvedValue('project-uuid-1' as never)
    vi.mocked(execFileSync).mockReset()
    vi.mocked(getProjectState).mockReset()
  })

  it('--dry-run: 모든 task done → push/pr create 호출 X + skip 메시지', async () => {
    vi.mocked(getProjectState).mockResolvedValue({
      plan: null,
      run: null,
      tasks: allDoneTasks,
    })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const program = makeProgram()
    await program.parseAsync(['group', 'complete', 'auth', '--dry-run'], { from: 'user' })

    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('--dry-run'))
    consoleSpy.mockRestore()
  })

  it('미완료 task 존재 시 process.exit(1) + 미완료 목록 출력', async () => {
    vi.mocked(getProjectState).mockResolvedValue({
      plan: null,
      run: null,
      tasks: pendingTasks,
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null) => { throw new Error('process.exit') })

    const program = makeProgram()
    await expect(
      program.parseAsync(['group', 'complete', 'auth'], { from: 'user' })
    ).rejects.toThrow()

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('미완료 task'))
    exitSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('task 없는 group — process.exit(1)', async () => {
    vi.mocked(getProjectState).mockResolvedValue({
      plan: null,
      run: null,
      tasks: [],
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null) => { throw new Error('process.exit') })

    const program = makeProgram()
    await expect(
      program.parseAsync(['group', 'complete', 'auth'], { from: 'user' })
    ).rejects.toThrow()

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("group 'auth' 의 task 없음"))
    exitSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('happy path: 모든 task done → git push + gh pr create 순서대로 호출', async () => {
    vi.mocked(getProjectState).mockResolvedValue({
      plan: null,
      run: null,
      tasks: allDoneTasks,
    })
    // gh pr create 성공 시 stdout 에 PR URL 반환
    vi.mocked(execFileSync)
      .mockImplementationOnce(() => Buffer.from('')) // git push OK
      .mockImplementationOnce(() => Buffer.from('https://github.com/example/repo/pull/123\n')) // gh pr create OK
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const program = makeProgram()
    await program.parseAsync(['group', 'complete', 'auth'], { from: 'user' })

    const calls = vi.mocked(execFileSync).mock.calls
    // 첫 번째 호출: git push -u origin feat/auth-group — group worktree cwd 에서
    expect(calls[0]).toEqual(['git', ['push', '-u', 'origin', 'feat/auth-group'], { cwd: wtCwd, stdio: 'inherit' }])
    // 두 번째 호출: gh pr create (group worktree cwd, stdio: 'pipe')
    expect(calls[1][0]).toBe('gh')
    expect(calls[1][1]).toContain('pr')
    expect(calls[1][1]).toContain('create')
    expect(calls[1][1]).toContain('feat/auth-group')
    expect(calls[1][1]).toContain('feat(auth): group complete')
    expect(calls[1][2]).toMatchObject({ cwd: wtCwd, stdio: 'pipe' })

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PR 생성 완료'))
    consoleSpy.mockRestore()
  })

  it('PR already exists — skip 처리 (process.exit 없음)', async () => {
    vi.mocked(getProjectState).mockResolvedValue({
      plan: null,
      run: null,
      tasks: allDoneTasks,
    })
    // git push 성공, gh pr create 는 already exists 에러 (stdio: 'pipe' 이므로 e.stderr 에 stderr 박힘)
    vi.mocked(execFileSync)
      .mockImplementationOnce(() => Buffer.from('')) // git push OK
      .mockImplementationOnce(() => {
        const err = new Error('Command failed: gh pr create ...') as Error & { stderr?: Buffer }
        err.stderr = Buffer.from("a pull request for branch 'feat/auth-group' already exists")
        throw err
      }) // gh pr create — already exists

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const program = makeProgram()
    // process.exit 없이 정상 종료 기대
    await expect(
      program.parseAsync(['group', 'complete', 'auth'], { from: 'user' })
    ).resolves.toBeDefined()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PR already exists'))
    consoleSpy.mockRestore()
  })

  it('review 기록 없음 → process.exit(1) + review 안내 (push/pr 호출 X)', async () => {
    vi.mocked(getProjectState).mockResolvedValue({ plan: null, run: null, tasks: allDoneTasks })
    // review path 만 부재 — group worktree 는 존재
    vi.mocked(existsSync).mockImplementation((p) => !String(p).includes('reviews'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)

    const program = makeProgram()
    await expect(
      program.parseAsync(['group', 'complete', 'auth'], { from: 'user' }),
    ).rejects.toThrow()

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('review'))
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled() // push/pr 도달 X
    vi.mocked(existsSync).mockReturnValue(true) // 복원
    exitSpy.mockRestore()
    errSpy.mockRestore()
  })
});

describe('group review', () => {
  beforeEach(() => {
    vi.mocked(requireField).mockResolvedValue('project-uuid-1' as never)
    vi.mocked(writeFileSync).mockClear()
  })

  it('verdict 를 .tokb/reviews/<gk>.json 에 기록', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const program = makeProgram()
    await program.parseAsync(
      ['group', 'review', 'auth', '--simplify', 'pass', '--security', 'pass'],
      { from: 'user' },
    )

    expect(vi.mocked(writeFileSync)).toHaveBeenCalled()
    const call = vi.mocked(writeFileSync).mock.calls[0]
    expect(String(call[0])).toContain(path.join('.tokb', 'reviews', 'auth.json'))
    const rec = JSON.parse(call[1] as string)
    expect(rec).toMatchObject({ groupKey: 'auth', simplify: 'pass', security: 'pass' })
    expect(rec.reviewed_at).toBeTruthy()
    consoleSpy.mockRestore()
  })

  it('잘못된 verdict 값 → 거부 (commander choices)', async () => {
    const program = makeProgram()
    await expect(
      program.parseAsync(
        ['group', 'review', 'auth', '--simplify', 'maybe', '--security', 'pass'],
        { from: 'user' },
      ),
    ).rejects.toThrow()
  })
});

describe('reviewGate — group complete 의 simplify+security review 게이트', () => {
  const base: ReviewRecord = {
    groupKey: 'auth',
    simplify: 'pass',
    security: 'pass',
    reviewed_at: '2026-06-01T00:00:00.000Z',
  }

  it('review 기록 없음(null) — 차단 + 안내', () => {
    const r = reviewGate(null)
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/review/)
  })

  it('simplify=issues — 차단 (이슈 수정 후 재기록 필요)', () => {
    expect(reviewGate({ ...base, simplify: 'issues' }).ok).toBe(false)
  })

  it('security=issues — 차단', () => {
    expect(reviewGate({ ...base, security: 'issues' }).ok).toBe(false)
  })

  it('simplify + security 둘 다 pass — 통과', () => {
    expect(reviewGate(base).ok).toBe(true)
  })
});
