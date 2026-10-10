import crypto from 'crypto';
import type * as t from '@/types';

export const PASS_VERSION = 1;
export const PASS_PARAM = 'aura_pass';
export const PASS_LIFETIME_SECONDS = 60;
export const MIN_PASS_SECRET_LENGTH = 32;
export const DEFAULT_PASS_AUDIENCE = 'console';

const PASS_KEY_LABEL = 'aura-tool-pass-v1';
const SAME_ORIGIN_PATH = /^\/(?![/\\])/;

/** True for a secret of at least {@link MIN_PASS_SECRET_LENGTH} characters (code points, as the console counts). */
export function isPassSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && Array.from(secret).length >= MIN_PASS_SECRET_LENGTH;
}

/** `pass_key = HMAC-SHA256(secret, "aura-tool-pass-v1")`, the raw 32-byte digest. */
export function derivePassKey(secret: string): Buffer {
  return crypto.createHmac('sha256', secret).update(PASS_KEY_LABEL).digest();
}

/** Claims of a pass issued at `now` (ms), valid for one minute, with a random 128-bit id. */
export function passClaims(
  sub: string,
  aud: string,
  now: number = Date.now(),
  jti: string = crypto.randomBytes(16).toString('hex'),
): t.ToolPassClaims {
  const iat = Math.floor(now / 1000);
  return { v: PASS_VERSION, sub, aud, iat, exp: iat + PASS_LIFETIME_SECONDS, jti };
}

/**
 * Mints `<payload>.<signature>` (pass contract version 1): the payload is the base64url JSON of
 * the claims in contract key order, the signature the base64url HMAC-SHA256 of the payload
 * under the pass key, both without padding.
 */
export function mintPass(secret: string, claims: t.ToolPassClaims): string {
  const { v, sub, aud, iat, exp, jti } = claims;
  const payload = Buffer.from(JSON.stringify({ v, sub, aud, iat, exp, jti }), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', derivePassKey(secret)).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/** Splits `value` at the first `mark`; the second part keeps the mark (`''` without one). */
function cut(value: string, mark: string): [string, string] {
  const at = value.indexOf(mark);
  return at < 0 ? [value, ''] : [value.slice(0, at), value.slice(at)];
}

function isPassParam(param: string): boolean {
  return param === PASS_PARAM || param.startsWith(`${PASS_PARAM}=`);
}

/** Adds `aura_pass=<pass>` as the last query parameter of `href`, before any `#fragment`, replacing an existing one. */
export function withPass(href: string, pass: string): string {
  const [base, fragment] = cut(href, '#');
  const [path, query] = cut(base, '?');
  const params = query
    .slice(1)
    .split('&')
    .filter((param) => param && !isPassParam(param));
  return `${path}?${[...params, `${PASS_PARAM}=${pass}`].join('&')}${fragment}`;
}

/**
 * The iframe src of one admin link: its href, with a fresh pass only for an `embed` entry whose
 * href is a same-origin path, when the secret is valid and the admin has an email (the pass
 * subject, lower case). `undefined` for text entries, which have no href.
 */
export function frameSrc(link: t.AdminLink, input: t.FrameSrcInput): string | undefined {
  if (link.mode === 'text') return undefined;

  const sub = input.email?.trim().toLowerCase();
  if (link.mode !== 'embed' || !SAME_ORIGIN_PATH.test(link.href)) return link.href;
  if (!sub || !isPassSecret(input.secret)) return link.href;

  const claims = passClaims(sub, link.audience ?? DEFAULT_PASS_AUDIENCE, input.now, input.jti);
  return withPass(link.href, mintPass(input.secret, claims));
}
