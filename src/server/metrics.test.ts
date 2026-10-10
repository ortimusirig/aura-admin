// Modified by Applexus Technologies, 2026-10-10: static asset example uses the neutral logo (AGPL-3.0)
import { describe, expect, it } from 'vitest';
import { normalizeMetricsPath } from './metrics';

describe('normalizeMetricsPath', () => {
  it.each([
    ['/', '/'],
    ['/login', '/login'],
    ['/configuration/', '/configuration'],
    ['/auth/openid/callback', '/auth/openid/callback'],
  ])('keeps known app route %s bounded as %s', (input, expected) => {
    expect(normalizeMetricsPath(input)).toBe(expected);
  });

  it.each([
    ['/assets/index-abc123.js'],
    ['/favicon.ico'],
    ['/manifest.json'],
    ['/logo.svg'],
  ])('buckets static asset %s', (input) => {
    expect(normalizeMetricsPath(input)).toBe('static_asset');
  });

  it.each([
    ['/_server'],
    ['/_server/getUsersFn'],
    ['/_serverFn/getUsersFn'],
    ['/api/_server/getUsersFn'],
  ])('buckets server function path %s', (input) => {
    expect(normalizeMetricsPath(input)).toBe('server_function');
  });

  it.each([['/wp-login.php'], ['/users/123'], ['not-a-path']])(
    'buckets unknown path %s',
    (input) => {
      expect(normalizeMetricsPath(input)).toBe('unknown');
    },
  );
});
