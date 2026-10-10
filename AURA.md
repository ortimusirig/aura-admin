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
| `AURA_TOOLS_PASS_SECRET` | empty         | Shared secret, at least 32 characters, for the signed pass that same-origin embedded tools receive (see below). Unset or shorter: no passes. |

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
  { "id": "console", "label": "Console", "href": "/console/", "mode": "embed", "icon": "console" },
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
- `audience`: optional, a-z, 0-9 and dashes, 1 to 32 characters. The `aud` of the pass a
  same-origin embed receives; default `console`. An invalid value drops the entry; text entries
  ignore it.

At most 12 entries are kept. Invalid entries are dropped one by one, and invalid JSON yields an
empty list. The server log names the problem and the dropped positions, never the value.

### Same-origin paths run with the panel's privileges

An embedded `/path` loads in an iframe whose sandbox allows scripts and same-origin access, and
the page has the panel's own origin. Its script can therefore reach the panel window and call the
panel's server functions with the admin's session; the sandbox gives no isolation there. Use a
same-origin path only for an app you trust as much as the panel itself. Otherwise host the tool on
its own origin and embed it by its https URL.

### The embed frame

The page under `/tools/<id>` shows the label, a "Reload frame" control and an "Open in new tab"
link (always the plain href, never a pass) above the frame. The iframe has
`referrerpolicy="no-referrer"` and exactly this sandbox:

```
allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-top-navigation-by-user-activation
```

`allow-modals` lets the tool use `confirm()` and `prompt()`;
`allow-top-navigation-by-user-activation` lets a link the user clicks (for example a
`target="_top"` link back to the panel) replace the whole page, which also means a tool can send
the admin to another page after a click. Embed only tools you trust.

"Reload frame" asks the server for a new frame address (with a new pass, see below) and loads the
frame again.

### Signed pass for same-origin embeds

With `AURA_TOOLS_PASS_SECRET` set, an `embed` entry whose `href` is a same-origin path (a single
leading `/`) is loaded with `aura_pass=<pass>` added to its query string, before any `#fragment`.
The tool can check the pass and sign the admin in without a second sign-in. Entries on other
origins (`https://`, loopback) never receive a pass, and neither does anyone without a panel
session or without an email in it. Every visit of the page and every "Reload frame" mints a new
pass; the panel never stores or logs passes or the secret. The tool must use the same secret.

The pass (version 1) is `<payload>.<signature>`:

- `payload`: base64url without padding of the UTF-8 JSON
  `{"v":1,"sub":"<admin email, lower case>","aud":"<audience>","iat":<unix seconds>,"exp":<iat + 60>,"jti":"<32 random hex characters>"}`,
  keys in exactly this order and no spaces.
- `signature`: base64url without padding of HMAC-SHA256 over the payload string, keyed with the
  raw 32-byte digest `HMAC-SHA256(secret, "aura-tool-pass-v1")`.

A receiving tool should compare the signature in constant time, require `v` = 1, its own `aud`,
`iat` not more than a few seconds in the future, `now < exp` and `exp - iat` at most 120 seconds,
accept each `jti` only once, check that `sub` is still an administrator, and then redirect to the
same address without `aura_pass` so the pass does not stay in the address bar or the history.
`src/aura/pass.test.ts` holds a fixed test vector (secret, payload, pass) for checking an
implementation.

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
