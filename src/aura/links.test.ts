import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LINK_ICON,
  DEFAULT_LINKS_TITLE,
  MAX_ADMIN_LINKS,
  cspFrameSrc,
  frameSources,
  normalizeHref,
  parseAdminLinks,
  resolveLinksTitle,
} from './links';

const parse = (entries: object[]) => parseAdminLinks(JSON.stringify(entries));

describe('parseAdminLinks', () => {
  it('returns an empty list for a missing or blank value', () => {
    expect(parseAdminLinks(undefined)).toEqual({ links: [], dropped: [] });
    expect(parseAdminLinks('   ')).toEqual({ links: [], dropped: [] });
  });

  it('parses valid entries of every mode', () => {
    const result = parse([
      {
        id: 'metrics',
        label: 'Metrics',
        href: 'https://metrics.example.com/d/1',
        mode: 'embed',
        icon: 'metrics',
        note: 'Dashboards',
      },
      { id: 'logs', label: 'Logs', href: 'http://localhost:3001/logs', mode: 'tab', icon: 'console' },
      { id: 'rota', label: 'On call', mode: 'text', note: 'See the team rota', icon: 'users' },
      { id: 'local', label: 'Local', href: '/runbook/', mode: 'embed' },
    ]);

    expect(result.dropped).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(result.links).toEqual([
      {
        id: 'metrics',
        label: 'Metrics',
        href: 'https://metrics.example.com/d/1',
        mode: 'embed',
        icon: 'metrics',
        note: 'Dashboards',
      },
      { id: 'logs', label: 'Logs', href: 'http://localhost:3001/logs', mode: 'tab', icon: 'console' },
      { id: 'rota', label: 'On call', mode: 'text', note: 'See the team rota', icon: 'users' },
      { id: 'local', label: 'Local', href: '/runbook/', mode: 'embed', icon: DEFAULT_LINK_ICON },
    ]);
  });

  it('defaults the mode to tab', () => {
    const { links } = parse([{ id: 'docs', label: 'Docs', href: 'https://docs.example.com/' }]);
    expect(links).toEqual([
      { id: 'docs', label: 'Docs', href: 'https://docs.example.com/', mode: 'tab', icon: DEFAULT_LINK_ICON },
    ]);
  });

  it('accepts text entries without an href and never returns one for them', () => {
    const { links } = parse([
      { id: 'a', label: 'A', mode: 'text' },
      { id: 'b', label: 'B', mode: 'text', href: 'javascript:alert(1)' },
    ]);
    expect(links).toEqual([
      { id: 'a', label: 'A', mode: 'text', icon: DEFAULT_LINK_ICON },
      { id: 'b', label: 'B', mode: 'text', icon: DEFAULT_LINK_ICON },
    ]);
  });

  it('falls back to the default icon for unknown, invalid or missing icons', () => {
    const { links } = parse([
      { id: 'a', label: 'A', href: '/a', icon: 'not-an-icon' },
      { id: 'b', label: 'B', href: '/b', icon: 42 },
      { id: 'c', label: 'C', href: '/c' },
      { id: 'd', label: 'D', href: '/d', icon: 'sand-glass' },
    ]);
    expect(links.map((link) => link.icon)).toEqual([
      DEFAULT_LINK_ICON,
      DEFAULT_LINK_ICON,
      DEFAULT_LINK_ICON,
      DEFAULT_LINK_ICON,
    ]);
  });

  it.each([
    ['an id with capitals', { id: 'Metrics', label: 'M', href: '/m' }],
    ['an id with spaces', { id: 'my tool', label: 'M', href: '/m' }],
    ['an id longer than 32 characters', { id: 'a'.repeat(33), label: 'M', href: '/m' }],
    ['an empty id', { id: '', label: 'M', href: '/m' }],
    ['a numeric id', { id: 7, label: 'M', href: '/m' }],
    ['a missing label', { id: 'm', href: '/m' }],
    ['a blank label', { id: 'm', label: '   ', href: '/m' }],
    ['a label longer than 40 characters', { id: 'm', label: 'x'.repeat(41), href: '/m' }],
    ['an unknown mode', { id: 'm', label: 'M', href: '/m', mode: 'popup' }],
    ['a note longer than 80 characters', { id: 'm', label: 'M', href: '/m', note: 'n'.repeat(81) }],
    ['a non-string note', { id: 'm', label: 'M', href: '/m', note: 5 }],
    ['a tab entry without href', { id: 'm', label: 'M', mode: 'tab' }],
    ['an embed entry without href', { id: 'm', label: 'M', mode: 'embed' }],
    ['a javascript: href', { id: 'm', label: 'M', href: 'javascript:alert(1)' }],
    ['a data: href', { id: 'm', label: 'M', href: 'data:text/html,hi' }],
    ['plain http to another host', { id: 'm', label: 'M', href: 'http://example.com/' }],
    ['a protocol-relative href', { id: 'm', label: 'M', href: '//evil.example/' }],
    ['an audience with capitals', { id: 'm', label: 'M', href: '/m', mode: 'embed', audience: 'Console' }],
    ['an audience with a dot', { id: 'm', label: 'M', href: '/m', mode: 'embed', audience: 'con.sole' }],
    ['an empty audience', { id: 'm', label: 'M', href: '/m', mode: 'embed', audience: '' }],
    ['an audience longer than 32 characters', { id: 'm', label: 'M', href: '/m', mode: 'embed', audience: 'a'.repeat(33) }],
    ['a non-string audience', { id: 'm', label: 'M', href: '/m', mode: 'embed', audience: 1 }],
  ])('drops %s', (_name, entry) => {
    expect(parse([entry])).toEqual({ links: [], dropped: [0] });
  });

  it('keeps a valid audience and omits a missing one', () => {
    const { links } = parse([
      { id: 'console', label: 'Console', href: '/console/', mode: 'embed', audience: 'console' },
      { id: 'reports', label: 'Reports', href: '/reports/', mode: 'embed', audience: 'reports-2' },
      { id: 'plain', label: 'Plain', href: '/plain/', mode: 'embed', audience: null },
    ]);
    expect(links).toEqual([
      { id: 'console', label: 'Console', href: '/console/', mode: 'embed', icon: DEFAULT_LINK_ICON, audience: 'console' },
      { id: 'reports', label: 'Reports', href: '/reports/', mode: 'embed', icon: DEFAULT_LINK_ICON, audience: 'reports-2' },
      { id: 'plain', label: 'Plain', href: '/plain/', mode: 'embed', icon: DEFAULT_LINK_ICON },
    ]);
  });

  it('ignores the audience of text entries, like their href', () => {
    const { links } = parse([{ id: 'rota', label: 'On call', mode: 'text', audience: 'Not Valid' }]);
    expect(links).toEqual([{ id: 'rota', label: 'On call', mode: 'text', icon: DEFAULT_LINK_ICON }]);
  });

  it('drops non-object entries one by one and keeps the valid ones', () => {
    const result = parseAdminLinks(
      JSON.stringify([null, 'tool', ['a'], 3, { id: 'ok', label: 'OK', href: '/ok' }]),
    );
    expect(result.links.map((link) => link.id)).toEqual(['ok']);
    expect(result.dropped).toEqual([0, 1, 2, 3]);
  });

  it('keeps the first entry for a duplicated id', () => {
    const result = parse([
      { id: 'dup', label: 'First', href: '/first' },
      { id: 'dup', label: 'Second', href: '/second' },
    ]);
    expect(result.links).toHaveLength(1);
    expect(result.links[0].label).toBe('First');
    expect(result.dropped).toEqual([1]);
  });

  it('keeps at most 12 entries', () => {
    const entries = Array.from({ length: 15 }, (_, index) => ({
      id: `tool-${index}`,
      label: `Tool ${index}`,
      href: `/tool/${index}`,
    }));
    const result = parse(entries);
    expect(result.links).toHaveLength(MAX_ADMIN_LINKS);
    expect(result.links.at(-1)?.id).toBe('tool-11');
    expect(result.dropped).toEqual([12, 13, 14]);
  });

  it('trims labels and notes, and omits empty notes', () => {
    const { links } = parse([{ id: 'a', label: '  Alpha  ', href: '/a', note: '   ' }]);
    expect(links).toEqual([{ id: 'a', label: 'Alpha', href: '/a', mode: 'tab', icon: DEFAULT_LINK_ICON }]);
  });

  it('reports invalid JSON without throwing', () => {
    expect(parseAdminLinks('[{"id": "a",')).toEqual({ links: [], dropped: [], error: 'invalid-json' });
  });

  it('reports JSON that is not an array', () => {
    expect(parseAdminLinks('{"id":"a"}')).toEqual({ links: [], dropped: [], error: 'not-an-array' });
  });
});

