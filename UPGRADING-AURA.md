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
    versions and sync to it (section 3; "Syncing to an earlier upstream commit" shows how to stop
    at a commit before the tip of upstream `main`). If upstream has not bumped them yet, wait
    before upgrading the LibreChat server, or ask upstream.
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

# 0. The upstream base the published aura is on now (NOTICE names the same commit). Section 4
#    compares against it; the same command gives the same answer until aura is pushed.
OLD=$(git merge-base origin/aura upstream/main)

# 1. Pick the upstream commit to sync to: normally the tip of upstream/main. Check first that its
#    package versions match the LibreChat server that will run next to the panel (section 1).
git show upstream/main:bun.lock | grep -E '^\s+"(librechat-data-provider|@librechat/data-schemas)": \['
TARGET=upstream/main      # or an earlier commit, see "Syncing to an earlier upstream commit"

# 2. Mirror upstream on main (fast-forward only: main has no fork commits)
git switch main
git merge --ff-only "$TARGET"
git push origin main

# 3. Bring the fork's changes onto the new main
git switch aura
git merge main            # recommended for the published branch: no force push
# or, for a linear history (only when every deployed version is tagged, see section 5):
# git rebase main         # later pushed with --force-with-lease, after the checks
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

### Syncing to an earlier upstream commit

If the versions printed in step 1 are newer than the ones the LibreChat server ships, either
upgrade the LibreChat server together with the panel, or stop `main` at the newest upstream
commit before the packages moved past the server:

```bash
git log --oneline "$OLD"..upstream/main -- package.json bun.lock   # commits that change dependencies
git show <commit>:bun.lock | grep -E '^\s+"(librechat-data-provider|@librechat/data-schemas)": \['
TARGET=<first commit that moves them past the server>^       # its parent
```

Then continue with step 2, which fast-forwards `main` to that commit instead of the tip. `main`
stays a fast-forward mirror, and the next sync moves it on. Section 5 tags the release with
`git rev-parse --short=7 main`, so the tag then names that commit.

### Upstream files this fork edits

Generated from `git diff --name-status bb88594..aura` (upstream base bb88594, 2026-10-10). Keep
this list current: when a change touches another upstream file, add it here. Every edited
upstream file that allows comments (not `manifest.json`, `favicon.ico` or the generated
`routeTree.gen.ts`) starts with a one-line
`Modified by Applexus Technologies, <date>: <what> (AGPL-3.0)` comment (README.md as an HTML
comment); keep that line when resolving a conflict and update its text if the edit changes.

