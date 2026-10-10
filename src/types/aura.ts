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

export interface ShellProps {
  children: ReactNode;
}