describe('normalizeHref', () => {
  it.each([
    ['https://tools.example.com/x?y=1', 'https://tools.example.com/x?y=1'],
    ['https://Tools.Example.com', 'https://tools.example.com/'],
    ['http://localhost/', 'http://localhost/'],
    ['http://localhost:8080/admin', 'http://localhost:8080/admin'],
    ['http://127.0.0.1:9000/', 'http://127.0.0.1:9000/'],
    ['https://10.0.0.1/x', 'https://10.0.0.1/x'],
    ['https://[::1]:8443/', 'https://[::1]:8443/'],
    ['https://b\u00fccher.example/', 'https://xn--bcher-kva.example/'],
    ['/grafana/', '/grafana/'],
    ['  /padded  ', '/padded'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeHref(input)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hi',
    'ftp://files.example.com/',
    'http://example.com/',
    'http://localhost.example.com/',
    'http://127.0.0.2/',
    'http://localhost@evil.example/',
    'https://user:secret@tools.example.com/',
    'https://*/',
    'https://*.example.com/',
    'https://a.com;b/',
    'https://a.com%3Bb/',
    'https://a.com,b/',
    "https://a.com'b/",
    'https://my_host.example.com/',
    'https://-a.example.com/',
    'https://example.com./',
    '//evil.example/',
    '/\\evil.example/',
    '/path with spaces',
    'relative/path',
    '',
    `/${'a'.repeat(2048)}`,
  ])('rejects %s', (input) => {
    expect(normalizeHref(input)).toBeUndefined();
  });

  it('rejects non-string values', () => {
    expect(normalizeHref(42)).toBeUndefined();
    expect(normalizeHref(undefined)).toBeUndefined();
  });
});

describe('resolveLinksTitle', () => {
  it('defaults to Tools', () => {
    expect(resolveLinksTitle(undefined)).toBe(DEFAULT_LINKS_TITLE);
    expect(resolveLinksTitle('  ')).toBe(DEFAULT_LINKS_TITLE);
  });

  it('uses the configured title', () => {
    expect(resolveLinksTitle('  Operations ')).toBe('Operations');
  });
});

describe('frame sources for the CSP', () => {
  it('lists self and each kind of embed source once, never a host name', () => {
    const { links } = parse([
      { id: 'a', label: 'A', href: 'https://a.example.com/one', mode: 'embed' },
      { id: 'b', label: 'B', href: 'https://b.example.com/two', mode: 'embed' },
      { id: 'c', label: 'C', href: 'http://localhost:8080/', mode: 'embed' },
      { id: 'd', label: 'D', href: '/local/', mode: 'embed' },
      { id: 'e', label: 'E', href: 'http://127.0.0.1/', mode: 'embed' },
      { id: 'f', label: 'F', href: 'https://tab.example.com/', mode: 'tab' },
    ]);
    const sources = frameSources(links);
    expect(sources).toEqual(["'self'", 'https:', 'http://localhost:*', 'http://127.0.0.1:*']);
    expect(sources.join(' ')).not.toMatch(/example/);
  });

  it('needs only self for same-origin embeds', () => {
    expect(cspFrameSrc(JSON.stringify([{ id: 'd', label: 'D', href: '/x', mode: 'embed' }]))).toEqual([
      "frame-src 'self'",
    ]);
  });

  it('adds no directive without embeds or with invalid JSON', () => {
    expect(cspFrameSrc(undefined)).toEqual([]);
    expect(cspFrameSrc('not json')).toEqual([]);
    expect(cspFrameSrc(JSON.stringify([{ id: 't', label: 'T', href: 'https://t.example/' }]))).toEqual([]);
  });

  it('builds the directive from the environment value without naming the embedded host', () => {
    const raw = JSON.stringify([
      { id: 'm', label: 'M', href: 'https://ops.internal.example:8443/x', mode: 'embed' },
    ]);
    expect(cspFrameSrc(raw)).toEqual(["frame-src 'self' https:"]);
  });

  it('cannot be widened or split by a crafted host', () => {
    const raw = JSON.stringify([
      { id: 'w', label: 'W', href: 'https://*/', mode: 'embed' },
      { id: 's', label: 'S', href: 'https://a.com;script-src/', mode: 'embed' },
      { id: 'c', label: 'C', href: 'https://a.com,b/', mode: 'embed' },
    ]);
    expect(cspFrameSrc(raw)).toEqual([]);
  });
});
