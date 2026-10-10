import type * as t from '@/types';
import { useLocalize } from '@/hooks';
import { legalLinks } from './legal';

const WIDE_ONLY = 'max-sm:hidden [@media(max-height:32rem)]:hidden';
const COMPACT_ONLY = 'hidden max-sm:inline-block [@media(max-height:32rem)]:inline-block';
const FOOTER_LINK =
  'text-(--cui-color-text-muted) underline underline-offset-2 hover:text-(--cui-color-text-default)';

/** License, Source and Notices links; each opens in a new tab and says so to screen readers. */
export function LegalLinks({ linkClassName }: t.LegalLinksProps) {
  const localize = useLocalize();
  const hint = ` (${localize('com_aura_new_tab_hint')})`;

  return (
    <>
      {legalLinks().map((link) => (
        <a
          key={link.labelKey}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {localize(link.labelKey)}
          <span className="sr-only">{hint}</span>
        </a>
      ))}
    </>
  );
}

/**
 * AGPL legal notice with License, Source and Notices links. Below the sm breakpoint or on
 * short viewports it shrinks to one line, and the full notice sits behind a disclosure.
 */
export function Footer() {
  const localize = useLocalize();
  const notice = localize('com_aura_legal_notice');

  return (
    <footer className="shrink-0 border-t border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-4 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-center text-xs leading-relaxed text-(--cui-color-text-muted)">
      <span className={WIDE_ONLY}>{notice}</span>
      <div className={COMPACT_ONLY}>
        <details>
          <summary className="cursor-pointer hover:text-(--cui-color-text-default)">
            {localize('com_aura_legal_short')}
          </summary>
          <span className="block">{notice}</span>
        </details>
      </div>
      <nav
        aria-label={localize('com_aura_legal_links')}
        className="ml-2 inline-flex flex-wrap justify-center gap-x-3"
      >
        <LegalLinks linkClassName={FOOTER_LINK} />
      </nav>
    </footer>
  );
}
