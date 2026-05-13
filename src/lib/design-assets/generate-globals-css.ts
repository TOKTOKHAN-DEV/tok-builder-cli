import { converter } from 'culori';

import type { DesignTokens } from './schema';

import { resolveAllRefs, getPath } from './resolve-refs';

const toOklch = converter('oklch');

/**
 * design.md 색상 토큰 → Tailwind v4 + shadcn-v4 호환 globals.css 생성
 *
 * 흐름:
 *   :root에 raw color 변수 (--primary 등)를 OKLCH 값으로 두고,
 *   @theme inline에서 --color-* 변수로 매핑하여 utility class 자동 생성.
 *
 * semantic 값이 {colors.x.y} 참조면 실제 hex로 치환 후 OKLCH 변환.
 */
export function generateGlobalsCss(tokens: DesignTokens): string {
  const rootSemanticVars = buildSemanticCssVars(tokens);
  const rootMotionVars = buildMotionCssVars(tokens);
  const themeSemanticVars = buildThemeInlineVars(tokens);
  const themeMotionVars = buildThemeMotionVars(tokens);
  const componentStyles = buildComponentCss(tokens);

  return `/* Auto-generated from design.md — do not edit directly.
   Source of truth: design.md YAML tokens.
   To update: edit design.md → re-run export. */
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: var(--font-pretendard);
${themeSemanticVars}
${themeMotionVars}
}

:root {
${rootSemanticVars}
${rootMotionVars}
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-sans);
  }
}
${componentStyles}`;
}

const REF_RE = /^\{colors\.(.+)\}$/;

function resolveSemanticHex(
  raw: string,
  colors: Record<string, unknown>,
): string | null {
  const match = REF_RE.exec(raw);
  if (!match) return raw.startsWith('#') ? raw : null;
  const resolved = getPath(colors, match[1]);
  return typeof resolved === 'string' ? resolved : null;
}

function hexToOklch(hex: string): string {
  const color = toOklch(hex);
  if (!color) return hex;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- 방어적 null 체크. Supabase 응답/런타임 안전성.
  const l = (color.l ?? 0).toFixed(4);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- 방어적 null 체크. Supabase 응답/런타임 안전성.
  const c = (color.c ?? 0).toFixed(4);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- 방어적 null 체크. Supabase 응답/런타임 안전성.
  const h = Number.isFinite(color.h) ? (color.h ?? 0).toFixed(3) : '0';
  return `oklch(${l} ${c} ${h})`;
}

function buildSemanticCssVars(tokens: DesignTokens): string {
  const colors = tokens.colors as Record<string, unknown>;
  const semantic = colors.semantic as Record<string, string>;

  return Object.entries(semantic)
    .map(([key, rawVal]) => {
      const hex = resolveSemanticHex(rawVal, colors);
      const cssVal = hex ? hexToOklch(hex) : rawVal;
      return `  --${key}: ${cssVal};`;
    })
    .join('\n');
}

function buildThemeInlineVars(tokens: DesignTokens): string {
  const colors = tokens.colors as Record<string, unknown>;
  const semantic = colors.semantic as Record<string, string>;

  return Object.keys(semantic)
    .map((key) => `  --color-${key}: var(--${key});`)
    .join('\n');
}

function buildMotionCssVars(tokens: DesignTokens): string {
  const motion = tokens.motion;
  const lines: string[] = [];
  for (const [key, value] of Object.entries(motion.duration)) {
    lines.push(`  --duration-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(motion.ease)) {
    lines.push(`  --ease-${key}: ${value};`);
  }
  return lines.join('\n');
}

function buildThemeMotionVars(tokens: DesignTokens): string {
  const motion = tokens.motion;
  const lines: string[] = [];
  for (const key of Object.keys(motion.duration)) {
    lines.push(`  --motion-duration-${key}: var(--duration-${key});`);
  }
  for (const key of Object.keys(motion.ease)) {
    lines.push(`  --motion-ease-${key}: var(--ease-${key});`);
  }
  return lines.join('\n');
}

function buildComponentCss(tokens: DesignTokens): string {
  const resolved = resolveAllRefs(
    tokens.components as Record<string, Record<string, string>>,
    tokens as unknown as Record<string, unknown>,
  );

  const classes = Object.entries(resolved)
    .map(([name, props]) => {
      const decls = Object.entries(props)
        .map(([prop, val]) => `    ${prop}: ${val};`)
        .join('\n');
      return `  .token-${name} {\n${decls}\n  }`;
    })
    .join('\n\n');

  if (!classes) return '';

  return `
@layer components {
  /* 토큰 기반 참조 클래스 */
${classes}
}
`;
}
