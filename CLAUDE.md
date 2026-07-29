# Repository notes for Claude

## Presentation Studio: two synced codebases

The Presentation Studio editor exists in two codebases:

1. **Telia studio** — `src/js/studio/` in this repo (entry:
   `src/presentation-studio.html` + `src/js/studio-entry.jsx`), with Telia
   branding and NorthStar-site integrations.
2. **Generic editor** — the standalone repo
   `github.com/ivanpb-ai/presentation-studio` (its working copy during
   extraction also lives under `presentation-editor/` on the extraction
   branch). Same architecture, debranded, for use by anyone.

**Sync policy (user requirement): every change merged into one of these
codebases must also be ported to the other, unless it concerns
Telia-specific aspects that should stay in the Telia editor only (or
generic-only infrastructure listed below).** When making a change in one,
apply the equivalent change to the other in the same piece of work and say
so in the commit/PR; if a change is intentionally not ported, state why.

### Intentionally different — do NOT sync these

Telia-only (stays in `src/js/studio/`):
- Telia palette values (`src/js/palette.js`) and Telia Sans fonts
- NorthStar site-copy overlay (`copy.js` editor) and its Decks-menu entry
- Slide Converter hand-over (`takeTransferredSlides`) and converter wording
- NorthStar/Perplexity API endpoints on `northstar-program.com`
  (`generate-pages.js` has three modes here: none/northstar/generic)
- Auth specifics: `ns_editor_auth`/`ns_editor_user` cookie names, the
  NorthStar pepper, the gate also covering the other protected site pages,
  locked (503) when unconfigured, and `EDITOR_PASSWORD` shared mode keeping
  the legacy plain-hash cookie and the original unnamespaced blob/local keys
  (protects the live site's existing data)
- NorthStar-themed starter deck and element seed content

Generic-only (stays in the presentation-studio repo):
- Neutral palette / system font stack ("Studio Display" heading marker)
- `src/js/studio/auth.js` + Netlify Identity (open self-registration,
  JWT-validated decks API); open access when nothing is configured;
  `EDITOR_PASSWORD` there maps to a namespaced "default" user
- Self-hosted Perplexity proxy (`netlify/functions/perplexity.mjs`; the
  generic `generate-pages.js` has two modes: none/perplexity)
- Generic starter deck, README/netlify.toml docs

Synced in BOTH since 2026-07: the `EDITOR_USERS` multi-user cookie gate
(comma-separated `user:password` pairs; per-user Netlify Blobs namespaces
`user:<name>:`; per-user localStorage scope via the readable user cookie;
"Signed in as … / Sign out" row in the Decks menu). Auth changes must be
ported to both, translating the cookie/pepper names listed above.

### Porting mechanics

Files correspond one-to-one (`src/js/studio/*` ↔ generic `src/js/studio/*`,
`src/js/palette.js` ↔ same). When porting visual changes, translate colours:
the bright accents (cyan `#00D4FF`, electric, gold, green, red, orange) are
identical in both; the Telia base maps to the generic base as

| Telia | Generic | | Telia | Generic |
| --- | --- | --- | --- | --- |
| `#29003E` deep | `#0B1026` | | `#160427` chrome bg | `#0A0F22` |
| `#3D1556` dark | `#161D38` | | `#22093b` menus | `#171F3A` |
| `#4A1969` card | `#1C2547` | | `#b01ff5` hover | `#7D6EF5` |
| `#990AE3` purple | `#6C5CE7` | | `rgba(244,224,255,…)` text tints | `rgba(233,236,255,…)` |
| `#F4E0FF` light | `#E9ECFF` | | `rgba(153,10,227,…)` purple tints | `rgba(108,92,231,…)` |
| `#C23FE3` magenta | `#E15FD5` | | `rgba(20,5,40,…)` bars | `rgba(12,17,36,…)` |
| `#00827C` teal | `#0FA396` | | | |

Fonts: `'Telia Sans Heading', 'Telia Sans'` ↔ `'Studio Display', system-ui`
(head), `'Telia Sans'` ↔ `system-ui` (body); mono is identical. Wording:
"Telia palette" ↔ "theme palette"; NorthStar/Slide-Converter references ↔
generic equivalents.

The pptx exporter differs deliberately: Telia maps heading runs to the GDI
name "Telia Sans Heading Heading"; generic omits fontFace for theme fonts.
Both pass user-picked families (from the font picker) through unchanged.

### Verifying a synced change

- Telia studio: `npm run build` at this repo's root, then check
  `dist/presentation-studio.html` in a browser.
- Generic editor: `npm install && npm run build` in that repo (Parcel,
  same toolchain).