| File | Edit | On conflict |
| ---- | ---- | ----------- |
| `.github/workflows/docker-publish.yml` | Deleted (it publishes upstream's images). | Keep it deleted (`git rm`), even if upstream changed it. |
| `Dockerfile` | `ARG AURA_COMMIT` passed to the build as `VITE_AURA_COMMIT` with a warning when unset; OCI labels; runtime image also gets `LICENSE`, `NOTICE`, `src/aura/brand.ts` and `src/aura/links.ts` (imported by `server.ts`). | Take upstream's file, then re-add these lines. Keep upstream's pinned base image. |
| `README.md` | "AURA fork" section prepended at the top. | Take upstream's file and prepend the section again. |
| `public/clickhouse-dark.svg`, `public/clickhouse-light.svg`, `public/librechat-logo.svg`, `src/assets/librechat.svg` | Deleted (third-party logos; ClickHouse trademark policy for modified versions). | Keep them deleted. If upstream references them in new code, point that code at `publicUrl('logo.svg')` from `@/aura`. |
| `public/favicon.ico` | Replaced by a neutral icon. | Keep ours. |
| `public/manifest.json` | Neutral names ("Admin", "Admin Panel"), corrected favicon sizes, touch icon entry. | Take upstream's other changes, keep the names and icons. |
| `server.ts` | Brand overlay for `favicon.ico`, `apple-touch-icon.png`, `logo.svg`, `manifest.json` from `AURA_BRAND_DIR` (`resolveStaticFile` in `buildStaticRoutes`); `frame-src` for embedded tools appended to the CSP (`cspFrameSrc`). | Re-apply the three imports (type `BunFile`, the brand helpers, `cspFrameSrc`), `BRAND_DIR`, `resolveStaticFile`, its call in the static route loop and the `cspFrameSrc` line in `CSP_VALUE`. |
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

To finish a conflicted merge: `git diff --name-only --diff-filter=U` lists the files still in
conflict. After resolving each one, run `git add <file>` (for the files the fork deletes,
`git rm <file>`), then `git merge --continue` (after a rebase: `git rebase --continue`).

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

Run all of these before pushing `aura`. The commands use `OLD` from section 3 (recompute it the
same way in a new shell) and the new upstream base:

```bash
NEW=$(git rev-parse main)
```

1. **Package versions still match the server**: repeat the section 1 comparison with the new
   `bun.lock` and the LibreChat release that will run next to this panel:

   ```bash
   grep -E '^\s+"(librechat-data-provider|@librechat/data-schemas)": \[' bun.lock
   ```

   If the panel is ahead of the server, do not release it: upgrade the LibreChat server first, or
   redo section 3 with an earlier `TARGET` (`git reset --hard origin/aura` on `aura` and
   `git reset --hard <earlier target>` on `main`; `main` then needs
   `git push --force-with-lease origin main`, which is harmless because it carries no fork
   commits).

2. **The gate**, the same checks the CI runs (`.github/workflows/aura-ci.yml`):

   ```bash
   bun install --frozen-lockfile
   bunx eslint src/ --max-warnings 0
   bunx tsc --noEmit
   NODE_ENV=development SESSION_SECRET=ci-test-secret-do-not-use-in-production \
     node node_modules/vitest/vitest.mjs run     # tests run under Node, as in CI
   ```

   Upstream's new tests must pass as well as the fork's.

   The gate does not build the app or the image. The AURA CI's "Build and Image" job does (Vite
   build, Docker build, smoke test), and it runs only on a push to `aura` or on a pull request
   into `aura`. So push the merged branch under a sync name and open a pull request into `aura`
   on the fork:

   ```bash
   SYNC=sync-$(git rev-parse --short=7 main)
   git push origin "aura:$SYNC"
   gh pr create --repo ortimusirig/aura-admin --base aura --head "$SYNC" \
     --title "Sync upstream $(git rev-parse --short=7 main)" --body "Upstream sync, see UPGRADING-AURA.md"
   ```

   On the GitHub website, choose `ortimusirig/aura-admin` as the base repository: for a fork,
   GitHub proposes the upstream repository as the base, and the pull request must not go there.
   Push `aura` only after every job of that pull request, Build and Image included, is green
   (`git push origin aura`, or `git push --force-with-lease origin aura` after a rebase; GitHub
   then marks the pull request merged).

3. **No third-party logos came back:**

   ```bash
   git ls-files | grep -Ei '(librechat|clickhouse)[^/]*\.(svg|png|ico|jpe?g|webp|gif)$'
   grep -rnE 'librechat-logo|clickhouse-(dark|light)|assets/librechat\.svg' src public server.ts
   git diff --name-only --diff-filter=A "$OLD" "$NEW" | grep -Ei '\.(svg|png|ico|jpe?g|webp|gif)$'
   ```

   The first two must print nothing. Open every image the third one lists: a new LibreChat,
   ClickHouse or other third-party logo, under any name, must be deleted as well (point code that
   uses it at `publicUrl('logo.svg')` from `@/aura`). Logos inside `node_modules` libraries are
   not ours to remove.

4. **Legal footer**: run the panel and check that the login page, a 404 page (any unknown path)
   and an app page (for example Help) each show the footer once, and that its Source link points
   to `https://github.com/ortimusirig/aura-admin/tree/<commit>`. The Help page still has the
   "About and license" card.

