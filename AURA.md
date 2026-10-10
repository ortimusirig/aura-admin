# AURA Admin: operator notes

AURA Admin is a modified LibreChat Admin Panel (AGPL-3.0; see NOTICE). Everything site-specific
is a runtime setting, so one image can serve several tenants. The upstream settings in
`.env.example` still apply; this file covers the settings this fork adds.

## Settings

| Variable                 | Default       | Meaning                                                                                                                                 |
| ------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `AURA_BRAND_NAME`        | `Admin Panel` | Product name in the document title, login card, sidebar and legal footer.                                                               |
| `AURA_BRAND_DIR`         | `/brand`      | Folder whose `favicon.ico`, `apple-touch-icon.png`, `logo.svg` and `manifest.json` replace the bundled files. Only these four; read at startup. |
| `AURA_ADMIN_LINKS`       | empty         | Admin tools in the sidebar (JSON array, see below), shown to signed-in admins only.                                                     |
| `AURA_ADMIN_LINKS_TITLE` | `Tools`       | Heading of the tools section.                                                                                                           |

Names and files supplied through AURA_BRAND_NAME or AURA_BRAND_DIR are subject to the additional
term under AGPL-3.0 section 7(e) in NOTICE.

Brand files are served from the panel's own origin with a five-minute cache,
`X-Content-Type-Options: nosniff` and a sandboxing Content-Security-Policy, so script inside a
supplied SVG does not run when someone opens the file directly. Still, only put files there that
you trust.

## AURA_ADMIN_LINKS

```json
[
  { "id": "metrics", "label": "Metrics", "href": "https://metrics.example.com/", "mode": "embed", "icon": "metrics" },
  { "id": "status", "label": "Status", "href": "https://status.example.com/", "mode": "tab" },
  { "id": "oncall", "label": "On call", "mode": "text", "note": "See the team rota" }
]
```

- `id`: a-z, 0-9 and dashes, 1 to 32 characters, unique (later duplicates are dropped).
- `label`: 1 to 40 characters.
- `href`: an `https://` URL, an `http://localhost` or `http://127.0.0.1` URL (any port), or a
  same-origin path that starts with a single `/`. Hosts must be DNS names or IP addresses (no
  `*`, `;`, `,` or `_`). Anything else is dropped. `text` entries need no href.
- `mode`: `embed` (shown inside the panel under `/tools/<id>`), `tab` (opens in a new tab) or
  `text` (no link, shows the note). Default `tab`.
- `icon`: optional Click UI icon name from the allowlist in `src/aura/links.ts`; any other value
  shows a default icon.
- `note`: optional, up to 80 characters.

At most 12 entries are kept. Invalid entries are dropped one by one, and invalid JSON yields an
empty list. The server log names the problem and the dropped positions, never the value.

### Same-origin paths run with the panel's privileges

An embedded `/path` loads in an iframe whose sandbox allows scripts and same-origin access, and
the page has the panel's own origin. Its script can therefore reach the panel window and call the
panel's server functions with the admin's session; the sandbox gives no isolation there. Use a
same-origin path only for an app you trust as much as the panel itself. Otherwise host the tool on
its own origin and embed it by its https URL.

### Embeds and the Content-Security-Policy

The panel sends its Content-Security-Policy (report-only unless `ADMIN_PANEL_CSP_ENFORCE=true`) on
every page, also before sign-in. Its `frame-src` therefore admits embeds by source kind, never by
host: `'self'`, plus `https:`, `http://localhost:*` or `http://127.0.0.1:*` as the configured
embeds need. The embedded tool must itself allow being framed by the panel (through its own
`X-Frame-Options` or `frame-ancestors`).

## Building and deploying the image

The Source link in the legal footer (AGPL-3.0 section 13) points to the commit the image was
built from. To keep it exact:

1. Push the commit to the public fork, https://github.com/ortimusirig/aura-admin, so that
   `tree/<commit>` resolves.
2. Build the image with that commit:

   ```bash
   docker build --build-arg AURA_COMMIT=$(git rev-parse HEAD) -t aura-admin .
   ```

   Without `AURA_COMMIT` the build prints a warning and the link falls back to the moving `aura`
   branch.

3. Run it as the upstream README describes and add the settings above, for example:

   ```bash
   docker run -p 3000:3000 \
     -e SESSION_SECRET=your-secret-here-at-least-32-characters \
     -e AURA_BRAND_NAME="Acme Admin" \
     -v /srv/acme-brand:/brand:ro \
     aura-admin
   ```
