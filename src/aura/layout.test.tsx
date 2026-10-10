import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { CSSProperties, ReactNode } from 'react';
import type * as t from '@/types';
import { Route as CallbackRoute } from '@/routes/auth/openid/callback';
import { Route as ToolRoute } from '@/routes/_app/tools/$id';
import { HelpPage } from '@/components/help/HelpPage';
import { Route as RootRoute } from '@/routes/__root';
import { Route as LoginRoute } from '@/routes/login';
import { Route as AppRoute } from '@/routes/_app';
import { SystemCapabilities } from '@/constants';
import { DEFAULT_BRAND_NAME, applyBrand } from './brand';
import { loadSettings } from './settings';
import i18n from '@/locales/i18n';

interface StubProps {
  children?: ReactNode;
  label?: string;
  text?: string;
  name?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

const server = vi.hoisted(() => ({
  getAuraSettingsFn: vi.fn(),
  getAdminLinksFn: vi.fn(),
  getToolFrameSrcFn: vi.fn(),
  getEffectiveCapabilitiesFn: vi.fn(),
  adminLogoutFn: vi.fn(),
  adminLoginFn: vi.fn(),
  adminVerify2FAFn: vi.fn(),
  openidLoginFn: vi.fn(),
}));

vi.mock('@/server', () => ({
  ...server,
  openIdCheckOptions: {
    queryKey: ['openIdCheck'],
    queryFn: async () => ({ available: false, ssoOnly: false }),
  },
  adminLinksOptions: {
    queryKey: ['auraAdminLinks'],
    queryFn: () => server.getAdminLinksFn(),
  },
}));

vi.mock('@clickhouse/click-ui', () => {
  const Box = ({ children }: StubProps) => <div>{children}</div>;
  const DropdownRoot = ({ children }: StubProps) => <div>{children}</div>;
  return {
    ClickUIProvider: ({ children }: StubProps) => <>{children}</>,
    Container: ({ children, style }: StubProps) => <div style={style}>{children}</div>,
    Panel: Box,
    Title: ({ children }: StubProps) => <h1>{children}</h1>,
    Alert: ({ text }: StubProps) => <div role="alert">{text}</div>,
    Button: ({ label, onClick }: StubProps) => (
      <button type="button" onClick={onClick}>
        {label}
      </button>
    ),
    Separator: () => <hr />,
    TextField: ({ label }: StubProps) => <input aria-label={label} />,
    PasswordField: ({ label }: StubProps) => <input type="password" aria-label={label} />,
    Icon: ({ name }: StubProps) => <span data-icon={name} />,
    Dropdown: Object.assign(DropdownRoot, {
      Trigger: ({ children }: StubProps) => <>{children}</>,
      Content: () => null,
      Item: Box,
    }),
  };
});

vi.mock('@tanstack/react-devtools', () => ({ TanStackDevtools: () => null }));
vi.mock('@tanstack/react-query-devtools', () => ({ ReactQueryDevtoolsPanel: () => null }));
vi.mock('@tanstack/react-router-devtools', () => ({ TanStackRouterDevtoolsPanel: () => null }));
vi.mock('@/components/CommandMenu', () => ({ CommandMenu: () => null }));
vi.mock('@/components/SettingsDialog', () => ({ SettingsDialog: () => null }));

const USER = { id: 'user-1', name: 'Ada Admin', email: 'ada@example.com' };
const SOURCE_PREFIX = 'https://github.com/ortimusirig/aura-admin/tree/';
const SIDEBAR_KEY = 'admin-panel:sidebar-collapsed';
const NEW_TAB = '(opens in a new tab)';
const newTab = (label: string) => new RegExp(String.raw`^${label}\s*\(opens in a new tab\)$`);

const LINKS: t.AdminLink[] = [
  { id: 'metrics', label: 'Metrics', href: 'https://metrics.example.com/d/1', mode: 'embed', icon: 'metrics' },
  { id: 'status', label: 'Status', href: 'https://status.example.com/', mode: 'tab', icon: 'activity' },
  { id: 'rota', label: 'On call', mode: 'text', icon: 'users', note: 'See the team rota' },
];
const CONSOLE_LINK: t.AdminLink = {
  id: 'console',
  label: 'Console',
  href: '/console/#usage',
  mode: 'embed',
  icon: 'console',
};
const PASS_SRC_1 = '/console/?aura_pass=first.pass#usage';
const PASS_SRC_2 = '/console/?aura_pass=second.pass#usage';
const SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-top-navigation-by-user-activation';

function stubMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

type HeadContext = Parameters<NonNullable<typeof RootRoute.options.head>>[0];

/**
 * Mounts the real root, login, OAuth callback, `_app`, help and tools route components at
 * `url`, with the real root error and not-found pages. `rootLoader` replaces the settings loader.
 */
function renderAt(url: string, rootLoader: () => Promise<t.AuraSettings> = loadSettings) {
  const rootRoute = createRootRoute({
    component: RootRoute.options.component,
    errorComponent: RootRoute.options.errorComponent,
    notFoundComponent: RootRoute.options.notFoundComponent,
    loader: rootLoader,
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    validateSearch: () => ({ redirect: '/' }),
    loader: () => ({ ssoAvailable: false, ssoOnly: false }),
    component: LoginRoute.options.component,
  });
  const callbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/auth/openid/callback',
    loader: () => ({ error: 'invalid_code' as const }),
    component: CallbackRoute.options.component,
  });
  const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_app',
    beforeLoad: () => ({ user: USER }),
    component: AppRoute.options.component,
    notFoundComponent: AppRoute.options.notFoundComponent,
  });
  const helpRoute = createRoute({
    getParentRoute: () => appRoute,
    path: '/help',
    component: HelpPage,
  });
  const toolRoute = createRoute({
    getParentRoute: () => appRoute,
    path: '/tools/$id',
    component: ToolRoute.options.component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      loginRoute,
      callbackRoute,
      appRoute.addChildren([helpRoute, toolRoute]),
    ]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

async function findFooter() {
  return screen.findByRole('contentinfo');
}

beforeEach(() => {
  stubMatchMedia();
  localStorage.clear();
  server.getAuraSettingsFn.mockResolvedValue({ brand: 'Acme Console', linksTitle: 'Operations' });
  server.getAdminLinksFn.mockResolvedValue(LINKS);
  server.getToolFrameSrcFn.mockReset();
  server.getToolFrameSrcFn.mockImplementation(async ({ data }: { data: { id: string } }) => {
    const link = LINKS.find((entry) => entry.id === data.id);
    return link?.mode === 'embed' ? link.href : null;
  });
  server.getEffectiveCapabilitiesFn.mockResolvedValue({
    capabilities: [SystemCapabilities.ACCESS_ADMIN],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  applyBrand(i18n, DEFAULT_BRAND_NAME);
});

describe('legal footer', () => {
  it('renders on the login page with the brand and the legal links', async () => {
    renderAt('/login');

    const footer = await findFooter();
    expect(footer).toHaveTextContent(
      'Acme Console is based on LibreChat Admin Panel, copyright its contributors, modified by Applexus Technologies. AGPL-3.0, no warranty; you may redistribute it under the AGPL.',
    );
    const links = within(footer);
    expect(links.getByRole('link', { name: newTab('License') })).toHaveAttribute('href', '/LICENSE.txt');
    expect(links.getByRole('link', { name: newTab('Notices') })).toHaveAttribute('href', '/NOTICE.txt');
    expect(links.getByRole('link', { name: newTab('Source') })).toHaveAttribute('href', `${SOURCE_PREFIX}aura`);
    expect(screen.getByRole('heading', { level: 1, name: 'Acme Console' })).toBeInTheDocument();
  });

  it('renders on an _app page with the build commit link', async () => {
    vi.stubEnv('VITE_AURA_COMMIT', '9f8e7d6c5b4a');
    renderAt('/help');

    const footer = await findFooter();
    expect(within(footer).getByRole('link', { name: newTab('Source') })).toHaveAttribute(
      'href',
      `${SOURCE_PREFIX}9f8e7d6c5b4a`,
    );
    expect(await screen.findByRole('navigation', { name: 'Legal links' })).toBeInTheDocument();
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });

  it('shows the About and license card on the help page', async () => {
    renderAt('/help');

    const card = await screen.findByRole('region', { name: 'About and license' });
    expect(within(card).getByRole('link', { name: newTab('License') })).toHaveAttribute('href', '/LICENSE.txt');
    expect(within(card).getByRole('link', { name: newTab('Source') })).toHaveAttribute(
      'href',
      `${SOURCE_PREFIX}aura`,
    );
    expect(within(card).getByRole('link', { name: newTab('Notices') })).toHaveAttribute('href', '/NOTICE.txt');
  });

  it('has a compact form with the full notice behind a disclosure', async () => {
    renderAt('/login');

    const footer = await findFooter();
    const summary = within(footer).getByText('AGPL-3.0, no warranty.');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.closest('details')).toHaveTextContent(
      'Acme Console is based on LibreChat Admin Panel, copyright its contributors',
    );
    expect(within(footer).getAllByRole('link')).toHaveLength(3);
  });

  it('uses the neutral name when the settings cannot be loaded', async () => {
    server.getAuraSettingsFn.mockRejectedValue(new Error('offline'));
    renderAt('/login');

    expect(await findFooter()).toHaveTextContent(/^Admin Panel is based on LibreChat Admin Panel/);
  });
});

describe('legal footer on every kind of page', () => {
  it('renders once on the not-found page', async () => {
    renderAt('/does-not-exist');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });

  it('renders once when access is denied', async () => {
    server.getEffectiveCapabilitiesFn.mockResolvedValue({ capabilities: [] });
    renderAt('/help');

    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });

  it('renders once on the root error page', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderAt('/login', () => Promise.reject(new Error('root failed')));

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it('renders once on the OAuth callback error page', async () => {
    renderAt('/auth/openid/callback');

    expect(await screen.findByRole('heading', { name: 'Authentication failed' })).toBeInTheDocument();
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: newTab('Source') })).toHaveAttribute(
      'href',
      `${SOURCE_PREFIX}aura`,
    );
  });
});

