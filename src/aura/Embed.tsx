import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Icon } from '@clickhouse/click-ui';
import type * as t from '@/types';
import { adminLinksOptions, getToolFrameSrcFn } from '@/server';
import { LoadingState } from '@/components/shared';
import { useLocalize } from '@/hooks';

/**
 * Scripts, same-origin storage, forms, popups and downloads, plus the confirm/prompt dialogs and
 * a top-level navigation the user clicks (an embedded tool's link back to the panel).
 */
const IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-top-navigation-by-user-activation';

function findEmbed(links: t.AdminLink[] | undefined, id: string): t.AdminUrlLink | undefined {
  const link = links?.find((entry) => entry.id === id);
  return link?.mode === 'embed' ? link : undefined;
}

/**
 * Asks the server for the iframe src of each load (a fresh pass every time), outside the router
 * and query caches; falls back to the plain href when the request fails. `undefined` while the
 * current load is pending.
 */
function useFrameSrc(link: t.AdminUrlLink, load: number): string | undefined {
  const [frame, setFrame] = useState<t.FrameSrc>();
  const { id, href } = link;

  useEffect(() => {
    let current = true;
    getToolFrameSrcFn({ data: { id } })
      .then((src) => src ?? href)
      .catch(() => href)
      .then((src) => {
        if (current) setFrame({ load, src });
      });
    return () => {
      current = false;
    };
  }, [id, href, load]);

  return frame?.load === load ? frame.src : undefined;
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

function EmbedFrame({ link }: t.EmbedFrameProps) {
  const localize = useLocalize();
  const [load, setLoad] = useState(0);
  const src = useFrameSrc(link, load);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-(--cui-color-stroke-default) px-4 py-2">
        <h1 className="truncate text-sm font-semibold text-(--cui-color-text-default)">
          {link.label}
        </h1>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            htmlType="button"
            type="empty"
            iconLeft="refresh"
            label={localize('com_aura_tools_reload')}
            onClick={() => setLoad((count) => count + 1)}
          />
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
      </div>
      {src ? (
        <iframe
          key={load}
          src={src}
          title={link.label}
          referrerPolicy="no-referrer"
          sandbox={IFRAME_SANDBOX}
          className="min-h-0 w-full flex-1 border-0"
        />
      ) : (
        <LoadingState />
      )}
    </div>
  );
}

/** Full-height embed of one admin tool, with Reload frame and a link to open it in a new tab. */
export function Embed({ id }: t.EmbedProps) {
  const { data: links, isLoading } = useQuery(adminLinksOptions);

  if (isLoading) return <LoadingState />;

  const link = findEmbed(links, id);
  if (!link) return <ToolNotFound />;
  return <EmbedFrame key={link.id} link={link} />;
}
