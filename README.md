# 5G SA — The Next Decade

A future-facing, animation-heavy web presentation of where **5G Standalone (5G SA)**
technology and business opportunities are heading over the next 5–10 years
(2026 → 2036), with two interactive simulations embedded.

Built in the visual language of the Telia × Ericsson **NorthStar** 5G SA
innovation program.

## What's inside

| Page | Description |
| --- | --- |
| `index.html` | Landing page linking to the presentation and the two simulations. |
| `northstar-future-vision.html` | The 14-section vision presentation (React). |
| `unified-5g-viz.html` | Interactive network slicing / RRP / 5QI / L4S simulation (web component). |
| `5g-sa-architecture-diagram.html` | Interactive 5G SA architecture diagram (RRP ↔ S-NSSAI ↔ 5QI ↔ DNN). |

### The presentation — 14 sections

1. **Hero** — "The Next Decade"
2. **The Inflection Point** — 2G → 6G timeline, "you are here" at 2026
3. **Three Waves** — Programmable · Cognitive · Ambient
4. **Inside the 5G SA Core** — embeds the architecture diagram
5. **Live Slicing** — embeds the network-slicing / L4S simulation
6. **AI-Native Networks** — closed-loop assurance, NWDAF, digital twin
7. **Ambient Intelligence (ISAC)** — the network as a sensor
8. **Positioning Revolution** — from cell-ID to centimetres
9. **Sky as Network (NTN)** — satellite ↔ terrestrial convergence
10. **Vertical Transformations 2035**
11. **The Business-Model Shift** — pipes → platforms → experiences
12. **Roadmap 2025–2029**
13. **The Bridge to 6G** — Rel-18 → Rel-22+
14. **Vision / CTA**

## Run locally

```bash
npm install
npm run dev      # http://localhost:1234
```

Open the URL Parcel prints (defaults to `http://localhost:1234`) and start at
`index.html`.

## Build for static hosting

```bash
npm run build    # outputs to ./dist
```

The build uses `--public-url ./` so the `dist/` folder can be served from any
sub-path (GitHub Pages, Netlify, S3, etc.). Deploy the contents of `dist/`.

## Tech

- **React 19** for the presentation, transpiled by **Parcel 2** (no separate config).
- The two simulations are framework-free (vanilla JS web component + standalone HTML)
  and are embedded via `<iframe>`, so they stay fully interactive and isolated.
- Fonts: Telia Sans (bundled under `src/assets/fonts`).

## Credits

Telia × Ericsson — NorthStar 5G SA innovation program. Co-funded by the European Union.
