import type * as t from '@/types';

export const MAX_ADMIN_LINKS = 12;
export const DEFAULT_LINKS_TITLE = 'Tools';
export const DEFAULT_LINK_ICON: t.IconName = 'popout';

const MAX_LABEL_LENGTH = 40;
const MAX_NOTE_LENGTH = 80;
const MAX_TITLE_LENGTH = 40;
const MAX_HREF_LENGTH = 2048;
const ID_PATTERN = /^[a-z0-9-]{1,32}$/;
const UNSAFE_HREF_CHARS = /[\s\\\x00-\x1f\x7f]/;
const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const IPV6_HOST_PATTERN = /^\[[0-9a-f:.]+\]$/;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);
const LINK_MODES = new Map<string, t.AdminLinkMode>([
  ['embed', 'embed'],
  ['tab', 'tab'],
  ['text', 'text'],
]);
const INVALID_JSON = Symbol('invalid-json');
const SELF_SOURCE = "'self'";
const HTTPS_SOURCE = 'https:';

/**
 * Icons an admin link may name. Each one is a valid Click UI icon that also passes the
 * repo's `click-ui/valid-icon-name` lint rule; anything else falls back to the default.
 */
export const ADMIN_LINK_ICONS: readonly t.IconName[] = [
  'activity',
  'bar-chart',
  'bell',
  'book',
  'briefcase',
  'building',
  'calendar',
  'chart-area',
  'chat',
  'clock',
  'cloud',
  'code',
  'console',
  'cpu',
  'data',
  'database',
  'document',
  'email',
  'gear',
  'globe',
  'history',
  'home',
  'http',
  'information',
  'integrations',
  'key',
  'keys',
  'lifebuoy',
  'light-bulb',
  'lock',
  'mcp',
  'metrics',
  'pie-chart',
  'plug',
  'popout',
  'puzzle-piece',
  'query',
  'question',
  'rocket',
  'search',
  'secure',
  'server',
  'services',
  'settings',
  'share',
  'sparkle',
  'speed',
  'star',
  'support',
  'table',
  'url',
  'user',
  'users',
  'warning',
];

const ICON_LOOKUP = new Map<string, t.IconName>(ADMIN_LINK_ICONS.map((icon) => [icon, icon]));

function isRawLink(value: unknown): value is t.RawAdminLink {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readId(value: unknown): string | undefined {
  return typeof value === 'string' && ID_PATTERN.test(value) ? value : undefined;
}

function readLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const label = value.trim();
  return label.length > 0 && label.length <= MAX_LABEL_LENGTH ? label : undefined;
}

function readMode(value: unknown): t.AdminLinkMode | undefined {
  if (value === undefined || value === null) return 'tab';
  if (typeof value !== 'string') return undefined;
  return LINK_MODES.get(value);
}

function readIcon(value: unknown): t.IconName {
  if (typeof value !== 'string') return DEFAULT_LINK_ICON;
  return ICON_LOOKUP.get(value) ?? DEFAULT_LINK_ICON;
}

/** Returns the trimmed note, `''` when absent, or `undefined` when present but invalid. */
function readNote(value: unknown): string | undefined {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return undefined;
  const note = value.trim();
  return note.length <= MAX_NOTE_LENGTH ? note : undefined;
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/** DNS names (IDN hosts arrive as punycode), IPv4 addresses and bracketed IPv6 literals. */
function isValidHostname(hostname: string): boolean {
  return HOSTNAME_PATTERN.test(hostname) || IPV6_HOST_PATTERN.test(hostname);
}

/**
 * Accepts `https://` URLs, `http://` URLs on localhost or 127.0.0.1, and same-origin
 * paths that start with a single `/`. Returns the normalized href or `undefined`.
 * Hosts with wildcards or punctuation such as `*`, `;` or `,` are rejected.
 */
export function normalizeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const href = value.trim();
  if (!href || href.length > MAX_HREF_LENGTH || UNSAFE_HREF_CHARS.test(href)) return undefined;
  if (href.startsWith('/')) return href.startsWith('//') ? undefined : href;

  const url = parseUrl(href);
  if (!url || url.username || url.password || !isValidHostname(url.hostname)) return undefined;
  if (url.protocol === 'https:') return url.href;
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return url.href;
  return undefined;
}

function toAdminLink(entry: unknown): t.AdminLink | undefined {
  if (!isRawLink(entry)) return undefined;

  const id = readId(entry.id);
  const label = readLabel(entry.label);
  const mode = readMode(entry.mode);
  const note = readNote(entry.note);
  if (!id || !label || !mode || note === undefined) return undefined;

  const base = { id, label, icon: readIcon(entry.icon), ...(note ? { note } : {}) };
  if (mode === 'text') return { ...base, mode };

  const href = normalizeHref(entry.href);
  return href ? { ...base, mode, href } : undefined;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return INVALID_JSON;
  }
}

function collectLinks(entries: unknown[]): t.AdminLinksParseResult {
  const links: t.AdminLink[] = [];
  const dropped: number[] = [];
  const seen = new Set<string>();

  entries.forEach((entry, index) => {
    const link = toAdminLink(entry);
    if (!link || seen.has(link.id) || links.length >= MAX_ADMIN_LINKS) {
      dropped.push(index);
      return;
    }
    seen.add(link.id);
    links.push(link);
  });

  return { links, dropped };
}

/**
 * Parses the `AURA_ADMIN_LINKS` JSON array. Invalid entries are dropped one by one,
 * later duplicates of an id are dropped, and at most {@link MAX_ADMIN_LINKS} survive.
 * Never throws; invalid JSON yields an empty list and an error code (never the raw value).
 */
export function parseAdminLinks(raw: string | undefined): t.AdminLinksParseResult {
  if (!raw || !raw.trim()) return { links: [], dropped: [] };

  const data = parseJson(raw);
  if (data === INVALID_JSON) return { links: [], dropped: [], error: 'invalid-json' };
  if (!Array.isArray(data)) return { links: [], dropped: [], error: 'not-an-array' };
  return collectLinks(data);
}

/** Section heading for the admin tools; defaults to {@link DEFAULT_LINKS_TITLE}. */
export function resolveLinksTitle(value: string | undefined): string {
  const title = value?.trim().slice(0, MAX_TITLE_LENGTH);
  return title || DEFAULT_LINKS_TITLE;
}

/** The source kind that admits one embed href: `'self'`, `https:` or a loopback host on any port. */
function frameSource(href: string): string {
  if (href.startsWith('/')) return SELF_SOURCE;
  const { protocol, hostname } = new URL(href);
  return protocol === 'https:' ? HTTPS_SOURCE : `http://${hostname}:*`;
}

/**
 * Sources the embedded tools need in `frame-src`, by kind rather than by origin: the header
 * goes out on every page, also before sign-in, so it must never name an embedded host.
 * Always `'self'`, plus `https:` and `http://localhost:*` or `http://127.0.0.1:*` as needed.
 */
export function frameSources(links: readonly t.AdminLink[]): string[] {
  const sources = links.reduce<Set<string> | undefined>((acc, link) => {
    if (link.mode !== 'embed') return acc;
    return (acc ?? new Set([SELF_SOURCE])).add(frameSource(link.href));
  }, undefined);
  return sources ? [...sources] : [];
}

/** The `frame-src` directive for the Content-Security-Policy, or none without embeds. */
export function cspFrameSrc(raw: string | undefined): string[] {
  const sources = frameSources(parseAdminLinks(raw).links);
  return sources.length > 0 ? [`frame-src ${sources.join(' ')}`] : [];
}
