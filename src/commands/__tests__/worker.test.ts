import { describe, it, expect } from 'vitest'
import { buildWorkerPrompt } from '../worker'

const sampleSpecTask = {
  id: 'uuid-1',
  client_id: 't-001',
  phase_slug: 'design-spec',
  group_key: 'auth',
  domain: 'auth',
  description: '[SCR-001] auth 데이터 모델 명세',
  acceptance_criteria: '- [mechanical] specs/auth/data-model.md 존재\n- [semantic] PRD 와 정합',
  test_file_path: null,
}

const sampleCodeTask = {
  ...sampleSpecTask,
  id: 'uuid-2',
  phase_slug: 'core-impl',
  description: '[SCR-001] auth login API',
  test_file_path: 'src/api/auth/login.test.ts',
}

describe('buildWorkerPrompt', () => {
  it('spec phase task — test 작성 X 안내 + mechanical 검증 흐름', () => {
    const prompt = buildWorkerPrompt({
      groupKey: 'auth',
      phaseSlug: 'design-spec',
      worktreePath: '/repo/.tokb/worktrees/auth',
      tasks: [sampleSpecTask],
    })
    expect(prompt).toContain('phase_slug: design-spec')
    expect(prompt).toContain('test 작성 X')
    expect(prompt).toContain('mechanical 검증')
    expect(prompt).not.toContain('TDD red→green')
    expect(prompt).toContain('uuid-1')
    expect(prompt).toContain('specs/auth/data-model.md 존재')
  })

  it('code phase task — TDD red→green 흐름 + test 파일 작성 안내', () => {
    const prompt = buildWorkerPrompt({
      groupKey: 'auth',
      phaseSlug: 'core-impl',
      worktreePath: '/repo/.tokb/worktrees/auth',
      tasks: [sampleCodeTask],
    })
    expect(prompt).toContain('phase_slug: core-impl')
    expect(prompt).toContain('TDD red→green')
    expect(prompt).toContain('src/api/auth/login.test.ts')
    expect(prompt).not.toContain('test 작성 X')
  })

  it('worktree path / branch 명시', () => {
    const prompt = buildWorkerPrompt({
      groupKey: 'auth',
      phaseSlug: 'design-spec',
      worktreePath: '/repo/.tokb/worktrees/auth',
      tasks: [sampleSpecTask],
    })
    expect(prompt).toContain('/repo/.tokb/worktrees/auth')
    expect(prompt).toContain('feat/auth')
  })

  it('group 내 task 들 모두 포함', () => {
    const prompt = buildWorkerPrompt({
      groupKey: 'auth',
      phaseSlug: 'core-impl',
      worktreePath: '/repo/.tokb/worktrees/auth',
      tasks: [sampleCodeTask, { ...sampleCodeTask, id: 'uuid-3', client_id: 't-002' }],
    })
    expect(prompt).toContain('uuid-2')
    expect(prompt).toContain('uuid-3')
  })

  it('bypass 5 phase 다 동일 흐름 (mechanical 검증)', () => {
    const bypassPhases = ['design-spec', 'infra-setup', 'qa', 'release', 'handoff']
    for (const slug of bypassPhases) {
      const prompt = buildWorkerPrompt({
        groupKey: 'g',
        phaseSlug: slug,
        worktreePath: '/repo/.tokb/worktrees/g',
        tasks: [{ ...sampleSpecTask, phase_slug: slug }],
      })
      expect(prompt).toContain('mechanical 검증')
      expect(prompt).not.toContain('TDD red→green')
    }
  })

  it('enforce 4 phase 다 동일 흐름 (TDD red→green)', () => {
    const enforcePhases = ['design-apply', 'core-impl', 'external-integration', 'test']
    for (const slug of enforcePhases) {
      const prompt = buildWorkerPrompt({
        groupKey: 'g',
        phaseSlug: slug,
        worktreePath: '/repo/.tokb/worktrees/g',
        tasks: [{ ...sampleCodeTask, phase_slug: slug }],
      })
      expect(prompt).toContain('TDD red→green')
      expect(prompt).toContain('tokb commits push')
    }
  })
})
