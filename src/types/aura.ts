import type { ReactNode } from 'react';
import type { IconName } from './scope';

/** How an admin tool link opens: embedded in the panel, in a new tab, or as plain text. */
export type AdminLinkMode = 'embed' | 'tab' | 'text';

interface AdminLinkBase {
  id: string;
  label: string;
  icon: IconName;
  note?: string;
}

export interface AdminTextLink extends AdminLinkBase {
  mode: 'text';
}

export interface AdminUrlLink extends AdminLinkBase {
  mode: 'embed' | 'tab';
  href: string;
  /** `aud` of the tool pass a same-origin embed receives; the pass default applies when absent. */
  audience?: string;
}

export type AdminLink = AdminTextLink | AdminUrlLink;

/** Fields read from one untrusted AURA_ADMIN_LINKS entry before validation. */
export interface RawAdminLink {
  id?: unknown;
  label?: unknown;
  href?: unknown;
  mode?: unknown;
  icon?: unknown;
  note?: unknown;
  audience?: unknown;
}

export type AdminLinksError = 'invalid-json' | 'not-an-array';

export interface AdminLinksParseResult {
  links: AdminLink[];
  /** Zero-based positions of entries that were invalid, duplicated or beyond the limit. */
  dropped: number[];
  error?: AdminLinksError;
}

export type BrandFile = 'favicon.ico' | 'apple-touch-icon.png' | 'logo.svg' | 'manifest.json';

/** Where the production server serves a published static file from. */
export type StaticFileChoice =
  | { source: 'brand'; path: string; headers: Readonly<Record<string, string>> }
  | { source: 'public' };

/** Site settings that reach the client at runtime (never at build time). */
export interface AuraSettings {
  brand: string;
  linksTitle: string;
}

export interface LegalLink {
  labelKey: string;
  href: string;
}

export interface LegalLinksProps {
  linkClassName: string;
}

export interface ToolsProps {
  collapsed: boolean;
}

export interface EmbedProps {
  id: string;
}

export interface EmbedFrameProps {
  link: AdminUrlLink;
}

/** The iframe src answered for one load of an embedded tool (loads count up on Reload frame). */
export interface FrameSrc {
  load: number;
  src: string;
}

/** Claims of an AURA tool pass, version 1, in the key order of the pass contract. */
export interface ToolPassClaims {
  v: 1;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
}

/** What the iframe src of one admin link depends on; `now` (ms) and `jti` are fixed only in tests. */
export interface FrameSrcInput {
  secret: string | undefined;
  email: string | undefined;
  now?: number;
  jti?: string;
}

export interface ShellProps {
  children: ReactNode;
}
