import type * as t from '@/types';
import { DEFAULT_BRAND_NAME, applyBrand } from './brand';
import { DEFAULT_LINKS_TITLE } from './links';
import { getAuraSettingsFn } from '@/server';
import i18n from '@/locales/i18n';

export const DEFAULT_SETTINGS: t.AuraSettings = {
  brand: DEFAULT_BRAND_NAME,
  linksTitle: DEFAULT_LINKS_TITLE,
};

/**
 * Root route loader: fetches the runtime site settings from the server and applies the
 * brand name to i18n before any page renders. Falls back to neutral defaults on failure.
 */
export async function loadSettings(): Promise<t.AuraSettings> {
  const settings = await getAuraSettingsFn().catch(() => DEFAULT_SETTINGS);
  applyBrand(i18n, settings.brand);
  return settings;
}
