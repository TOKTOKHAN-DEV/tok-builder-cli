import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrapDesignAssets } from '../../design-assets';

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
icons:
  style: regular_straight
  source: flaticon-uicons
  rationale: pilot default for clarity and modern look
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

const STYLES = [
  'regular_straight', 'regular_rounded',
  'bold_straight', 'bold_rounded',
  'solid_straight', 'solid_rounded',
] as const;

function seedTemplateAssets(repoRoot: string): void {
  const iconsRoot = join(repoRoot, 'src/assets/icons');
  for (const style of STYLES) {
    const dir = join(iconsRoot, style);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'fi-bell.svg'), '<svg/>');
    writeFileSync(join(dir, 'fi-home.svg'), '<svg/>');
  }
  writeFileSync(join(iconsRoot, 'icon-manifest.json'), '{}');
}

describe('bootstrapDesignAssets', () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = mkdtempSync(join(tmpdir(), 'bootstrap-test-'));
    mkdirSync(join(tmpRepo, '.tokb'), { recursive: true });
    seedTemplateAssets(tmpRepo);
  });

  afterEach(() => {
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  it('정상 design.md 전체 흐름 성공 (5 폴더 정리 + 1 유지)', () => {
    writeFileSync(join(tmpRepo, '.tokb/design.md'), validDesignMd);
    const result = bootstrapDesignAssets({ repoRoot: tmpRepo, skipCommit: true });

    expect(existsSync(result.globalsCssPath)).toBe(true);
    expect(existsSync(result.iconsDir)).toBe(true);
    expect(result.iconCount).toBe(2); // seed 의 2 SVG

    expect(existsSync(join(tmpRepo, 'src/assets/icons/regular_straight'))).toBe(true);
    for (const style of STYLES) {
      if (style === 'regular_straight') continue;
      expect(existsSync(join(tmpRepo, 'src/assets/icons', style))).toBe(false);
    }

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

  it('template 자산이 없으면 throw (icons root missing)', () => {
    rmSync(join(tmpRepo, 'src/assets/icons'), { recursive: true });
    writeFileSync(join(tmpRepo, '.tokb/design.md'), validDesignMd);
    expect(() => bootstrapDesignAssets({ repoRoot: tmpRepo, skipCommit: true })).toThrow(
      /src\/assets\/icons\//,
    );
  });
});
