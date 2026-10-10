import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import type * as t from '@/types';
import {
  DEFAULT_PASS_AUDIENCE,
  PASS_LIFETIME_SECONDS,
  derivePassKey,
  frameSrc,
  isPassSecret,
  mintPass,
  passClaims,
  withPass,
} from './pass';

/**
 * Fixed vector shared with the receiving tool's reference implementation; both sides must produce
 * exactly this pass.
 */
const VECTOR_SECRET = 'aura-tool-pass-test-vector-secret-2026-10-10';
const VECTOR_PAYLOAD =
  '{"v":1,"sub":"admin@example.com","aud":"console","iat":1791590400,"exp":1791590460,"jti":"0123456789abcdef0123456789abcdef"}';
const VECTOR_PASS =
  'eyJ2IjoxLCJzdWIiOiJhZG1pbkBleGFtcGxlLmNvbSIsImF1ZCI6ImNvbnNvbGUiLCJpYXQiOjE3OTE1OTA0MDAsImV4cCI6MTc5MTU5MDQ2MCwianRpIjoiMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWYifQ.gaiExa1Oe372gzy4g62jHYmLxi3XFbLBZT5VFQTjAE0';
const VECTOR_PASS_KEY_HEX = '1ff0bb59247f637714777e7d34fa6cc4a669f169e4b32aa6d37084f046892643';
const VECTOR_IAT = 1791590400;
const VECTOR_JTI = '0123456789abcdef0123456789abcdef';
const VECTOR_NOW_MS = VECTOR_IAT * 1000 + 999;

