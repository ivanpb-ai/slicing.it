# NorthStar PowerPoint add-in

A PowerPoint **content add-in** that embeds the interactive NorthStar pages
from northstar-program.com directly on a slide — live and clickable, including
the click-to-explain panels.

Files here deploy to `https://slicing.it/addin/`:

| File | Purpose |
|------|---------|
| `northstar-slide-embed.xml` | The add-in manifest (defaults to `/ns2.0-detailed.html`) |
| `icon-32.png`, `icon-64.png` | Icons referenced by the manifest |

## Option A — no add-in needed (quickest)

PowerPoint → **Insert → Get Add-ins** → search **"Web Viewer"** (Microsoft) →
insert → paste `https://slicing.it/ns2.0-detailed.html`.
Skip the rest of this document.

## Option B — sideload this manifest

Download the manifest:
`https://slicing.it/addin/northstar-slide-embed.xml`

### PowerPoint on the web
1. Open your presentation at office.com
2. **Insert → Add-ins → More Add-ins → My Add-ins → Upload My Add-in**
3. Choose the downloaded `northstar-slide-embed.xml`
4. The NorthStar 2.0 detailed overview appears on the slide as a resizable, interactive frame

### PowerPoint for Windows (trusted catalog)
1. Put the manifest in a network share, e.g. `\\server\addins\`
2. **File → Options → Trust Center → Trust Center Settings → Trusted Add-in Catalogs**
3. Add the share's URL, tick **Show in Menu**, OK, restart PowerPoint
4. **Insert → My Add-ins → Shared Folder** → select *NorthStar Interactive Slides*

### PowerPoint for Mac
1. Copy the manifest to
   `~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/`
   (create the `wef` folder if missing)
2. Restart PowerPoint → **Insert → My Add-ins** (dropdown arrow) → *NorthStar Interactive Slides*

### Whole organisation
An M365 admin can deploy the manifest centrally:
**Admin center → Settings → Integrated apps → Upload custom apps** — then it
appears under *Insert → My Add-ins → Admin Managed* for everyone.

## Embedding a different NorthStar page

Copy `northstar-slide-embed.xml`, then change two things:

1. `<Id>` — generate a fresh GUID (`node -e "console.log(crypto.randomUUID())"`)
2. `<SourceLocation DefaultValue="…"/>` — point at any page on the site,
   including pages produced by the [slide converter](https://northstar-program.com/slide-converter.html)
   once they're deployed under the site root

## Notes & constraints

- The embedded page needs **network access at presentation time** — nothing is cached offline.
- Interactivity during **slideshow mode** works in current Microsoft 365 (desktop & web); older perpetual versions (2016/2019) may render a static frame.
- Embedding works because the site serves no `X-Frame-Options`/`frame-ancestors`
  restrictions — if headers are ever tightened in `public/_headers`, allow
  framing from Office hosts or the add-in will show a blank frame.