5. **Tools section**: with an `AURA_ADMIN_LINKS` value that has one entry of each mode
   (`embed`, `tab`, `text`), signed in as an admin: the embed entry opens under `/tools/<id>`
   inside the panel, the tab entry opens a new tab, the text entry shows its note; collapsed and
   expanded sidebar both work.

6. **Tool pass still accepted**: the pass format is versioned. `src/aura/pass.ts` must still say
   `PASS_VERSION = 1`, and the fixed test vector in `src/aura/pass.test.ts` must pass unchanged.
   With `AURA_TOOLS_PASS_SECRET` set, open a same-origin embedded tool and confirm that it signs
   the admin in without a second sign-in, and that "Reload frame" works. If upstream changed the
   session (for example the `user.email` field the pass subject comes from), fix that before
   releasing.

7. **Branding**: `AURA_BRAND_NAME` shows in the title, login card, sidebar and footer; a file in
   `AURA_BRAND_DIR` (for example `logo.svg`) is served instead of the bundled one. New upstream
   English strings must not name the product:

   ```bash
   grep -n 'LibreChat Admin' src/locales/en/translation.json
   git diff "$OLD" "$NEW" -- src/locales/en/translation.json | grep -E '^\+' \
     | grep -iE 'admin panel|librechat admin'
   ```

   Every key either command prints that names the product (rather than the LibreChat server)
   needs an entry in `src/aura/en.json` with `{{brand}}` in place of the name.

8. **Upstream settings**: `ADMIN_SSO_ONLY=true` still hides the email and password form, and
   `API_SERVER_URL` is still used for the server-side LibreChat calls (sign-in works when the
   panel reaches LibreChat on a different address than the browser).

9. **No new upstream settings to set**: compare the old and the new upstream base.

   ```bash
   git diff "$OLD" "$NEW" -- README.md .env.example
   git diff "$OLD" "$NEW" -- server.ts src | grep -E '^\+' \
     | grep -oE '(process\.env|import\.meta\.env|env)\.[A-Z0-9_]+' | sort -u
   ```

   Any new name that a deployment needs must be set by the operator before the new version goes
   live. Record the new upstream base in NOTICE (section 5).

## 5. Release

1. **NOTICE**: update "Based on upstream commit ..." to the new upstream base and add a dated
   entry to the change list for any change to the fork itself. Copy it to the served file:
   `cp NOTICE public/NOTICE.txt` (a test checks they are identical). Commit it on `aura`, best
   before opening the sync pull request of section 4 so that its checks cover it, and push `aura`
   once they are green.
2. **Tag** the release commit and push the tag:

   ```bash
   UP=$(git rev-parse --short=7 main)          # the upstream base
   git tag -a "aura-$UP-1" -m "AURA Admin on upstream $UP"   # -2, -3 ... for later releases on the same base
   git push origin "aura-$UP-1"
   ```

   Tags are never deleted or moved: each deployed version's source must stay available (AGPL-3.0
   section 13; the footer's Source link points at the commit).
3. **Build** the image from a fresh clone of the pushed tag, with the full commit:

   ```bash
   git clone --depth 1 --branch "aura-$UP-1" https://github.com/ortimusirig/aura-admin.git "aura-admin-$UP-1"
   cd "aura-admin-$UP-1"
   docker build --build-arg AURA_COMMIT=$(git rev-parse HEAD) -t <registry>/aura-admin:"aura-$UP-1" .
   docker push <registry>/aura-admin:"aura-$UP-1"
   ```

   The fresh clone holds exactly the tagged files and proves the tag is public. A working copy
   would put any uncommitted or untracked file into the image (`COPY . .`), so the running code
   would differ from the commit its Source link names. If the deployment serves the panel under a
   sub-path, add the same `--build-arg VITE_BASE_PATH=<path>` as the previous build: the
   Dockerfile bakes it into the client at build time, and it must match the deployment's runtime
   `VITE_BASE_PATH`.

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
