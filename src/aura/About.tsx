import { Icon } from '@clickhouse/click-ui';
import { useLocalize } from '@/hooks';
import { legalLinks } from './legal';

/** Help page card linking the license, the source of this build and the notices. */
export function About() {
  const localize = useLocalize();

  return (
    <section aria-label={localize('com_aura_about_title')}>
      <div className="flex items-start gap-3 rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-4">
        <span aria-hidden="true" className="mt-0.5 text-(--cui-color-text-muted)">
          <Icon name="information" size="sm" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium text-(--cui-color-text-default)">
            {localize('com_aura_about_title')}
          </h3>
          <p className="text-xs text-(--cui-color-text-muted)">{localize('com_aura_about_desc')}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {legalLinks().map((link) => (
              <a
                key={link.labelKey}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-(--cui-color-text-link) no-underline hover:underline"
              >
                {localize(link.labelKey)}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
