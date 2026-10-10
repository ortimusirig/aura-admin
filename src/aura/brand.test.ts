import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  BRAND_FILES,
  DEFAULT_BRAND_DIR,
  DEFAULT_BRAND_NAME,
  applyBrand,
  brandOverlayPath,
  resolveBrandDir,
  resolveBrandName,
} from './brand';
import i18n from '@/locales/i18n';

describe('resolveBrandName', () => {
  it('defaults to a neutral name', () => {
    expect(DEFAULT_BRAND_NAME).toBe('Admin Panel');
    expect(resolveBrandName(undefined)).toBe(DEFAULT_BRAND_NAME);
    expect(resolveBrandName('   ')).toBe(DEFAULT_BRAND_NAME);
  });

  it('uses the AURA_BRAND_NAME value', () => {
    expect(resolveBrandName('  Acme Console ')).toBe('Acme Console');
  });
});

describe('brand overlay resolution', () => {
  it('defaults the brand folder to /brand and strips trailing slashes', () => {
    expect(resolveBrandDir(undefined)).toBe(DEFAULT_BRAND_DIR);
    expect(resolveBrandDir('')).toBe(DEFAULT_BRAND_DIR);
    expect(resolveBrandDir('/srv/brand/')).toBe('/srv/brand');
  });

  it('overlays exactly the four allowlisted files', () => {
    expect([...BRAND_FILES].sort()).toEqual(
      ['apple-touch-icon.png', 'favicon.ico', 'logo.svg', 'manifest.json'].sort(),
    );
    expect(BRAND_FILES.map((file) => brandOverlayPath('/brand', file))).toEqual([
      '/brand/favicon.ico',
      '/brand/apple-touch-icon.png',
      '/brand/logo.svg',
      '/brand/manifest.json',
    ]);
  });

  it.each([
    'robots.txt',
    'index.html',
    'assets/index-abc123.js',
    'LICENSE.txt',
    'FAVICON.ICO',
    'favicon.ico ',
  ])('does not overlay %s', (file) => {
    expect(brandOverlayPath('/brand', file)).toBeUndefined();
  });

  it.each([
    '../favicon.ico',
    '../../etc/passwd',
    'assets/../favicon.ico',
    'sub/favicon.ico',
    '/favicon.ico',
    'favicon.ico/../../secret',
    '..',
    '',
  ])('rejects traversal or nested path %s', (file) => {
    expect(brandOverlayPath('/brand', file)).toBeUndefined();
  });
});

describe('applyBrand', () => {
  beforeAll(async () => {
    if (i18n.isInitialized) return;
    await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
  });

  afterEach(() => {
    applyBrand(i18n, DEFAULT_BRAND_NAME);
  });

  it('shows the neutral default name in the English strings', () => {
    expect(i18n.t('com_auth_title')).toBe('Admin Panel');
    expect(i18n.t('com_a11y_admin_panel')).toBe('Admin Panel');
    expect(i18n.t('com_a11y_logo_alt')).toBe('Admin Panel logo');
  });

  it('puts the runtime brand into every string that named the product', () => {
    applyBrand(i18n, 'Acme Console');
    expect(i18n.t('com_auth_title')).toBe('Acme Console');
    expect(i18n.t('com_a11y_admin_panel')).toBe('Acme Console');
    expect(i18n.t('com_a11y_logo_alt')).toBe('Acme Console logo');
    expect(i18n.t('com_aura_legal_notice')).toMatch(
      /^Acme Console is based on LibreChat Admin Panel, copyright its contributors, modified by Applexus Technologies\./,
    );
  });

  it('keeps explicit interpolation values and unrelated variables working', () => {
    applyBrand(i18n, 'Acme Console');
    expect(i18n.t('com_auth_title', { brand: 'Other' })).toBe('Other');
    expect(i18n.t('com_a11y_page_n', { page: 3 })).toBe('Page 3');
  });
});
