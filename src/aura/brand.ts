import type { i18n as I18n } from 'i18next';
import type * as t from '@/types';

/** Neutral product name used when `AURA_BRAND_NAME` is unset. */
export const DEFAULT_BRAND_NAME = 'Admin Panel';
export const DEFAULT_BRAND_DIR = '/brand';

/** The only public static files a brand folder may overlay. */
export const BRAND_FILES: readonly t.BrandFile[] = [
  'favicon.ico',
  'apple-touch-icon.png',
  'logo.svg',
  'manifest.json',
];

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

/** Sets the `{{brand}}` interpolation default used by the English overlay strings. */
export function applyBrand(instance: I18n, brand: string): void {
  const interpolation = instance.options.interpolation;
  if (!interpolation) return;
  interpolation.defaultVariables = { ...interpolation.defaultVariables, brand };
}
