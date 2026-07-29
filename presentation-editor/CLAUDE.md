# Repository notes for Claude

## Presentation Studio: two synced codebases

This generic editor was extracted from the Telia-branded studio that lives in
`github.com/ivanpb-ai/slicing.it` under `src/js/studio/`. The two codebases
share the same architecture file-for-file.

**Sync policy (user requirement): every change merged into one of these
codebases must also be ported to the other, unless it concerns
Telia-specific aspects that should stay in the Telia editor only (or
generic-only infrastructure listed below).** When making a change in one,
apply the equivalent change to the other in the same piece of work and say
so in the commit/PR; if a change is intentionally not ported, state why.

### Intentionally different — do NOT sync these

Generic-only (stays in this repo):
- Neutral palette (`src/js/palette.js`) / system font stack ("Studio
  Display" heading marker)
- `src/js/studio/auth.js` + Netlify Identity (open self-registration,
  JWT-validated decks API); open access when nothing is configured;
  `EDITOR_PASSWORD` here stores admin's decks under the legacy
  "default" namespace
- Self-hosted Perplexity proxy (`netlify/functions/perplexity.mjs`;
  `generate-pages.js` here has two modes: none/perplexity)
- Generic starter deck, README/netlify.toml docs

Telia-only (stays in slicing.it):
- Telia palette values and Telia Sans fonts
- NorthStar site-copy overlay (`copy.js` editor) and its Decks-menu entry
- Slide Converter hand-over (`takeTransferredSlides`) and converter wording
- NorthStar/Perplexity API endpoints on `northstar-program.com`
  (its `generate-pages.js` has three modes: none/northstar/generic)
- Auth specifics: `ns_editor_auth`/`ns_editor_user` cookie names, the
  NorthStar pepper, the gate also covering the other protected site pages,
  locked (503) when unconfigured; `EDITOR_PASSWORD` is the admin
  credential and admin owns the legacy unnamespaced blob/local keys
  (without EDITOR_USERS the legacy plain-hash cookie format is kept); the
  Decks-menu Sign out row is always shown (the gated page implies a
  signed-in visitor)
- NorthStar-themed starter deck and element seed content

Synced in BOTH since 2026-07: the `EDITOR_USERS` multi-user cookie gate
(comma-separated `user:password` pairs; per-user Netlify Blobs namespaces
`user:<name>:`; per-user localStorage scope via the readable user cookie;
"Signed in as … / Sign out" row in the Decks menu; `EDITOR_PASSWORD` as
the reserved `admin` account's credential — usable alongside EDITOR_USERS,
never by regular users, with "admin" ignored in EDITOR_USERS). Auth changes
must be ported to both, translating the cookie/pepper names (`studio_auth`/
`studio_user` + studio pepper here ↔ the ns_ names + NorthStar pepper).

### Porting mechanics

Files correspond one-to-one (`src/js/studio/*` ↔ Telia `src/js/studio/*`,
`src/js/palette.js` ↔ same). When porting visual changes, translate colours:
the bright accents (cyan `#00D4FF`, electric, gold, green, red, orange) are
identical in both; the generic base maps to the Telia base as

| Generic | Telia | | Generic | Telia |
| --- | --- | --- | --- | --- |
| `#0B1026` deep | `#29003E` | | `#0A0F22` chrome bg | `#160427` |
| `#161D38` dark | `#3D1556` | | `#171F3A` menus | `#22093b` |
| `#1C2547` card | `#4A1969` | | `#7D6EF5` hover | `#b01ff5` |
| `#6C5CE7` purple | `#990AE3` | | `rgba(233,236,255,…)` text tints | `rgba(244,224,255,…)` |
| `#E9ECFF` light | `#F4E0FF` | | `rgba(108,92,231,…)` purple tints | `rgba(153,10,227,…)` |
| `#E15FD5` magenta | `#C23FE3` | | `rgba(12,17,36,…)` bars | `rgba(20,5,40,…)` |
| `#0FA396` teal | `#00827C` | | | |

Fonts: `'Studio Display', system-ui` ↔ `'Telia Sans Heading', 'Telia Sans'`
(head), `system-ui` ↔ `'Telia Sans'` (body); mono is identical. Wording:
"theme palette" ↔ "Telia palette"; generic phrasing ↔ NorthStar /
Slide-Converter references.

The pptx exporter differs deliberately: Telia maps heading runs to the GDI
name "Telia Sans Heading Heading"; generic omits fontFace for theme fonts.
Both pass user-picked families (from the font picker) through unchanged.

### Verifying a synced change

- This repo: `npm install && npm run build` (Parcel), open `dist/index.html`.
- Telia studio: `npm run build` at the slicing.it root, then check
  `dist/presentation-studio.html`.
