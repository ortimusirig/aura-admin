import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const verifyAdminTokenMock = vi.fn();

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: (...args: never[]) => unknown) => fn,
    inputValidator: () => ({
      handler: (fn: (...args: never[]) => unknown) => fn,
    }),
  }),
  createServerOnlyFn: (fn: (...args: never[]) => unknown) => fn,
}));

vi.mock('./auth', () => ({
  verifyAdminTokenFn: () => verifyAdminTokenMock(),
}));

import { adminLinksOptions, getAdminLinksFn, getAuraSettingsFn, getToolFrameSrcFn } from './aura';

const LINKS = [
  { id: 'metrics', label: 'Metrics', href: 'https://metrics.example.com/', mode: 'embed', icon: 'metrics' },
  { id: 'rota', label: 'On call', mode: 'text', note: 'See the rota' },
];

const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

beforeEach(() => {
  verifyAdminTokenMock.mockReset();
  warnSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAdminLinksFn', () => {
  it('returns an empty list without a valid session', async () => {
    vi.stubEnv('AURA_ADMIN_LINKS', JSON.stringify(LINKS));
    verifyAdminTokenMock.mockResolvedValue({ valid: false, error: 'No session found' });

    await expect(getAdminLinksFn()).resolves.toEqual([]);
    expect(verifyAdminTokenMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list when the session check fails', async () => {
    vi.stubEnv('AURA_ADMIN_LINKS', JSON.stringify(LINKS));
    verifyAdminTokenMock.mockRejectedValue(new Error('boom'));

    await expect(getAdminLinksFn()).resolves.toEqual([]);
  });

  it('returns the parsed list for a signed-in admin', async () => {
    vi.stubEnv('AURA_ADMIN_LINKS', JSON.stringify(LINKS));
    verifyAdminTokenMock.mockResolvedValue({ valid: true, user: { id: 'user-1' } });

    await expect(getAdminLinksFn()).resolves.toEqual([
      { id: 'metrics', label: 'Metrics', href: 'https://metrics.example.com/', mode: 'embed', icon: 'metrics' },
      { id: 'rota', label: 'On call', mode: 'text', note: 'See the rota', icon: 'popout' },
    ]);
  });

  it('returns an empty list when nothing is configured', async () => {
    verifyAdminTokenMock.mockResolvedValue({ valid: true, user: { id: 'user-1' } });

    await expect(getAdminLinksFn()).resolves.toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs one warning for invalid JSON and never the raw value', async () => {
    const raw = '[{"id":"secret-token-value",';
    vi.stubEnv('AURA_ADMIN_LINKS', raw);
    verifyAdminTokenMock.mockResolvedValue({ valid: true, user: { id: 'user-1' } });

    await expect(getAdminLinksFn()).resolves.toEqual([]);
    await expect(getAdminLinksFn()).resolves.toEqual([]);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0][0]);
    expect(message).toContain('invalid-json');
    expect(message).not.toContain('secret-token-value');
  });

  it('logs the positions of dropped entries once', async () => {
    vi.stubEnv(
      'AURA_ADMIN_LINKS',
      JSON.stringify([...LINKS, { id: 'bad', label: 'Bad', href: 'javascript:alert(1)' }]),
    );
    verifyAdminTokenMock.mockResolvedValue({ valid: true, user: { id: 'user-1' } });

    const links = await getAdminLinksFn();
    await getAdminLinksFn();

    expect(links.map((link) => link.id)).toEqual(['metrics', 'rota']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('positions 2');
    expect(String(warnSpy.mock.calls[0][0])).not.toContain('javascript');
  });
});

