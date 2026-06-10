import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapDesignAssets } from '../../design-assets';

const __dirname = dirname(fileURLToPath(import.meta.url));

const validDesignMd = `---
colors:
  primary:
    50: '#ECF1FF'
    100: '#DDE5FF'
    200: '#BFCCFF'
    300: '#9FB1FF'
    400: '#7585FF'
    500: '#4850FF'
    600: '#3C36F5'
    700: '#2F25D1'
    800: '#241BA0'
    900: '#1B146F'
    950: '#0E0A47'
  gray:
    50: '#FAFAFA'
    100: '#F4F4F5'
    200: '#E4E4E7'
    300: '#D4D4D8'
    400: '#A1A1AA'
    500: '#71717A'
    600: '#52525B'
    700: '#3F3F46'
    800: '#27272A'
    900: '#18181B'
    950: '#09090B'
  semantic:
    background: '#ffffff'
    foreground: '#000000'
    card: '#ffffff'
    card-foreground: '#000000'
    popover: '#ffffff'
    popover-foreground: '#000000'
    primary: '{colors.primary.500}'
    primary-foreground: '#ffffff'
    secondary: '#eeeeee'
    secondary-foreground: '#000000'
    muted: '#f3f4f6'
    muted-foreground: '#525252'
    accent: '#dddddd'
    accent-foreground: '#000000'
    border: '#e5e5e5'
    input: '#e5e5e5'
    ring: '{colors.primary.500}'
    destructive: '#DC2626'
    destructive-foreground: '#ffffff'
    success: '#15803D'
    success-foreground: '#ffffff'
    warning: '#F59E0B'
    warning-foreground: '#000000'
    info: '#2563EB'
    info-foreground: '#ffffff'
typography:
  fontFamily:
    sans: ["Pretendard"]
  scale:
    xs:   { size: "12px", lineHeight: "1.5", weight: "regular" }
    sm:   { size: "13px", lineHeight: "1.5", weight: "regular" }
    base: { size: "14px", lineHeight: "1.5", weight: "regular" }
    lg:   { size: "16px", lineHeight: "1.5", weight: "regular" }
    xl:   { size: "18px", lineHeight: "1.5", weight: "semibold" }
    2xl:  { size: "20px", lineHeight: "1.4", weight: "semibold" }
    3xl:  { size: "24px", lineHeight: "1.3", weight: "bold" }
    4xl:  { size: "30px", lineHeight: "1.2", weight: "bold" }
    5xl:  { size: "36px", lineHeight: "1.1", weight: "bold" }
  weight:
    normal: 400
    medium: 500
    semibold: 600
    bold: 700
rounded:
  none: "0"
  sm:   "2px"
  md:   "4px"
  lg:   "8px"
  full: "9999px"
spacing:
  breakpoints:
    sm:   "640px"
    md:   "768px"
    lg:   "1024px"
    xl:   "1280px"
    2xl:  "1536px"
components:
  button-primary:
    background: '{colors.primary.500}'
  button-secondary:
    background: '{colors.gray.100}'
  input:
    border: '{colors.gray.200}'
  card:
    background: '{colors.semantic.card}'
  alert:
    background: '{colors.semantic.warning}'
motion:
  duration:
    fast:   "150ms"
    normal: "200ms"
    slow:   "300ms"
  ease:
    standard: "linear"
    in:       "cubic-bezier(0.4, 0, 1, 1)"
    out:      "cubic-bezier(0, 0, 0.2, 1)"
    in-out:   "cubic-bezier(0.4, 0, 0.2, 1)"
---
# Body
`;

describe('bootstrapDesignAssets', () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = mkdtempSync(join(tmpdir(), 'bootstrap-test-'));
    mkdirSync(join(tmpRepo, '.tokb'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  it('정상 design.md 전체 흐름 성공 (globals.css 생성)', () => {
    writeFileSync(join(tmpRepo, '.tokb/design.md'), validDesignMd);
    const result = bootstrapDesignAssets({ repoRoot: tmpRepo, skipCommit: true });

    expect(existsSync(result.globalsCssPath)).toBe(true);

    const css = readFileSync(result.globalsCssPath, 'utf-8');
    expect(css).toContain('@import "tailwindcss";');

    expect(result.committed).toBe(false); // skipCommit: true 이므로
    expect(result.pushed).toBe(false);    // commit 안 됐으니 push 도 안 됨
  });

  it('design.md 없으면 throw', () => {
    expect(() => bootstrapDesignAssets({ repoRoot: tmpRepo, skipCommit: true })).toThrow(
      /\.tokb\/design\.md 가 없습니다/,
    );
  });

  it('schema 위반 design.md 는 throw with 메시지', () => {
    const broken = validDesignMd.replace('normal: 400', 'normal: 500');
    writeFileSync(join(tmpRepo, '.tokb/design.md'), broken);
    expect(() => bootstrapDesignAssets({ repoRoot: tmpRepo, skipCommit: true })).toThrow(
      /design\.md schema 검증 실패/,
    );
  });

  // 사용자 실제 build repo 의 design.md fixture — 도메인 정보 포함이라 git 비커밋 (의도).
  // 로컬 머신에선 실행, CI 에선 skip.
  const realFixturePath = join(__dirname, 'real-design-md.fixture.md');
  it.skipIf(!existsSync(realFixturePath))('real design.md (사용자 build repo) — globals.css 에 unresolved ref 없음 + 기본 구조 통과', () => {
    const realDesignMd = readFileSync(realFixturePath, 'utf-8');
    writeFileSync(join(tmpRepo, '.tokb/design.md'), realDesignMd);

    const result = bootstrapDesignAssets({ repoRoot: tmpRepo, skipCommit: true });

    // globals.css 생성 확인
    const css = readFileSync(result.globalsCssPath, 'utf-8');

    // 핵심 invariant: 모든 ref 완전 resolve — raw {x.y.z} 가 남아있으면 fail
    expect(css).not.toMatch(/\{[a-zA-Z][^}]*\}/);

    // Tailwind v4 기본 구조 통과
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain('@theme inline {');

    // CSS brace 매칭 검증
    const openBraces = (css.match(/\{/g) ?? []).length;
    const closeBraces = (css.match(/\}/g) ?? []).length;
    expect(openBraces).toBe(closeBraces);
  });
});
