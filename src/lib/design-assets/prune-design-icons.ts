import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type IconStyle =
  | 'regular_straight'
  | 'regular_rounded'
  | 'bold_straight'
  | 'bold_rounded'
  | 'solid_straight'
  | 'solid_rounded';

const ALL_STYLES: IconStyle[] = [
  'regular_straight',
  'regular_rounded',
  'bold_straight',
  'bold_rounded',
  'solid_straight',
  'solid_rounded',
];

export interface PruneDesignIconsArgs {
  /** design.md 의 icons.style 결정 — 이 폴더만 남김 */
  keepStyle: IconStyle;
  /** build repo 루트 — src/assets/icons 가 그 아래 있음 */
  targetRepoRoot: string;
}

export interface PruneDesignIconsResult {
  keptDir: string;
  keptCount: number;
  removedStyles: IconStyle[];
}

export function pruneDesignIcons(args: PruneDesignIconsArgs): PruneDesignIconsResult {
  const { keepStyle, targetRepoRoot } = args;

  const iconsRoot = join(targetRepoRoot, 'src/assets/icons');
  if (!existsSync(iconsRoot)) {
    throw new Error(
      `src/assets/icons/ 가 build repo 에 없습니다 (template fork 가 stale 또는 자산 누락). ` +
        `tok-builder-template 의 src/assets/icons 가 fork 시점에 들어가야 합니다.`,
    );
  }

  const keptDir = join(iconsRoot, keepStyle);
  if (!existsSync(keptDir) || !statSync(keptDir).isDirectory()) {
    throw new Error(
      `keepStyle "${keepStyle}" 폴더가 src/assets/icons/ 에 없습니다. ` +
        `template 의 icons 자산이 stale 하거나 design.md 의 icons.style 이 잘못됨.`,
    );
  }

  const removedStyles: IconStyle[] = [];
  for (const style of ALL_STYLES) {
    if (style === keepStyle) continue;
    const dir = join(iconsRoot, style);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      removedStyles.push(style);
    }
  }

  const keptCount = readdirSync(keptDir).filter((n) => n.endsWith('.svg')).length;
  if (keptCount === 0) {
    throw new Error(`정리 후 "${keepStyle}" 폴더에 SVG 0개 — 자산 무결성 깨짐.`);
  }

  return { keptDir, keptCount, removedStyles };
}
