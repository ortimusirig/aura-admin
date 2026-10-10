import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { getAdminLinksFn, getAuraSettingsFn } from './aura';

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
