import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { generateGlobalsCss } from './generate-globals-css';
import { parseDesignMd } from './parse-design-md';
import { pruneDesignIcons } from './prune-design-icons';
import { safeParseDesignTokens } from './schema';
import type { IconStyle } from './schema';

export interface BootstrapDesignAssetsArgs {
  /** build repo 루트 (=`tokb init` 실행 위치) */
  repoRoot: string;
  /** test 환경에서 git commit 건너뛰기 */
  skipCommit?: boolean;
}

export interface BootstrapDesignAssetsResult {
  globalsCssPath: string;
  iconsDir: string;
  iconCount: number;
  committed: boolean;
}

export function bootstrapDesignAssets(
  args: BootstrapDesignAssetsArgs,
): BootstrapDesignAssetsResult {
  const { repoRoot, skipCommit = false } = args;

  // 1. .tokb/design.md 존재 확인
  const designMdPath = join(repoRoot, '.tokb/design.md');
  if (!existsSync(designMdPath)) {
    throw new Error(
      '.tokb/design.md 가 없습니다. platform 측 inject 가 실패했을 수 있습니다. ' +
        'platform 에서 빌드를 다시 시작해주세요.',
    );
  }

  // 2. parse + 검증
  const designMdRaw = readFileSync(designMdPath, 'utf-8');
  const parsed = parseDesignMd(designMdRaw);
  const validated = safeParseDesignTokens(parsed.tokens);
  if (!validated.success) {
    const issueSummary = validated.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(
      `design.md schema 검증 실패: ${issueSummary}. ` +
        'platform 에서 design 재생성이 필요합니다.',
    );
  }

  // 3. globals.css 생성 + 작성
  const css = generateGlobalsCss(validated.data);
  const globalsCssPath = join(repoRoot, 'app/globals.css');
  mkdirSync(dirname(globalsCssPath), { recursive: true });
  writeFileSync(globalsCssPath, css, 'utf-8');

  // 4. 아이콘 정리 (template 이 6 style 다 들고 있고, 1 style 만 유지)
  const iconStyle = validated.data.icons.style;
  const pruneResult = pruneDesignIcons({
    keepStyle: iconStyle,
    targetRepoRoot: repoRoot,
  });

  // 5. git commit
  let committed = false;
  if (!skipCommit) {
    try {
      execSync('git add app/globals.css src/assets/icons', {
        cwd: repoRoot,
        stdio: 'pipe',
      });
      execSync(
        'git commit -m "chore: bootstrap design assets from .tokb/design.md"',
        { cwd: repoRoot, stdio: 'pipe' },
      );
      committed = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // commit 실패는 throw 안 함 — 파일은 이미 생성됨. 사용자 수동 commit 가능.
      console.warn(`[bootstrap-design-assets] git commit 건너뜀: ${msg}`);
    }
  }

  return {
    globalsCssPath,
    iconsDir: pruneResult.keptDir,
    iconCount: pruneResult.keptCount,
    committed,
  };
}

export type { IconStyle };
