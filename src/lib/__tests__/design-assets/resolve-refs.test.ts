import { describe, it, expect } from 'vitest';
import { resolveRef, resolveAllRefs, getPath } from '../../design-assets/resolve-refs';

describe('resolveRef', () => {
  const tokens = {
    colors: {
      gray: { '200': '#E4E4E7', '950': '#09090B' },
      semantic: {
        border: '{colors.gray.200}',   // nested ref → gray.200
        background: '#ffffff',          // direct hex
        foreground: '{colors.gray.950}', // nested ref → gray.950
      },
    },
    typography: {
      weight: { normal: 400, semibold: 600 },
    },
  };

  it('simple string ref → resolves to hex', () => {
    expect(resolveRef('{colors.semantic.background}', tokens)).toBe('#ffffff');
  });

  it('number ref → converted to String()', () => {
    expect(resolveRef('{typography.weight.semibold}', tokens)).toBe('600');
  });

  it('nested ref (semantic.border → gray.200) → fully resolved', () => {
    expect(resolveRef('{colors.semantic.border}', tokens)).toBe('#E4E4E7');
  });

  it('multi-level nested ref (semantic.foreground → gray.950)', () => {
    expect(resolveRef('{colors.semantic.foreground}', tokens)).toBe('#09090B');
  });

  it('multi-ref in one string — all resolved', () => {
    expect(resolveRef('1px solid {colors.semantic.border}', tokens))
      .toBe('1px solid #E4E4E7');
  });

  it('unresolved ref (path not found) → kept as-is {path}', () => {
    expect(resolveRef('{colors.missing}', tokens)).toBe('{colors.missing}');
  });

  it('circular ref → depth limit prevents infinite recursion', () => {
    const circular: Record<string, unknown> = { a: '{b}', b: '{a}' };
    const result = resolveRef('{a}', circular);
    // depth 10 후 멈춤 — 결과는 {a} or {b} (alternating at limit)
    expect(['{a}', '{b}']).toContain(result);
  });

  it('no ref in input → unchanged', () => {
    expect(resolveRef('plain text', tokens)).toBe('plain text');
    expect(resolveRef('#ffffff', tokens)).toBe('#ffffff');
  });

  it('resolved value is object/array → fallback to placeholder', () => {
    const tokensWithObj = { x: { y: { z: ['a', 'b'] } } };
    expect(resolveRef('{x.y.z}', tokensWithObj)).toBe('{x.y.z}');
  });
});

describe('resolveAllRefs', () => {
  it('deeply nested object: all string refs resolved (nested ref chain)', () => {
    const tokens = {
      colors: {
        gray: { '200': '#E4E4E7' },
        semantic: { border: '{colors.gray.200}' }, // nested ref
      },
    };
    const obj = {
      input: { border: '1px solid {colors.semantic.border}' },
    };
    const result = resolveAllRefs(obj, tokens);
    expect(result.input.border).toBe('1px solid #E4E4E7');
  });

  it('non-string values: preserved as-is', () => {
    const obj = { count: 5, flag: true, nested: { name: 'x' } } as Record<string, unknown>;
    const result = resolveAllRefs(obj, {});
    expect(result.count).toBe(5);
    expect(result.flag).toBe(true);
  });
});

describe('getPath', () => {
  const obj = { a: { b: { c: 'value' } } };

  it('simple dotted path', () => expect(getPath(obj, 'a.b.c')).toBe('value'));
  it('missing path → undefined', () => expect(getPath(obj, 'a.x.y')).toBeUndefined());
  it('null intermediate → undefined', () => {
    expect(getPath({ a: null }, 'a.b')).toBeUndefined();
  });
});
