import { useLocalize } from '@/hooks';
import { legalLinks } from './legal';

/** One-line AGPL legal notice with License, Source and Notices links. */
export function Footer() {
  const localize = useLocalize();

  return (
    <footer className="shrink-0 border-t border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-4 py-1.5 text-center text-xs leading-relaxed text-(--cui-color-text-muted)">
      <span>{localize('com_aura_legal_notice')}</span>
      <nav
        aria-label={localize('com_aura_legal_links')}
        className="ml-2 inline-flex flex-wrap justify-center gap-x-3"
      >
        {legalLinks().map((link) => (
          <a
            key={link.labelKey}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--cui-color-text-muted) underline underline-offset-2 hover:text-(--cui-color-text-default)"
          >
            {localize(link.labelKey)}
          </a>
        ))}
      </nav>
    </footer>
  );
}
