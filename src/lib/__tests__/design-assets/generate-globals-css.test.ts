import { describe, it, expect } from 'vitest';
import { generateGlobalsCss } from '../../design-assets/generate-globals-css';
import type { DesignTokens } from '../../design-assets/schema';

const minimalTokens = {
  colors: {
    primary: Object.fromEntries(
      [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => [s, '#4850FF']),
    ),
    gray: Object.fromEntries(
      [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => [s, '#888888']),
    ),
    semantic: {
      background: '#ffffff', foreground: '#000000',
      card: '#ffffff', 'card-foreground': '#000000',
      popover: '#ffffff', 'popover-foreground': '#000000',
      primary: '{colors.primary.500}', 'primary-foreground': '#ffffff',
      secondary: '#eeeeee', 'secondary-foreground': '#000000',
      muted: '#f3f4f6', 'muted-foreground': '#525252',
      accent: '#ddd', 'accent-foreground': '#000',
      border: '#e5e5e5', input: '#e5e5e5', ring: '{colors.primary.500}',
      destructive: '#DC2626', 'destructive-foreground': '#fff',
      success: '#15803D', 'success-foreground': '#fff',
      warning: '#F59E0B', 'warning-foreground': '#000',
      info: '#2563EB', 'info-foreground': '#fff',
    },
  },
  typography: {
    fontFamily: { sans: ['Pretendard', 'sans-serif'] },
    scale: Object.fromEntries(
      ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'].map((k) => [
        k, { size: '16px', lineHeight: '1.5', weight: 'regular' as const },
      ]),
    ),
    weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  rounded: { none: '0', sm: '2px', md: '4px', lg: '8px', full: '9999px' },
  spacing: { breakpoints: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' } },
  icons: { style: 'regular_straight' as const, source: 'flaticon-uicons' as const, rationale: 'pilot default' },
  components: {
    'button-primary': { background: '{colors.primary.500}' },
    'button-secondary': { background: '{colors.gray.100}' },
    input: { border: '{colors.gray.200}' },
    card: { background: '{colors.semantic.card}' },
    alert: { background: '{colors.semantic.warning}' },
  },
  motion: {
    duration: { fast: '150ms', normal: '200ms', slow: '300ms' },
    ease: { standard: 'linear', in: 'cubic-bezier(0.4, 0, 1, 1)', out: 'cubic-bezier(0, 0, 0.2, 1)', 'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)' },
  },
} as DesignTokens;

describe('generateGlobalsCss', () => {
  it('@import "tailwindcss" + @theme inline + :root 포함', () => {
    const css = generateGlobalsCss(minimalTokens);
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain('@theme inline {');
    expect(css).toContain(':root {');
    expect(css).toContain('--background:');
    expect(css).toContain('--color-background: var(--background);');
    expect(css).toContain('--duration-fast: 150ms;');
  });

  it('semantic 참조가 oklch 로 resolve 됨', () => {
    const css = generateGlobalsCss(minimalTokens);
    expect(css).toMatch(/--primary: oklch\(/);
  });

  it('component classes 생성', () => {
    const css = generateGlobalsCss(minimalTokens);
    expect(css).toContain('.token-button-primary {');
    expect(css).toContain('.token-card {');
  });
});
