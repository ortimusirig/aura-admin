import type * as t from '@/types';
import { Footer } from './Footer';

/**
 * Full-viewport page frame: the page scrolls inside the content area and the legal
 * footer stays visible below it, so the footer never overlaps page content.
 */
export function Shell({ children }: t.ShellProps) {
  return (
    <div className="flex h-dvh flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
      <Footer />
    </div>
  );
}
