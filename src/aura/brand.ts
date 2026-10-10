import type { i18n as I18n } from 'i18next';
import type * as t from '@/types';

/**
 * Neutral product name used when `AURA_BRAND_NAME` is unset. Names and files supplied through
 * AURA_BRAND_NAME or AURA_BRAND_DIR are subject to the additional term under AGPL-3.0 section 7(e)
 * in NOTICE.
 */
export const DEFAULT_BRAND_NAME = 'Admin Panel';
export const DEFAULT_BRAND_DIR = '/brand';

/**
 * The only public static files a brand folder may overlay. Files supplied through AURA_BRAND_DIR
 * are subject to the additional term under AGPL-3.0 section 7(e) in NOTICE.
 */
export const BRAND_FILES: readonly t.BrandFile[] = [
  'favicon.ico',
  'apple-touch-icon.png',
  'logo.svg',
  'manifest.json',
];

/**
 * Response headers for a brand overlay file. The brand folder is runtime input from outside the
 * image, so a supplied SVG opened directly must not run script with the panel's origin. Browsers
 * ignore this policy when the file is used as an image, icon or manifest.
 */
export const BRAND_FILE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'public, max-age=300',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
};

const BRAND_FILE_SET = new Set<string>(BRAND_FILES);

export function resolveBrandName(value: string | undefined): string {
  return value?.trim() || DEFAULT_BRAND_NAME;
}

export function resolveBrandDir(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, '') || DEFAULT_BRAND_DIR;
}

/**
 * Path of the brand overlay for a published static file, or `undefined` when the file is
 * not overlayable. Only the exact top-level names in {@link BRAND_FILES} qualify, so no
 * request path can reach outside the brand folder.
 */
export function brandOverlayPath(dir: string, file: string): string | undefined {
  return BRAND_FILE_SET.has(file) ? `${dir}/${file}` : undefined;
}

/**
 * Chooses where a published static file is served from: the brand folder when it holds an
 * allowlisted overlay for `file` (served with {@link BRAND_FILE_HEADERS}), else the bundled
 * public file. `exists` is only asked about allowlisted overlay paths.
 */
export async function pickStaticFile(
  dir: string,
  file: string,
  exists: (path: string) => Promise<boolean>,
): Promise<t.StaticFileChoice> {
  const overlay = brandOverlayPath(dir, file);
  if (overlay && (await exists(overlay))) {
    return { source: 'brand', path: overlay, headers: BRAND_FILE_HEADERS };
  }
  return { source: 'public' };
}

/** Sets the `{{brand}}` interpolation default used by the English overlay strings. */
export function applyBrand(instance: I18n, brand: string): void {
  const interpolation = instance.options.interpolation;
  if (!interpolation) return;
  interpolation.defaultVariables = { ...interpolation.defaultVariables, brand };
}
