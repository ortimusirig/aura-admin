# Upgrading AURA Admin to a new upstream release

AURA Admin is the `aura` branch of https://github.com/ortimusirig/aura-admin, a fork of the
LibreChat Admin Panel (https://github.com/LibreChat-AI/admin-panel). This guide lets someone who
did not build the fork pull in a new upstream release safely. It refers to whoever runs the panel
as "the operator" and to settings by their environment names; see AURA.md for what each AURA
setting does and NOTICE for the license terms.

Branches and remotes used below:

- `origin`: the fork, https://github.com/ortimusirig/aura-admin.
- `upstream`: the official panel, https://github.com/LibreChat-AI/admin-panel.
- `main`: an untouched mirror of `upstream/main`. Never commit to it.
- `aura`: `main` plus the fork's changes. Images are built from tags on this branch.

## 1. When to upgrade

- **On every LibreChat server upgrade.** The panel talks to LibreChat's admin API and imports its
  schema and config types, so the panel's `librechat-data-provider` and
  `@librechat/data-schemas` versions must match the ones the LibreChat server release ships.
  - LibreChat side: in the LibreChat release you deploy (its git tag, or inside the running
    container under `/app`), read the `version` field of
    `packages/data-provider/package.json` (that is `librechat-data-provider`) and of
    `packages/data-schemas/package.json` (that is `@librechat/data-schemas`). For example:
    `docker exec <librechat container> node -p "require('/app/packages/data-provider/package.json').version"`.
  - Panel side: the resolved versions are in `bun.lock`:
    `grep -E '^\s+"(librechat-data-provider|@librechat/data-schemas)": \[' bun.lock`
    (the version follows the `@` in the first array element; `package.json` holds the ranges).
  - If they differ, look for an upstream panel commit or release that bumps them to the server's
    versions and upgrade to it. If upstream has not bumped them yet, wait before upgrading the
    LibreChat server, or ask upstream.
- **On upstream security or data-loss fixes.** Upstream marks these in commit titles and
  release notes (for example "fix: ... Data Loss", security advisories under the repository's
  Security tab). Upgrade promptly.
- **Monthly**, take a look at upstream `main` and its releases even when nothing forces an
  upgrade, so the fork never drifts far. To be told about releases, open the upstream repository
  on GitHub, choose Watch, then Custom, tick Releases (and Security alerts) and apply. Feeds also
  work: https://github.com/LibreChat-AI/admin-panel/releases.atom and
  https://github.com/LibreChat-AI/admin-panel/commits/main.atom.

## 2. One-time setup

```bash
git clone https://github.com/ortimusirig/aura-admin.git
cd aura-admin
git remote add upstream https://github.com/LibreChat-AI/admin-panel.git
git fetch upstream --tags
```

## 3. Sync steps

```bash
git fetch upstream
git fetch origin

# 1. Mirror upstream on main (fast-forward only: main has no fork commits)
git switch main
git merge --ff-only upstream/main
git push origin main

# 2. Bring the fork's changes onto the new main
git switch aura
git merge main            # recommended for the published branch: no force push
# or, for a linear history (only when every deployed version is tagged, see section 5):
# git rebase main && git push --force-with-lease origin aura
```

Prefer the merge: `aura` is public, and each deployed image links to its source commit. A rebase
rewrites the branch; the release tags keep old commits reachable, but anyone who cloned `aura`
must reset. Resolve conflicts with the table below, then run the checks in section 4 before
pushing `aura`.

To see the fork's edits against the upstream commit it is based on:

```bash
BASE=$(git merge-base main aura)
git diff --stat "$BASE"..aura
git diff --name-status "$BASE"..aura     # D deleted, M modified, A added (ours)
```

### Upstream files this fork edits

Generated from `git diff --name-status bb88594..aura` (upstream base bb88594, 2026-10-10). Keep
this list current: when a change touches another upstream file, add it here. Every edited source
file starts with a one-line `Modified by Applexus Technologies, <date>: <what> (AGPL-3.0)` comment
(README.md as an HTML comment); keep that line when resolving a conflict and update its text if
the edit changes.

| File | Edit | On conflict |
| ---- | ---- | ----------- |
| `.github/workflows/docker-publish.yml` | Deleted (it publishes upstream's images). | Keep it deleted (`git rm`), even if upstream changed it. |
| `Dockerfile` | `ARG AURA_COMMIT` passed to the build as `VITE_AURA_COMMIT` with a warning when unset; OCI labels; runtime image also gets `LICENSE`, `NOTICE`, `src/aura/brand.ts` and `src/aura/links.ts` (imported by `server.ts`). | Take upstream's file, then re-add these lines. Keep upstream's pinned base image. |
| `README.md` | "AURA fork" section prepended at the top. | Take upstream's file and prepend the section again. |
| `public/clickhouse-dark.svg`, `public/clickhouse-light.svg`, `public/librechat-logo.svg`, `src/assets/librechat.svg` | Deleted (third-party logos; ClickHouse trademark policy for modified versions). | Keep them deleted. If upstream references them in new code, point that code at `publicUrl('logo.svg')` from `@/aura`. |
| `public/favicon.ico` | Replaced by a neutral icon. | Keep ours. |
| `public/manifest.json` | Neutral names ("Admin", "Admin Panel"), corrected favicon sizes, touch icon entry. | Take upstream's other changes, keep the names and icons. |
| `server.ts` | Brand overlay for `favicon.ico`, `apple-touch-icon.png`, `logo.svg`, `manifest.json` from `AURA_BRAND_DIR` (`resolveStaticFile` in `buildStaticRoutes`); `frame-src` for embedded tools appended to the CSP (`cspFrameSrc`). | Re-apply the two imports, `BRAND_DIR`, `resolveStaticFile`, its call in the static route loop and the `cspFrameSrc` line in `CSP_VALUE`. |
| `src/components/Sidebar.tsx` | Logo from `publicUrl('logo.svg')` instead of the bundled LibreChat logo; `<Tools collapsed={collapsed} />` below the nav items; `h-full` instead of `h-screen`. | Keep upstream's nav changes, re-add the three edits. |
| `src/components/help/HelpPage.tsx` | `<About />` card ("About and license"). | Re-add the import and the card. |
| `src/locales/i18n.ts` | English overlay `src/aura/en.json` merged over the English translation; `{{brand}}` default variable. | Re-apply both lines. If upstream renamed `com_auth_title`, `com_a11y_admin_panel` or `com_a11y_logo_alt`, rename them in `src/aura/en.json` too. |
| `src/routeTree.gen.ts` | Generated: adds the `/_app/tools/$id` route. | Take upstream's file and regenerate it (`bun run dev` or `bun run build` rewrites it), then check that `/tools/$id` is in it. |
| `src/routes/__root.tsx` | Root loader `loadSettings` (runtime brand), title from the brand, touch icon and manifest links, legal footer `Shell` around the outlet and the pending and error pages; `flex-1` instead of `min-h-screen`. | Re-apply; keep upstream's head and layout changes. |
| `src/routes/_app.tsx` | Layout fills the root shell (`min-h-0 flex-1` instead of `h-screen`; `flex-1` on the error and not-found pages). | Re-apply the class changes. |
| `src/routes/auth/openid/callback.tsx`, `src/routes/login.tsx` | Page fills the shell above the legal footer (`flex-1` instead of a full viewport height). | Re-apply the class or style change. |
| `src/server/index.ts` | `export * from './aura';` | Re-add the line. |
| `src/server/metrics.test.ts` | Static asset example `/logo.svg` instead of a removed logo. | Re-apply. |
| `src/types/index.ts` | `export type * from './aura';` | Re-add the line. |

### Files that are ours only

These never conflict; upstream does not have them. Keep them as they are:

- `src/aura/*` (components, pure helpers, their tests, `en.json`)
- `src/server/aura.ts` and `src/server/aura.test.ts`
- `src/types/aura.ts`
- `src/routes/_app/tools/$id.tsx`
- `NOTICE`, `AURA.md`, `UPGRADING-AURA.md`
- `public/LICENSE.txt`, `public/NOTICE.txt`, `public/logo.svg`, `public/apple-touch-icon.png`
- `.github/workflows/aura-ci.yml`

## 4. Checks after the sync

Run all of these before pushing `aura`.

1. **The gate**, the same checks the CI runs (`.github/workflows/aura-ci.yml`):

   ```bash
   bun install --frozen-lockfile
   bunx eslint src/ --max-warnings 0
   bunx tsc --noEmit
   NODE_ENV=development SESSION_SECRET=ci-test-secret-do-not-use-in-production \
     node node_modules/vitest/vitest.mjs run     # tests run under Node, as in CI
   ```

   Upstream's new tests must pass as well as the fork's. Then push to a branch and let the AURA CI
   build the app and the image.

2. **No third-party logos came back:**

   ```bash
   git ls-files | grep -Ei 'librechat-logo|clickhouse-(dark|light)|assets/librechat\.svg'
   grep -rnE 'librechat-logo|clickhouse-(dark|light)|assets/librechat\.svg' src public server.ts
   ```

   Both must print nothing. (Logos inside `node_modules` libraries are not ours to remove.)

3. **Legal footer**: run the panel and check that the login page, a 404 page (any unknown path)
   and an app page (for example Help) each show the footer once, and that its Source link points
   to `https://github.com/ortimusirig/aura-admin/tree/<commit>`. The Help page still has the
   "About and license" card.

4. **Tools section**: with an `AURA_ADMIN_LINKS` value that has one entry of each mode
   (`embed`, `tab`, `text`), signed in as an admin: the embed entry opens under `/tools/<id>`
   inside the panel, the tab entry opens a new tab, the text entry shows its note; collapsed and
   expanded sidebar both work.

5. **Tool pass still accepted**: the pass format is versioned. `src/aura/pass.ts` must still say
   `PASS_VERSION = 1`, and the fixed test vector in `src/aura/pass.test.ts` must pass unchanged.
   With `AURA_TOOLS_PASS_SECRET` set, open a same-origin embedded tool and confirm that it signs
   the admin in without a second sign-in, and that "Reload frame" works. If upstream changed the
   session (for example the `user.email` field the pass subject comes from), fix that before
   releasing.

6. **Branding**: `AURA_BRAND_NAME` shows in the title, login card, sidebar and footer; a file in
   `AURA_BRAND_DIR` (for example `logo.svg`) is served instead of the bundled one.

7. **Upstream settings**: `ADMIN_SSO_ONLY=true` still hides the email and password form, and
   `API_SERVER_URL` is still used for the server-side LibreChat calls (sign-in works when the
   panel reaches LibreChat on a different address than the browser).

8. **No new upstream settings to set**: compare the old and the new upstream base.

   ```bash
   OLD=<previous upstream base>; NEW=$(git rev-parse main)
   git diff "$OLD" "$NEW" -- README.md .env.example
   git diff "$OLD" "$NEW" -- server.ts src | grep -E '^\+' \
     | grep -oE '(process\.env|import\.meta\.env|env)\.[A-Z0-9_]+' | sort -u
   ```

   Any new name that a deployment needs must be set by the operator before the new version goes
   live. Record the new upstream base in NOTICE (section 5).

## 5. Release

1. **NOTICE**: update "Based on upstream commit ..." to the new upstream base and add a dated
   entry to the change list for any change to the fork itself. Copy it to the served file:
   `cp NOTICE public/NOTICE.txt` (a test checks they are identical). Commit and push `aura`.
2. **Tag** the release commit and push the tag:

   ```bash
   UP=$(git rev-parse --short=7 main)          # the upstream base
   git tag -a "aura-$UP-1" -m "AURA Admin on upstream $UP"   # -2, -3 ... for later releases on the same base
   git push origin "aura-$UP-1"
   ```

   Tags are never deleted or moved: each deployed version's source must stay available (AGPL-3.0
   section 13; the footer's Source link points at the commit).
3. **Build** the image from the tag, in a clean checkout, with the full commit:

   ```bash
   git switch --detach "aura-$UP-1"
   docker build --build-arg AURA_COMMIT=$(git rev-parse HEAD) -t <registry>/aura-admin:"aura-$UP-1" .
   docker push <registry>/aura-admin:"aura-$UP-1"
   ```

4. **Deploy by digest**, not by tag, so the running image is exactly the one that was checked:
   read the digest with
   `docker inspect --format '{{index .RepoDigests 0}}' <registry>/aura-admin:"aura-$UP-1"` and use
   `image: <registry>/aura-admin@sha256:<digest>` in the deployment. Write down the digest that
   was running before; it is the rollback target.

## 6. Rollback

Redeploy the previous digest. Nothing to migrate: the panel holds no data of its own (sessions
are cookies, settings are environment variables, and configuration edits live in LibreChat's
database). Keep `SESSION_SECRET` and `AURA_TOOLS_PASS_SECRET` unchanged so signed-in admins and
embedded tools keep working.

## 7. Watch list

Upstream areas most likely to break the fork; read their diffs first on every sync:

- **Auth and session helpers**: `src/server/auth.ts` (`verifyAdminTokenFn`, the `_app` guard),
  `src/server/session.ts` (`useAppSession`), `SessionData` in `src/types/server.ts`. The tools
  list and the tool pass rely on the same session check and on `user.email`.
- **Server function patterns**: `createServerFn`, `inputValidator`, `createServerOnlyFn` from
  `@tanstack/react-start`, and how upstream's tests mock them (`src/server/aura.test.ts` mocks
  them the same way).
- **Sidebar and nav types**: `src/components/Sidebar.tsx`, `NavItem` and `SidebarProps` in
  `src/types/layout.ts`.
- **`__root` head and layout**: `src/routes/__root.tsx` (loader, `head`, shell, pending, error and
  not-found components) and full-height classes in pages.
- **i18n setup**: `src/locales/i18n.ts` and the English keys overlaid by `src/aura/en.json`.
- **`server.ts` static routes and CSP**: `buildStaticRoutes`, cache headers, `CSP_VALUE`
  (`frame-src`, `frame-ancestors`), and anything new `server.ts` imports from `src/` (the
  Dockerfile copies only the files `server.ts` needs into the runtime image).
- **Environment names**: renamed or new settings in README.md, `.env.example` and `server.ts`.

## 8. Option: shrink the fork upstream

Most of the fork is runtime branding: product name, logo URL, a folder of brand files and extra
sidebar links. Proposing env-driven branding upstream (for example `ADMIN_PANEL_BRAND_NAME`,
`ADMIN_PANEL_LOGO_URL` and a links setting like `AURA_ADMIN_LINKS`) as a pull request to
https://github.com/LibreChat-AI/admin-panel would remove most of the edited files above from the
fork. The legal notices (NOTICE, footer, Source link) must stay as long as the fork is modified.
