import type * as t from '@/types';
import { publicUrl } from './paths';

export const SOURCE_REPOSITORY = 'https://github.com/ortimusirig/aura-admin';
export const DEFAULT_SOURCE_REF = 'aura';

const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;

/** Source tree for a commit or branch; falls back to the `aura` branch. */
export function sourceUrl(ref: string | undefined): string {
  const value = ref?.trim();
  const valid = !!value && REF_PATTERN.test(value) && !value.includes('..');
  return `${SOURCE_REPOSITORY}/tree/${valid ? value : DEFAULT_SOURCE_REF}`;
}

/** License, source and notices links; the commit comes from the build (`VITE_AURA_COMMIT`). */
export function legalLinks(): t.LegalLink[] {
  return [
    { labelKey: 'com_aura_legal_license', href: publicUrl('LICENSE.txt') },
    { labelKey: 'com_aura_legal_source', href: sourceUrl(import.meta.env.VITE_AURA_COMMIT) },
    { labelKey: 'com_aura_legal_notices', href: publicUrl('NOTICE.txt') },
  ];
}
