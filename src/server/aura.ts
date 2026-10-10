import { z } from 'zod';
import { queryOptions } from '@tanstack/react-query';
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import type * as t from '@/types';
import { MIN_PASS_SECRET_LENGTH, frameSrc, isPassSecret } from '@/aura/pass';
import { parseAdminLinks, resolveLinksTitle } from '@/aura/links';
import { resolveBrandName } from '@/aura/brand';
import { verifyAdminTokenFn } from './auth';

const LINKS_STALE_TIME = 5 * 60_000;

let linksCache: { raw: string; links: t.AdminLink[] } | undefined;
let shortSecretWarned = false;

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

/**
 * `AURA_TOOLS_PASS_SECRET` when it is long enough, else `undefined` (no passes). A short secret
 * logs one warning that names the minimum length, never the value.
 */
const readPassSecret = createServerOnlyFn((): string | undefined => {
  const secret = process.env.AURA_TOOLS_PASS_SECRET;
  if (isPassSecret(secret)) return secret;
  if (secret && !shortSecretWarned) {
    shortSecretWarned = true;
    console.warn(
      `[aura] AURA_TOOLS_PASS_SECRET is shorter than ${MIN_PASS_SECRET_LENGTH} characters; embedded tools get no pass`,
    );
  }
  return undefined;
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

/**
 * The iframe src of one admin tool, only for a signed-in admin (same check as the `_app` layout
 * guard): the entry's href, with a fresh one-minute pass for a same-origin embed (see
 * `frameSrc`). `null` without a session, for an unknown id and for text entries. POST, so no
 * HTTP cache keeps a pass; the pass is never stored or logged.
 */
export const getToolFrameSrcFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().max(64) }))
  .handler(async ({ data }): Promise<string | null> => {
    const session = await verifyAdminTokenFn().catch(() => undefined);
    if (!session?.valid) return null;

    const link = readAdminLinks().find((entry) => entry.id === data.id);
    if (!link) return null;
    return frameSrc(link, { secret: readPassSecret(), email: session.user?.email }) ?? null;
  });

/**
 * An empty list (fetched before sign-in or after the session ended) is never fresh, so the
 * links come back as soon as the sidebar mounts after sign-in. No refetch on window focus:
 * that would run a session check outside navigation and could cache an empty list.
 */
export const adminLinksOptions = queryOptions({
  queryKey: ['auraAdminLinks'],
  queryFn: () => getAdminLinksFn(),
  staleTime: (query) => (query.state.data?.length ? LINKS_STALE_TIME : 0),
  refetchOnWindowFocus: false,
});
