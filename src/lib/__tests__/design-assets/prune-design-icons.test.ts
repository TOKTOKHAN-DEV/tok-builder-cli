import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruneDesignIcons } from '../../design-assets/prune-design-icons';

const STYLES = [
  'regular_straight',
  'regular_rounded',
  'bold_straight',
  'bold_rounded',
  'solid_straight',
  'solid_rounded',
] as const;

function seedTemplate(repoRoot: string): void {
  const iconsRoot = join(repoRoot, 'src/assets/icons');
  for (const style of STYLES) {
    const dir = join(iconsRoot, style);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'fi-bell.svg'), '<svg/>');
    writeFileSync(join(dir, 'fi-home.svg'), '<svg/>');
  }
  writeFileSync(join(iconsRoot, 'icon-manifest.json'), '{}');
}

describe('pruneDesignIcons', () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = mkdtempSync(join(tmpdir(), 'prune-test-'));
    seedTemplate(tmpRepo);
  });

  afterEach(() => {
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  it('keepStyle 외 5 폴더 삭제', () => {
    const result = pruneDesignIcons({
      keepStyle: 'regular_straight',
      targetRepoRoot: tmpRepo,
    });
    expect(result.removedStyles).toHaveLength(5);
    expect(result.keptCount).toBe(2);
    expect(existsSync(join(tmpRepo, 'src/assets/icons/regular_straight'))).toBe(true);
    for (const style of STYLES) {
      if (style === 'regular_straight') continue;
      expect(existsSync(join(tmpRepo, 'src/assets/icons', style))).toBe(false);
    }
    // manifest 는 보존
    expect(existsSync(join(tmpRepo, 'src/assets/icons/icon-manifest.json'))).toBe(true);
  });

  it('icons root 가 없으면 throw', () => {
    rmSync(join(tmpRepo, 'src/assets/icons'), { recursive: true });
    expect(() =>
      pruneDesignIcons({ keepStyle: 'regular_straight', targetRepoRoot: tmpRepo }),
    ).toThrow(/src\/assets\/icons\//);
  });

  it('keepStyle 폴더가 없으면 throw', () => {
    rmSync(join(tmpRepo, 'src/assets/icons/regular_straight'), { recursive: true });
    expect(() =>
      pruneDesignIcons({ keepStyle: 'regular_straight', targetRepoRoot: tmpRepo }),
    ).toThrow(/keepStyle/);
  });
});
