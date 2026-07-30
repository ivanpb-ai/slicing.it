# Presentation Studio

A browser-based presentation editor: compose animated, interactive decks with
drag-and-drop blocks, live canvas backgrounds and editable charts — then
present in the browser or export to a single HTML file or a native PowerPoint
(.pptx).

No accounts, no backend required: presentations are plain JSON in
`localStorage`, and everything runs client-side. Optional Netlify functions
add cross-device sync, a password gate and AI-enriched exports.

## Features

- **16+ block types** — headings (with gradient fills), text, kickers, quotes,
  counters, buttons, lists, cards, icons, images, shapes, progress rings,
  orbit/radar/loop visuals, and the full PowerPoint chart family (column, bar,
  line, area, combo, pie, doughnut, radar, bubble, waterfall) with an editable
  data table.
- **Motion** — 12 entrance effects, idle loops (float, pulse, shimmer, …),
  per-slide transitions, and 14 live backgrounds (nebula, starfield, waves,
  circuit, world-map camera tours, …).
- **Editor comforts** — drag/resize with snap guides, inline text editing,
  undo/redo, keyboard nudging, slide statuses (draft/review/final), and a
  ✓ Review linter (text fit, projector-size fonts, contrast, density, alt
  text, off-palette colours).
- **Multi-deck library** — autosaved locally; syncs across devices when the
  optional decks function + password are configured.
- **Exports**
  - **HTML presentation** — one self-contained file with the full player
    (animations, backgrounds, navigation). Host it anywhere or open from disk.
  - **PowerPoint (.pptx)** — native text runs, shapes, images and *editable*
    native charts.
  - **Interactive pages** — one standalone click-to-explain HTML page per
    slide, optionally enriched with one-sentence descriptions from the
    Perplexity API. Pages re-import into the editor.
  - **Studio JSON** — the editable source format.

## Run it

```bash
npm install
npm start          # dev server at http://localhost:1234
npm run build      # static build in dist/
```

The editor itself is a static site — deploy `dist/` anywhere. The optional
server features below assume Netlify (functions + edge functions), but the
editor degrades gracefully without them: sync shows "this device" and the
Perplexity option simply reports the API as unavailable.

## Optional server features (Netlify)

Deploy the repo to Netlify (build command and functions are configured in
`netlify.toml`) and set environment variables as needed:

### User accounts — pick one mode

**Netlify Identity (recommended for open registration).** Enable Identity in
the Netlify UI (Site configuration → Identity → Enable). You get open
self-registration, password-reset emails, email confirmation and as many
users as you need, with no code or env vars — the app detects Identity
automatically. Visitors see a sign-in gate; the Identity widget handles
sign-up/sign-in/recovery; each account's presentations are private (an
isolated per-user namespace in Netlify Blobs, plus per-user browser storage).
In the Identity settings you can switch registration between *Open* and
*Invite only*, require email confirmation, and add external providers
(Google, GitHub, …) — the widget picks these up automatically. Leave
`EDITOR_USERS`/`EDITOR_PASSWORD` unset in this mode.

Set `ADMIN_EMAILS` (comma-separated, e.g. `you@example.com,cto@example.com`)
to grant **admin rights** to specific Identity accounts: those users get the
Decks → **★ Set as welcome deck** action, which publishes the deck they are
editing as the default deck every new user starts with. Everyone else can
read the welcome deck (their first library is seeded from it) but never
change it. Admins' own decks stay in their ordinary private namespace.

**Env-var accounts (small fixed team).**

| Variable | Effect |
| --- | --- |
| `EDITOR_USERS` | Comma-separated `username:password` pairs, e.g. `alice:s3cret,bob:hunter2`. Each user signs in with their own credentials and sees/edits only their own presentations. Usernames: letters, digits, `_`, `-`, max 32 chars (`admin` and `default` are reserved). Sign out via the Decks menu or any URL with `?signout=1`. |
| `EDITOR_PASSWORD` | The **admin** credential: username `admin` signs in with it — alongside `EDITOR_USERS`, or via a password-only form when `EDITOR_USERS` is unset. Regular users cannot use it. |

**Open.** With Identity disabled and neither variable set, the editor is
public and decks stay device-local.

In every mode, decks created on a browser before accounts were enabled are
adopted by the first user who signs in there.

### Other environment variables

| Variable | Effect |
| --- | --- |
| `PERPLEXITY_API_KEY` | Enables the AI enrichment in the "Interactive pages" export and the live-explanation toggle on generated pages. Get a key at <https://www.perplexity.ai/settings/api>. |
| `PERPLEXITY_MODEL` | Perplexity model for the proxy (default `sonar`). |

> **Note:** the Perplexity proxy (`/api/perplexity`) is CORS-open by design so
> downloaded pages keep working from anywhere — anyone who can reach your site
> can spend against your key. See `netlify/functions/perplexity.mjs` to
> restrict it.

## Make it yours

- **Colours** — edit `src/js/palette.js`. Swatches, gradient presets and the
  Review linter's palette check all follow it. The remaining fixed chrome
  tints live in `src/js/studio/app.jsx` (`STUDIO_CSS`).
- **Fonts** — add `@font-face` rules in `src/index.html` (and, for exported
  decks, `FONT_CSS` in `src/js/studio/export-html.js`), then put your family
  names first in `FONTS` in `src/js/studio/model.js`.
- **Starter deck** — `starterDeck()` in `src/js/studio/model.js` is what new
  users see first.

## Layout

```
src/
  index.html              editor entry page
  js/studio-entry.jsx     React mount point
  js/palette.js           theme palette (edit me)
  js/studio/              the editor
    model.js              data model, factories, persistence, starter deck
    app.jsx               editor shell: state, undo/redo, present mode, chrome CSS
    stage.jsx             canvas: selection, drag/resize, inline editing
    blocks.jsx            block renderers
    backgrounds.jsx       animated slide backgrounds
    effects.js            entrance/idle animation engine
    chart-svg.js          shared SVG chart renderer
    worldmap.js           dotted world-map background
    panels.jsx            toolbar, navigator, inspector
    lint.js               ✓ Review checks
    cloud.js              optional cross-device sync client
    export-html.js        single-file HTML presentation export
    export-pptx.js        native PowerPoint export
    generate-pages.js     click-to-explain interactive pages export
    canvas-interop.js     HTML canvas format bridge (export/import round-trip)
netlify/
  edge-functions/editor-auth.js   optional password gate
  functions/decks.mjs             optional deck sync (Netlify Blobs)
  functions/perplexity.mjs        optional Perplexity proxy
```

## License

MIT