const SHORT_SECRET = 'x'.repeat(31);
const CONSOLE: t.AdminUrlLink = { id: 'console', label: 'Console', href: '/console/', mode: 'embed', icon: 'console' };
const PASS_IN_SRC = /[?&]aura_pass=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43})(?:#|$)/;

const fromB64url = (text: string) => Buffer.from(text, 'base64url').toString('utf8');

/**
 * Independent verifier for the console rules of pass contract version 1 (except the replay
 * guard and the LibreChat ADMIN lookup, which only the console can do). Returns the subject or
 * the name of the first rule that failed.
 */
function verifyPass(pass: string, secret: string, nowSeconds: number, audience = 'console'): string {
  const [payload, signature, extra] = pass.split('.');
  if (!payload || !signature || extra !== undefined) return 'format';

  const passKey = crypto.createHmac('sha256', secret).update('aura-tool-pass-v1').digest();
  const expected = crypto.createHmac('sha256', passKey).update(payload, 'ascii').digest('base64url');
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return 'signature';

  const claims: t.ToolPassClaims = JSON.parse(fromB64url(payload));
  if (claims.v !== 1) return 'version';
  if (claims.aud !== audience) return 'audience';
  if (!(claims.iat <= nowSeconds + 5)) return 'issued-in-future';
  if (!(nowSeconds < claims.exp)) return 'expired';
  if (claims.exp - claims.iat > 120) return 'lifetime';
  if (!/^[0-9a-f]{32}$/.test(claims.jti)) return 'jti';
  return claims.sub;
}

function passOf(src: string | undefined): string {
  const match = src?.match(PASS_IN_SRC);
  if (!match) throw new Error('no pass in src');
  return match[1];
}

describe('test vector', () => {
  it('derives the pass key as the raw HMAC-SHA256 digest', () => {
    expect(derivePassKey(VECTOR_SECRET).toString('hex')).toBe(VECTOR_PASS_KEY_HEX);
  });

  it('mints exactly the shared vector pass', () => {
    const claims = passClaims('admin@example.com', 'console', VECTOR_NOW_MS, VECTOR_JTI);

    expect(claims).toEqual({
      v: 1,
      sub: 'admin@example.com',
      aud: 'console',
      iat: VECTOR_IAT,
      exp: VECTOR_IAT + 60,
      jti: VECTOR_JTI,
    });
    expect(mintPass(VECTOR_SECRET, claims)).toBe(VECTOR_PASS);
  });

  it('encodes the exact payload JSON without padding', () => {
    const [payload, signature] = VECTOR_PASS.split('.');

    expect(fromB64url(payload)).toBe(VECTOR_PAYLOAD);
    expect(VECTOR_PASS).not.toContain('=');
    expect(signature).toHaveLength(43);
  });

  it('keeps the contract key order whatever order the claims object has', () => {
    const shuffled: t.ToolPassClaims = {
      jti: VECTOR_JTI,
      exp: VECTOR_IAT + 60,
      iat: VECTOR_IAT,
      aud: 'console',
      sub: 'admin@example.com',
      v: 1,
    };
    expect(mintPass(VECTOR_SECRET, shuffled)).toBe(VECTOR_PASS);
  });

  it('mints the vector through frameSrc for a same-origin embed', () => {
    const src = frameSrc(CONSOLE, {
      secret: VECTOR_SECRET,
      email: 'Admin@Example.com',
      now: VECTOR_NOW_MS,
      jti: VECTOR_JTI,
    });
    expect(src).toBe(`/console/?aura_pass=${VECTOR_PASS}`);
  });
});

describe('mint and verify round trip', () => {
  it('passes every contract rule within its minute', () => {
    expect(verifyPass(VECTOR_PASS, VECTOR_SECRET, VECTOR_IAT)).toBe('admin@example.com');
    expect(verifyPass(VECTOR_PASS, VECTOR_SECRET, VECTOR_IAT - 5)).toBe('admin@example.com');
    expect(verifyPass(VECTOR_PASS, VECTOR_SECRET, VECTOR_IAT + 59)).toBe('admin@example.com');
  });

  it('expires after sixty seconds and is not valid long before its issue time', () => {
    expect(verifyPass(VECTOR_PASS, VECTOR_SECRET, VECTOR_IAT + PASS_LIFETIME_SECONDS)).toBe('expired');
    expect(verifyPass(VECTOR_PASS, VECTOR_SECRET, VECTOR_IAT - 6)).toBe('issued-in-future');
  });

  it('fails the signature under another secret or after tampering', () => {
    const [payload, signature] = VECTOR_PASS.split('.');
    const forged = Buffer.from(VECTOR_PAYLOAD.replace('admin@', 'other@')).toString('base64url');

    expect(verifyPass(VECTOR_PASS, `${VECTOR_SECRET}-other`, VECTOR_IAT)).toBe('signature');
    expect(verifyPass(`${forged}.${signature}`, VECTOR_SECRET, VECTOR_IAT)).toBe('signature');
    expect(verifyPass(`${payload}.${signature.slice(0, -1)}A`, VECTOR_SECRET, VECTOR_IAT)).toBe('signature');
  });

  it('round-trips a fresh pass with a random id and the current time', () => {
    const now = Date.now();
    const src = frameSrc(CONSOLE, { secret: VECTOR_SECRET, email: ' Ada@Example.COM ' });
    const pass = passOf(src);
    const claims: t.ToolPassClaims = JSON.parse(fromB64url(pass.split('.')[0]));

    expect(verifyPass(pass, VECTOR_SECRET, Math.floor(now / 1000))).toBe('ada@example.com');
    expect(claims.iat).toBeGreaterThanOrEqual(Math.floor(now / 1000));
    expect(claims.exp - claims.iat).toBe(PASS_LIFETIME_SECONDS);
    expect(claims.jti).toMatch(/^[0-9a-f]{32}$/);
  });

  it('gives every pass its own id', () => {
    const input = { secret: VECTOR_SECRET, email: 'ada@example.com' };
    const ids = new Set(
      Array.from({ length: 5 }, () => JSON.parse(fromB64url(passOf(frameSrc(CONSOLE, input)).split('.')[0])).jti),
    );
    expect(ids.size).toBe(5);
  });

  it('uses the entry audience, and the console refuses a pass for another audience', () => {
    const src = frameSrc({ ...CONSOLE, audience: 'reports' }, { secret: VECTOR_SECRET, email: 'ada@example.com' });
    const pass = passOf(src);
    const nowSeconds = Math.floor(Date.now() / 1000);

    expect(DEFAULT_PASS_AUDIENCE).toBe('console');
    expect(verifyPass(pass, VECTOR_SECRET, nowSeconds, 'reports')).toBe('ada@example.com');
    expect(verifyPass(pass, VECTOR_SECRET, nowSeconds)).toBe('audience');
  });
});

describe('frameSrc', () => {
  const INPUT: t.FrameSrcInput = { secret: VECTOR_SECRET, email: 'ada@example.com' };

  it('returns the plain href for a tab entry', () => {
    expect(frameSrc({ ...CONSOLE, mode: 'tab' }, INPUT)).toBe('/console/');
  });

  it('returns nothing for a text entry', () => {
    expect(frameSrc({ id: 'rota', label: 'On call', mode: 'text', icon: 'users' }, INPUT)).toBeUndefined();
  });

  it.each([
    'https://console.example.com/',
    'http://localhost:8080/',
    'http://127.0.0.1:8080/console/',
    '//console.example.com/',
    '/\\console.example.com/',
  ])('never adds a pass for the other-origin href %s', (href) => {
    expect(frameSrc({ ...CONSOLE, href }, INPUT)).toBe(href);
  });

  it('adds no pass without a secret or with a short one', () => {
    expect(frameSrc(CONSOLE, { ...INPUT, secret: undefined })).toBe('/console/');
    expect(frameSrc(CONSOLE, { ...INPUT, secret: '' })).toBe('/console/');
    expect(frameSrc(CONSOLE, { ...INPUT, secret: SHORT_SECRET })).toBe('/console/');
  });

  it('adds no pass without an email', () => {
    expect(frameSrc(CONSOLE, { ...INPUT, email: undefined })).toBe('/console/');
    expect(frameSrc(CONSOLE, { ...INPUT, email: '   ' })).toBe('/console/');
  });

  it('keeps an existing query and puts the pass before the fragment', () => {
    const src = frameSrc({ ...CONSOLE, href: '/console/?tab=usage#spend' }, INPUT);
    expect(src).toMatch(/^\/console\/\?tab=usage&aura_pass=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}#spend$/);
  });
});

describe('isPassSecret', () => {
  it('needs at least 32 characters', () => {
    expect(isPassSecret(undefined)).toBe(false);
    expect(isPassSecret(SHORT_SECRET)).toBe(false);
    expect(isPassSecret('x'.repeat(32))).toBe(true);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(isPassSecret('\u{1F511}'.repeat(31))).toBe(false);
    expect(isPassSecret('\u{1F511}'.repeat(32))).toBe(true);
  });
});

describe('withPass', () => {
  it.each([
    ['/console/', '/console/?aura_pass=P'],
    ['/console/?', '/console/?aura_pass=P'],
    ['/console/?a=1&b=2', '/console/?a=1&b=2&aura_pass=P'],
    ['/console/?a=1&', '/console/?a=1&aura_pass=P'],
    ['/console/#usage', '/console/?aura_pass=P#usage'],
    ['/console/?a=1#usage?x=1', '/console/?a=1&aura_pass=P#usage?x=1'],
    ['/console/#', '/console/?aura_pass=P#'],
    ['/console/?aura_pass=old&a=1', '/console/?a=1&aura_pass=P'],
    ['/console/?aura_pass&a=1', '/console/?a=1&aura_pass=P'],
    ['/console/?aura_passive=1', '/console/?aura_passive=1&aura_pass=P'],
  ])('adds the pass to %s', (href, expected) => {
    expect(withPass(href, 'P')).toBe(expected);
  });
});
