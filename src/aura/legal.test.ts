import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SOURCE_REF, SOURCE_REPOSITORY, legalLinks, sourceUrl } from './legal';

const readRepoFile = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('sourceUrl', () => {
  it('points at the aura branch when no commit is known', () => {
    expect(DEFAULT_SOURCE_REF).toBe('aura');
    expect(sourceUrl(undefined)).toBe('https://github.com/ortimusirig/aura-admin/tree/aura');
    expect(sourceUrl('  ')).toBe(`${SOURCE_REPOSITORY}/tree/aura`);
  });

  it('points at the build commit', () => {
    expect(sourceUrl('3f2c1ab')).toBe(`${SOURCE_REPOSITORY}/tree/3f2c1ab`);
  });

  it.each(['bad ref', '../main', '-x', 'a?b=c', 'a#b'])('ignores the unsafe ref %s', (ref) => {
    expect(sourceUrl(ref)).toBe(`${SOURCE_REPOSITORY}/tree/aura`);
  });
});

describe('legalLinks', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('links the license, the source of this build and the notices', () => {
    vi.stubEnv('VITE_AURA_COMMIT', '0a1b2c3d');
    expect(legalLinks()).toEqual([
      { labelKey: 'com_aura_legal_license', href: '/LICENSE.txt' },
      { labelKey: 'com_aura_legal_source', href: `${SOURCE_REPOSITORY}/tree/0a1b2c3d` },
      { labelKey: 'com_aura_legal_notices', href: '/NOTICE.txt' },
    ]);
  });
});

describe('legal files', () => {
  it('serves an exact copy of LICENSE', () => {
    expect(readRepoFile('public/LICENSE.txt')).toBe(readRepoFile('LICENSE'));
  });

  it('serves an exact copy of NOTICE', () => {
    expect(readRepoFile('public/NOTICE.txt')).toBe(readRepoFile('NOTICE'));
  });

  it('states the required notices', () => {
    const notice = readRepoFile('NOTICE');
    expect(notice).toContain('https://github.com/LibreChat-AI/admin-panel');
    expect(notice).toContain('Modifications copyright 2026 Applexus Technologies');
    expect(notice).toContain('AGPL-3.0 section 7(e)');
    expect(notice).toContain('AURA_BRAND_NAME or AURA_BRAND_DIR');
    expect(notice).toContain('not affiliated with or endorsed by them');
    expect(notice).toContain('keep their own licences');
  });
});
