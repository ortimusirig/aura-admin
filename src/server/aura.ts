import { queryOptions } from '@tanstack/react-query';
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import type * as t from '@/types';
import { parseAdminLinks, resolveLinksTitle } from '@/aura/links';
import { resolveBrandName } from '@/aura/brand';
import { verifyAdminTokenFn } from './auth';

let linksCache: { raw: string; links: t.AdminLink[] } | undefined;

/**
 * Parses `AURA_ADMIN_LINKS` once per distinct value so a bad value logs a single warning.
 * The warning names the problem and the dropped positions, never the raw value.
 */
const readAdminLinks = createServerOnlyFn((): t.AdminLink[] => {
  const raw = process.env.AURA_ADMIN_LINKS ?? '';
  if (linksCache?.raw === raw) return linksCache.links;

  const { links, dropped, error } = parseAdminLinks(raw);
  if (error) {
    console.warn(`[aura] AURA_ADMIN_LINKS ignored: ${error}`);
  } else if (dropped.length > 0) {
    console.warn(`[aura] AURA_ADMIN_LINKS: dropped entries at positions ${dropped.join(', ')}`);
  }
  linksCache = { raw, links };
  return links;
});

/** Public site settings (brand name, tools heading); needed before sign-in. */
export const getAuraSettingsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<t.AuraSettings> => ({
    brand: resolveBrandName(process.env.AURA_BRAND_NAME),
    linksTitle: resolveLinksTitle(process.env.AURA_ADMIN_LINKS_TITLE),
  }),
);

/** Admin tool links, only for a signed-in admin (same check as the `_app` layout guard). */
export const getAdminLinksFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<t.AdminLink[]> => {
    const session = await verifyAdminTokenFn().catch(() => ({ valid: false }));
    if (!session.valid) return [];
    return readAdminLinks();
  },
);

export const adminLinksOptions = queryOptions({
  queryKey: ['auraAdminLinks'],
  queryFn: () => getAdminLinksFn(),
  staleTime: 5 * 60_000,
});
