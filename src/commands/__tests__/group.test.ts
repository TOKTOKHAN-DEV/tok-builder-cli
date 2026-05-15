import { describe, it, expect } from 'vitest';
import { filterGroupTasks } from '../group';

const fakeTasks = [
  { id: 't1', group_key: 'auth', phase_slug: 'design-spec', status: 'pending' as const },
  { id: 't2', group_key: 'auth', phase_slug: 'core-impl', status: 'done' as const },
  { id: 't3', group_key: 'vehicle', phase_slug: 'design-spec', status: 'pending' as const },
  { id: 't4', group_key: null as string | null, phase_slug: 'qa', status: 'pending' as const },
];

describe('filterGroupTasks', () => {
  it('group_key + phase_slug 둘 다 매칭', () => {
    const result = filterGroupTasks(fakeTasks, 'auth', 'design-spec');
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