describe('getToolFrameSrcFn', () => {
  const SECRET = 'panel-test-secret-0123456789-abcdef';
  const TOOLS = [
    { id: 'console', label: 'Console', href: '/console/?tab=usage#spend', mode: 'embed', icon: 'console' },
    { id: 'reports', label: 'Reports', href: '/reports/', mode: 'embed', audience: 'reports' },
    { id: 'remote', label: 'Remote', href: 'https://tools.example.com/', mode: 'embed' },
    { id: 'docs', label: 'Docs', href: '/docs/', mode: 'tab' },
    { id: 'rota', label: 'On call', mode: 'text', note: 'See the rota' },
  ];
  const ADMIN = { valid: true, user: { id: 'user-1', email: 'Ada@Example.com' } };
  const PASS_SRC = /^\/console\/\?tab=usage&aura_pass=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})#spend$/;

  const srcFor = (id: string) => getToolFrameSrcFn({ data: { id } });
  const claimsOf = (encoded: string) => JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  const logSpies = (['log', 'info', 'debug', 'error'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => undefined),
  );

  beforeEach(() => {
    vi.stubEnv('AURA_ADMIN_LINKS', JSON.stringify(TOOLS));
    vi.stubEnv('AURA_TOOLS_PASS_SECRET', SECRET);
    verifyAdminTokenMock.mockResolvedValue(ADMIN);
    logSpies.forEach((spy) => spy.mockClear());
  });

  it('answers nothing without a valid session', async () => {
    verifyAdminTokenMock.mockResolvedValue({ valid: false, error: 'No session found' });

    await expect(srcFor('console')).resolves.toBeNull();
    expect(verifyAdminTokenMock).toHaveBeenCalledTimes(1);
  });

  it('answers nothing when the session check fails', async () => {
    verifyAdminTokenMock.mockRejectedValue(new Error('boom'));

    await expect(srcFor('console')).resolves.toBeNull();
  });

  it('adds a fresh pass for the signed-in admin to a same-origin embed', async () => {
    const before = Math.floor(Date.now() / 1000);
    const first = await srcFor('console');
    const second = await srcFor('console');

    const match = first?.match(PASS_SRC);
    expect(match).not.toBeNull();
    expect(second).toMatch(PASS_SRC);
    expect(second).not.toBe(first);

    const claims = claimsOf(match?.[1] ?? '');
    expect(claims).toEqual({
      v: 1,
      sub: 'ada@example.com',
      aud: 'console',
      iat: expect.any(Number),
      exp: claims.iat + 60,
      jti: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
    expect(claims.iat).toBeGreaterThanOrEqual(before);
  });

  it('uses the audience of the entry', async () => {
    const src = await srcFor('reports');
    const pass = src?.match(/^\/reports\/\?aura_pass=([A-Za-z0-9_-]+)\./);

    expect(claimsOf(pass?.[1] ?? '').aud).toBe('reports');
  });

  it('returns the plain href for other origins and tab entries, and nothing for text entries or unknown ids', async () => {
    await expect(srcFor('remote')).resolves.toBe('https://tools.example.com/');
    await expect(srcFor('docs')).resolves.toBe('/docs/');
    await expect(srcFor('rota')).resolves.toBeNull();
    await expect(srcFor('missing')).resolves.toBeNull();
  });

  it('adds no pass when the session has no email', async () => {
    verifyAdminTokenMock.mockResolvedValue({ valid: true, user: { id: 'user-1' } });

    await expect(srcFor('console')).resolves.toBe('/console/?tab=usage#spend');
  });

  it('adds no pass without a secret', async () => {
    vi.stubEnv('AURA_TOOLS_PASS_SECRET', undefined);

    await expect(srcFor('console')).resolves.toBe('/console/?tab=usage#spend');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('adds no pass with a short secret and warns once without the value', async () => {
    const short = 'short-secret-value-under-32';
    vi.stubEnv('AURA_TOOLS_PASS_SECRET', short);

    await expect(srcFor('console')).resolves.toBe('/console/?tab=usage#spend');
    await expect(srcFor('console')).resolves.toBe('/console/?tab=usage#spend');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0][0]);
    expect(message).toContain('shorter than 32 characters');
    expect(message).not.toContain(short);
  });

  it('never logs the pass or the secret', async () => {
    const src = await srcFor('console');

    expect(src).toMatch(PASS_SRC);
    [...logSpies, warnSpy].forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});

describe('getAuraSettingsFn', () => {
  it('uses neutral defaults', async () => {
    await expect(getAuraSettingsFn()).resolves.toEqual({ brand: 'Admin Panel', linksTitle: 'Tools' });
  });

  it('reads the brand name and tools heading from the environment', async () => {
    vi.stubEnv('AURA_BRAND_NAME', '  Acme Console ');
    vi.stubEnv('AURA_ADMIN_LINKS_TITLE', 'Operations');

    await expect(getAuraSettingsFn()).resolves.toEqual({
      brand: 'Acme Console',
      linksTitle: 'Operations',
    });
  });
});

describe('adminLinksOptions', () => {
  const SIGNED_OUT = { valid: false, error: 'Session expired due to inactivity' };
  const SIGNED_IN = { valid: true, user: { id: 'user-1' } };

  it('fetches again after an empty result, so links return after sign-in', async () => {
    vi.stubEnv('AURA_ADMIN_LINKS', JSON.stringify(LINKS));
    const client = new QueryClient();

    verifyAdminTokenMock.mockResolvedValue(SIGNED_OUT);
    await expect(client.fetchQuery(adminLinksOptions)).resolves.toEqual([]);

    verifyAdminTokenMock.mockResolvedValue(SIGNED_IN);
    const links = await client.fetchQuery(adminLinksOptions);
    expect(links.map((link) => link.id)).toEqual(['metrics', 'rota']);
    expect(verifyAdminTokenMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a non-empty list fresh without another session check', async () => {
    vi.stubEnv('AURA_ADMIN_LINKS', JSON.stringify(LINKS));
    const client = new QueryClient();
    verifyAdminTokenMock.mockResolvedValue(SIGNED_IN);

    await client.fetchQuery(adminLinksOptions);
    await client.fetchQuery(adminLinksOptions);
    expect(verifyAdminTokenMock).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when the window regains focus', () => {
    expect(adminLinksOptions.refetchOnWindowFocus).toBe(false);
  });
});
