import { useId } from 'react';
import { Icon } from '@clickhouse/click-ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useLoaderData } from '@tanstack/react-router';
import type * as t from '@/types';
import { adminLinksOptions } from '@/server';
import { useLocalize } from '@/hooks';
import { cn } from '@/utils';

const ROW_CLASS =
  'flex min-h-8 items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-sm whitespace-nowrap no-underline transition-colors duration-100';
const IDLE_CLASS =
  'font-normal text-(--cui-color-text-muted) hover:bg-(--cui-color-background-hover) hover:text-(--cui-color-text-default)';
const ACTIVE_CLASS = 'bg-(--cui-color-background-active) font-medium text-(--cui-color-text-default)';

function collapsedLabel(link: t.AdminLink, collapsed: boolean) {
  return collapsed ? { 'aria-label': link.label, title: link.label } : {};
}

function LinkIcon({ link }: { link: t.AdminLink }) {
  return (
    <span aria-hidden="true" className="shrink-0">
      <Icon name={link.icon} size="sm" />
    </span>
  );
}

function TextRow({ link, collapsed }: { link: t.AdminLink; collapsed: boolean }) {
  return (
    <div
      role="note"
      {...collapsedLabel(link, collapsed)}
      className={cn(ROW_CLASS, 'py-1 text-(--cui-color-text-muted)')}
    >
      <LinkIcon link={link} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{link.label}</span>
        {link.note && !collapsed && (
          <span className="truncate text-xs text-(--cui-color-text-muted)">{link.note}</span>
        )}
      </span>
    </div>
  );
}

function TabRow({ link, collapsed }: { link: t.AdminUrlLink; collapsed: boolean }) {
  const localize = useLocalize();
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      {...collapsedLabel(link, collapsed)}
      className={cn(ROW_CLASS, IDLE_CLASS)}
    >
      <LinkIcon link={link} />
      <span className="truncate text-sm">{link.label}</span>
      <span className="sr-only">{`(${localize('com_aura_tools_new_tab_hint')})`}</span>
    </a>
  );
}

function EmbedRow({ link, collapsed }: { link: t.AdminUrlLink; collapsed: boolean }) {
  return (
    <Link
      to="/tools/$id"
      params={{ id: link.id }}
      {...collapsedLabel(link, collapsed)}
      className={ROW_CLASS}
      activeProps={{ className: ACTIVE_CLASS }}
      inactiveProps={{ className: IDLE_CLASS }}
    >
      <LinkIcon link={link} />
      <span className="truncate text-sm">{link.label}</span>
    </Link>
  );
}

function ToolRow({ link, collapsed }: { link: t.AdminLink; collapsed: boolean }) {
  if (link.mode === 'text') return <TextRow link={link} collapsed={collapsed} />;
  if (link.mode === 'tab') return <TabRow link={link} collapsed={collapsed} />;
  return <EmbedRow link={link} collapsed={collapsed} />;
}

/** Sidebar section listing the admin tools from `AURA_ADMIN_LINKS` (admins only). */
export function Tools({ collapsed }: t.ToolsProps) {
  const headingId = useId();
  const { data: links } = useQuery(adminLinksOptions);
  const { linksTitle } = useLoaderData({ from: '__root__' });

  if (!links || links.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="mt-4 flex flex-col gap-0.5">
      <h2
        id={headingId}
        className={cn(
          'truncate px-2.5 pb-1 text-xs font-medium text-(--cui-color-title-muted)',
          collapsed && 'sr-only',
        )}
      >
        {linksTitle}
      </h2>
      {collapsed && (
        <div aria-hidden="true" className="mx-2.5 mb-1 border-t border-(--cui-color-stroke-default)" />
      )}
      {links.map((link) => (
        <ToolRow key={link.id} link={link} collapsed={collapsed} />
      ))}
    </section>
  );
}
