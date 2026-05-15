import { describe, it, expect } from 'vitest';
import { filterGroupTasks } from '../group';

const fakeTasks = [
  { id: 't1', group_key: 'auth', phase_slug: 'design-spec', status: 'pending' as const },
  { id: 't2', group_key: 'auth', phase_slug: 'core-impl', status: 'done' as const },
  { id: 't3', group_key: 'vehicle', phase_slug: 'design-spec', status: 'pending' as const },
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
});
