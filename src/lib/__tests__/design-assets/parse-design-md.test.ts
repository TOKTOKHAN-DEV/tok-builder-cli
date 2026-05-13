import { describe, it, expect } from 'vitest';
import { parseDesignMd } from '../../design-assets/parse-design-md';

describe('parseDesignMd', () => {
  it('frontmatter + body 정상 추출', () => {
    const raw = `---\ncolors:\n  primary: '#4850FF'\n---\n# Body\nhello`;
    const r = parseDesignMd(raw);
    expect(r.tokens).toEqual({ colors: { primary: '#4850FF' } });
    expect(r.body).toContain('# Body');
  });

  it('frontmatter 없으면 throw', () => {
    expect(() => parseDesignMd('no frontmatter')).toThrow(/프론트매터/);
  });
});