describe('document head', () => {
  async function headFor(loaderData: t.AuraSettings | undefined) {
    const context: Partial<HeadContext> = { loaderData };
    return RootRoute.options.head?.(context as HeadContext);
  }

  it('names the document after the runtime brand and links the overlayable icons', async () => {
    const head = await headFor({ brand: 'Acme Console', linksTitle: 'Tools' });

    expect(head?.meta).toContainEqual({ title: 'Acme Console' });
    expect(head?.links).toEqual(
      expect.arrayContaining([
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.json' },
      ]),
    );
  });

  it('uses the neutral name before the settings load', async () => {
    const head = await headFor(undefined);

    expect(head?.meta).toContainEqual({ title: DEFAULT_BRAND_NAME });
  });
});

describe('sidebar tools section', () => {
  it('shows the heading and every mode when expanded', async () => {
    localStorage.setItem(SIDEBAR_KEY, 'false');
    renderAt('/help');

    const heading = await screen.findByRole('heading', { name: 'Operations' });
    expect(heading).not.toHaveClass('sr-only');
    const section = within(screen.getByRole('region', { name: 'Operations' }));

    const embed = section.getByRole('link', { name: 'Metrics' });
    expect(embed).toHaveAttribute('href', '/tools/metrics');
    expect(embed).not.toHaveAttribute('target');

    const tab = section.getByRole('link', { name: newTab('Status') });
    expect(tab).toHaveAttribute('href', 'https://status.example.com/');
    expect(tab).toHaveAttribute('target', '_blank');
    expect(tab).toHaveAttribute('rel', 'noopener noreferrer');

    const note = section.getByRole('note');
    expect(note).toHaveTextContent('On call');
    expect(note).toHaveTextContent('See the team rota');
    expect(within(note).queryByRole('link')).toBeNull();
    expect(section.getAllByRole('link')).toHaveLength(2);
  });

  it('shows icons only, with label as title and aria-label, when collapsed', async () => {
    localStorage.setItem(SIDEBAR_KEY, 'true');
    renderAt('/help');

    expect(await screen.findByRole('heading', { name: 'Operations' })).toHaveClass('sr-only');
    const section = within(screen.getByRole('region', { name: 'Operations' }));

    const embed = section.getByRole('link', { name: 'Metrics' });
    expect(embed).toHaveAttribute('aria-label', 'Metrics');
    expect(embed).toHaveAttribute('title', 'Metrics');

    const tab = section.getByRole('link', { name: newTab('Status') });
    expect(tab).toHaveAttribute('aria-label', `Status ${NEW_TAB}`);
    expect(tab).toHaveAttribute('title', `Status ${NEW_TAB}`);

    const note = section.getByRole('note', { name: 'On call: See the team rota' });
    expect(note).toHaveAttribute('title', 'On call: See the team rota');
    expect(note).not.toHaveTextContent('See the team rota');
  });

  it('shows the brand in the sidebar header', async () => {
    localStorage.setItem(SIDEBAR_KEY, 'false');
    renderAt('/help');

    expect(await screen.findByRole('complementary', { name: 'Acme Console' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Acme Console logo' })).toHaveAttribute('src', '/logo.svg');
  });

  it('renders no tools section without links', async () => {
    server.getAdminLinksFn.mockResolvedValue([]);
    renderAt('/help');

    await findFooter();
    expect(await screen.findByRole('complementary', { name: 'Acme Console' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Operations' })).toBeNull();
  });
});

describe('embedded tool page', () => {
  beforeEach(() => {
    localStorage.setItem(SIDEBAR_KEY, 'false');
  });

  it('opens an embed entry inside the panel', async () => {
    const router = renderAt('/help');

    fireEvent.click(await screen.findByRole('link', { name: 'Metrics' }));

    const frame = await screen.findByTitle('Metrics');
    expect(router.state.location.pathname).toBe('/tools/metrics');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', 'https://metrics.example.com/d/1');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(frame).toHaveAttribute('sandbox', SANDBOX);
    expect(server.getToolFrameSrcFn).toHaveBeenCalledWith({ data: { id: 'metrics' } });
    const open = screen.getByRole('link', { name: 'Open in new tab' });
    expect(open).toHaveAttribute('href', 'https://metrics.example.com/d/1');
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('heading', { level: 1, name: 'Metrics' })).toBeInTheDocument();
  });

  it('shows a friendly message for an unknown id', async () => {
    renderAt('/tools/unknown');

    expect(await screen.findByRole('heading', { level: 1, name: 'Tool not found' })).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
    expect(server.getToolFrameSrcFn).not.toHaveBeenCalled();
  });

  it('loads the src the server answers, so a same-origin tool gets its pass', async () => {
    server.getAdminLinksFn.mockResolvedValue([...LINKS, CONSOLE_LINK]);
    server.getToolFrameSrcFn.mockResolvedValue(PASS_SRC_1);
    renderAt('/tools/console');

    const frame = await screen.findByTitle('Console');
    expect(frame).toHaveAttribute('src', PASS_SRC_1);
    expect(frame).toHaveAttribute('sandbox', SANDBOX);
    expect(server.getToolFrameSrcFn).toHaveBeenCalledWith({ data: { id: 'console' } });
    expect(screen.getByRole('link', { name: 'Open in new tab' })).toHaveAttribute('href', '/console/#usage');
  });

  it('shows the loading state until the src arrives', async () => {
    server.getAdminLinksFn.mockResolvedValue([...LINKS, CONSOLE_LINK]);
    let answer: (src: string) => void = () => undefined;
    server.getToolFrameSrcFn.mockReturnValue(new Promise<string>((resolve) => (answer = resolve)));
    renderAt('/tools/console');

    expect(await screen.findByRole('button', { name: 'Reload frame' })).toBeInTheDocument();
    expect(screen.getAllByText('Loading...')).not.toHaveLength(0);
    expect(document.querySelector('iframe')).toBeNull();

    answer(PASS_SRC_1);
    expect(await screen.findByTitle('Console')).toHaveAttribute('src', PASS_SRC_1);
  });

  it('asks for a fresh src, with a fresh pass, on Reload frame', async () => {
    server.getAdminLinksFn.mockResolvedValue([...LINKS, CONSOLE_LINK]);
    server.getToolFrameSrcFn.mockResolvedValueOnce(PASS_SRC_1).mockResolvedValueOnce(PASS_SRC_2);
    renderAt('/tools/console');

    const first = await screen.findByTitle('Console');
    expect(first).toHaveAttribute('src', PASS_SRC_1);

    fireEvent.click(screen.getByRole('button', { name: 'Reload frame' }));

    await waitFor(() => expect(screen.getByTitle('Console')).toHaveAttribute('src', PASS_SRC_2));
    expect(server.getToolFrameSrcFn).toHaveBeenCalledTimes(2);
    expect(first).not.toBeInTheDocument();
  });

  it('reloads the frame on Reload frame even when the src is the same', async () => {
    renderAt('/tools/metrics');

    const first = await screen.findByTitle('Metrics');
    fireEvent.click(screen.getByRole('button', { name: 'Reload frame' }));

    await waitFor(() => expect(server.getToolFrameSrcFn).toHaveBeenCalledTimes(2));
    const second = await screen.findByTitle('Metrics');
    expect(second).not.toBe(first);
    expect(second).toHaveAttribute('src', 'https://metrics.example.com/d/1');
  });

  it('falls back to the plain href when the src request fails', async () => {
    server.getAdminLinksFn.mockResolvedValue([...LINKS, CONSOLE_LINK]);
    server.getToolFrameSrcFn.mockRejectedValue(new Error('offline'));
    renderAt('/tools/console');

    expect(await screen.findByTitle('Console')).toHaveAttribute('src', '/console/#usage');
  });

  it('does not embed tab or text entries', async () => {
    renderAt('/tools/status');

    expect(await screen.findByText('Tool not found')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
