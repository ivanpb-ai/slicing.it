# pptx-to-html

Convert NorthStar PowerPoint slides into interactive, Telia-branded HTML pages with click-to-explain panels powered by the NorthStar corpus API.

## Quick start

```bash
cd pptx-to-html
npm install

# List slides in a deck
node cli.mjs path/to/deck.pptx --list

# Convert a single slide
node cli.mjs path/to/deck.pptx --slide 7 -o ../../src/resilient-core.html

# Convert all slides (one HTML file per slide)
node cli.mjs path/to/deck.pptx
```

## How it works

The converter reproduces the slide **faithfully** as a scaled canvas rather than re-flowing content into a different layout:

1. **Parse** — Walks the slide's shape tree (including nested groups with their scaling transforms) and captures every drawable with its absolute geometry and resolved styling:
   - shapes: position/size, fill (theme scheme colors resolved via `theme1.xml`, including `lumMod`/`shade`/`tint` modifiers), border, corner radius (`roundRect` adj), rotation and flips
   - text: per-paragraph content and alignment, font size, bold, color (run color → shape-style `fontRef` → default), vertical anchor
   - pictures: extracted and inlined as base64 data URIs (`PNG`/`JPEG`/`SVG`/`GIF`/`WebP`; `EMF`/`WMF` skipped)
   - connectors (`cxnSp` / `line` geometry): endpoints with flips, stroke color and width
   - slide background and placeholder geometry are inherited slide → layout → master (so a title placeholder with no local geometry still lands where PowerPoint renders it)

2. **Enrich** — Sends each text label to one of three sources, chosen with `--api` (CLI) or the radio options in the web converter:
   - **`northstar`** (default) — the Perplexity-backed NorthStar function (`/.netlify/functions/perplexity-api`), grounded in the internal corpus
   - **`generic`** — a plain Perplexity `sonar-pro` proxy (`/.netlify/functions/perplexity-generic`) with no NorthStar context, system prompt or domain filter
   - **`none`** — no API; components get generic placeholder text

   Both functions keep the `PPLX_API_KEY` server-side — generated pages never contain the key.

   Generated pages also carry an **explanation-source switch** (bottom-left, default "built-in"). Viewers cycle it between the baked-in text, the NorthStar API, and generic Perplexity — live modes stream the answer into the modal, cache responses per label for the session, and fall back to the baked text if the API is unreachable. Live modes require the page to be able to reach `northstar-program.com`.

3. **Generate** — Renders a fixed-aspect-ratio canvas (`container-type: inline-size`) where every shape is absolutely positioned in percentages and every font size / radius / border is in `cqw` units, so the whole slide scales as one unit. Connector lines are drawn in an SVG overlay in slide coordinates. Text-bearing shapes are clickable and open the corpus-sourced explanation modal; text that is the same color as its fill (invisible in the source) is reproduced but not interactive.

### Known limitations

- **Gradient fills** are approximated by their first color stop; complex shape geometries (arrows, chevrons, freeforms) render as rectangles with the correct fill.
- **Charts, SmartArt and tables** are not reproduced (they are separate OOXML parts).
- The **title** is taken from the slide's title placeholder when present, otherwise inferred as the largest-font text in the top quarter of the slide; override with `--title` if it guesses wrong.
- **Embedding images inlines the bytes**, so a logo-heavy slide can produce an HTML file of a few hundred KB to ~1 MB.

## Options

| Flag | Description |
|------|-------------|
| `--list` | List all slides with titles and item counts |
| `--slide <n>` | Convert only slide number n (1-based) |
| `-o, --output <path>` | Output file path (default: `<title>.html`) |
| `--title <text>` | Override the page title |
| `--back-link <url>` | URL for the back navigation link (default: `index.html`) |
| `--api <mode>` | Enrichment source: `northstar` (default), `generic`, or `none` |
| `--no-enrich` | Alias for `--api none` |
| `--dry-run` | Print parsed slide structure as JSON |
| `--descriptions <file>` | Load descriptions from a JSON file instead of the API |

## Workflow: pre-build descriptions

For slides you'll regenerate often, save the API results once and reuse them:

```bash
# 1. Generate and review
node cli.mjs deck.pptx --slide 4 -o page.html

# 2. Extract the INFO object from the generated HTML into a JSON file
#    (or write it by hand)
cat descriptions.json
# { "Control Plane": "Hosts signalling functions…", "User Plane": "…" }

# 3. Regenerate without hitting the API
node cli.mjs deck.pptx --slide 4 --descriptions descriptions.json -o page.html
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `https://northstar-program.com/.netlify/functions/perplexity-api` | NorthStar API endpoint |

## Architecture

```
cli.mjs            — CLI entry point, arg parsing, orchestration
parse-pptx.mjs     — .pptx → { title, width, height, bg, shapes[] } visual model
enrich.mjs         — NorthStar API client, batched queries with concurrency
generate-html.mjs  — faithful scaled-canvas renderer with info-panel JS
```

The web version (index.html at the repo root, served at slicing.it) embeds the same parser and generator, so both produce identical output.

## Reverse conversion (HTML → PowerPoint)

The web converter also has a **reverse mode**: drop a page generated by this tool and it rebuilds a native `.pptx` slide (via pptxgenjs) purely from the HTML — no access to any original PowerPoint is needed or used. The canvas geometry (`%` / `cqw` / EMU) maps back to inches; shapes, text runs, fills, rounded corners, rotation, images and connector lines become native PowerPoint objects; and the click-to-explain descriptions are written into the slide's speaker notes. Verified by round-trip: PPTX → HTML → PPTX re-parses to the identical visual model.
