import { Icon } from '@clickhouse/click-ui';
import { useQuery } from '@tanstack/react-query';
import type * as t from '@/types';
import { LoadingState } from '@/components/shared';
import { adminLinksOptions } from '@/server';
import { useLocalize } from '@/hooks';

const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads';

function findEmbed(links: t.AdminLink[] | undefined, id: string): t.AdminUrlLink | undefined {
  const link = links?.find((entry) => entry.id === id);
  return link?.mode === 'embed' ? link : undefined;
}

function ToolNotFound() {
  const localize = useLocalize();
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <span aria-hidden="true" className="text-(--cui-color-text-muted)">
        <Icon name="puzzle-piece" size="md" />
      </span>
      <h1 className="text-lg font-semibold text-(--cui-color-title-default)">
        {localize('com_aura_tools_not_found_title')}
      </h1>
      <p className="max-w-md text-sm text-(--cui-color-text-muted)">
        {localize('com_aura_tools_not_found_desc')}
      </p>
    </div>
  );
}

/** Full-height embed of one admin tool, with a link to open it in a new tab. */
export function Embed({ id }: t.EmbedProps) {
  const localize = useLocalize();
  const { data: links, isLoading } = useQuery(adminLinksOptions);

  if (isLoading) return <LoadingState />;

  const link = findEmbed(links, id);
  if (!link) return <ToolNotFound />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-(--cui-color-stroke-default) px-4 py-2">
        <h1 className="truncate text-sm font-semibold text-(--cui-color-text-default)">
          {link.label}
        </h1>
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 text-sm text-(--cui-color-text-link) no-underline hover:underline"
        >
          {localize('com_aura_tools_open_tab')}
          <span aria-hidden="true">
            <Icon name="popout" size="xs" />
          </span>
        </a>
      </div>
      <iframe
        key={link.id}
        src={link.href}
        title={link.label}
        referrerPolicy="no-referrer"
        sandbox={IFRAME_SANDBOX}
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
