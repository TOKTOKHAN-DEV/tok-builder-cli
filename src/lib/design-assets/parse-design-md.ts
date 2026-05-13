import * as yaml from 'js-yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export interface ParsedDesignMd {
  tokens: Record<string, unknown>;
  body: string;
  raw: string;
}

export function parseDesignMd(raw: string): ParsedDesignMd {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    throw new Error('design.md 에 YAML 프론트매터(--- 블록)가 없습니다.');
  }
  const tokens = yaml.load(match[1]) as Record<string, unknown>;
  const body = raw.slice(match[0].length);
  return { tokens, body, raw };
}
