// Fonts are hosted on the NorthStar site (public/fonts/, CORS-enabled) so
// generated pages keep the Telia typography even when downloaded standalone.
const FONT_BASE = "https://northstar-program.com/fonts";

// Telia pebble favicon inlined so standalone pages always show it.
const TELIA_FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 205 216"><path fill="#990AE3" d="M141.19,151.57c27.97-16.22,53.16-43.73,61.11-63.35c2.26-16.23,2.71-18.29,2.99-36.15c0.04-2.47-0.12-4.85-0.34-7.12c-1.63,26.23-35.53,59.21-80.39,80.76c-54.1,25.99-94.7,32.99-112.81,13.16c6.29,12.42,10.42,18.46,17.49,27.68C50.14,185.07,94.11,178.88,141.19,151.57z"/><path fill="#990AE3" d="M118.25,107.13c51.04-24.62,86.58-59.64,80.38-82.86C188.45,6.69,167.86,0,145.78,0C80.33,0-0.01,43.14-0.01,98.18c0,7.07,1.56,14.99,4.36,23.27C19.29,141.27,64.93,132.85,118.25,107.13z"/><path fill="#990AE3" d="M113.95,185.15L113.95,185.15c-35.89,14.56-56.44,9.92-67.79,0.84L46,185.86c17.58,17.53,37.6,29.86,55.17,29.86c30.76,0,72.88-37.32,92.8-95.18C182.73,141.43,158.63,167.09,113.95,185.15z"/></svg>'
  );

/**
 * Render a parsed slide as a *faithful* scaled canvas: every shape is
 * absolutely positioned at its original coordinates (percentages of the
 * slide), with its original fill, rounded corners, text styling, rotation,
 * images and connector lines. Text-bearing shapes stay clickable and open
 * the corpus-sourced explanation modal.
 */
export function generateHtml(slide, descriptions, opts = {}) {
  const pageTitle = opts.pageTitle || slide.title || "NorthStar";
  const backLink = opts.backLink ?? "index.html";
  const W = slide.width;
  const H = slide.height;
  const slideWIn = W / 914400;

  const pct = (v, total) => ((v / total) * 100).toFixed(3);
  // font pt → cqw (container-width units): pt/72 inches over slide width
  const cqw = (pt) => ((pt / 72 / slideWIn) * 100).toFixed(3);

  const infoEntries = [];
  const seenKeys = new Set();
  const toKey = (t) =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) ||
    "item";
  function addEntry(text) {
    const key = toKey(text);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      infoEntries.push({
        key,
        title: text,
        body:
          descriptions.get(text) ||
          "Component of the NorthStar architecture.",
      });
    }
    return key;
  }

  const ANCHOR = { t: "flex-start", ctr: "center", b: "flex-end" };
  const ALIGN = { l: "left", ctr: "center", r: "right", just: "justify" };

  let shapesHtml = "";
  let linesSvg = "";

  for (const s of slide.shapes) {
    if (s.kind === "line") {
      // Endpoints from the bounding box + flips (PowerPoint line semantics)
      let x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h;
      if (s.flipH) [x1, x2] = [x2, x1];
      if (s.flipV) [y1, y2] = [y2, y1];
      linesSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s.stroke.color}" stroke-width="${Math.max(s.stroke.w, 6350)}"/>\n`;
      continue;
    }

    const left = pct(s.x, W), top = pct(s.y, H);
    const width = pct(s.w, W), height = pct(s.h, H);
    let style = `left:${left}%;top:${top}%;width:${width}%;height:${height}%;`;

    const transforms = [];
    if (s.rot) transforms.push(`rotate(${s.rot.toFixed(2)}deg)`);
    if (s.flipH) transforms.push("scaleX(-1)");
    if (s.flipV) transforms.push("scaleY(-1)");
    if (transforms.length) style += `transform:${transforms.join(" ")};`;

    if (s.kind === "image") {
      shapesHtml += `<div class="shp img" style="${style}"><img src="${s.image.dataUri}" alt="${esc(s.image.alt)}" loading="lazy"></div>\n`;
      continue;
    }

    if (s.fill) style += `background:${s.fill};`;
    if (s.stroke)
      style += `border:calc(${cqw((s.stroke.w / 914400) * 72)}cqw) solid ${s.stroke.color};`;
    if (s.radius) style += `border-radius:${cqw((s.radius / 914400) * 72)}cqw;`;
    style += `justify-content:${ANCHOR[s.anchor] || "flex-start"};`;
    // The shape's own text insets (all lengths in cqw scale with the canvas)
    if (s.insets) {
      const eCqw = (emu) => ((emu / W) * 100).toFixed(3);
      style += `padding:${eCqw(s.insets.t)}cqw ${eCqw(s.insets.r)}cqw ${eCqw(s.insets.b)}cqw ${eCqw(s.insets.l)}cqw;`;
    }

    const color = s.color || (s.isTitle ? "#29003E" : "#121214");
    // Text the same color as its fill is invisible in the source deck —
    // reproduce the look but don't make it interactive.
    const invisible =
      s.fill && color.toLowerCase() === String(s.fill).toLowerCase();

    let inner = "";
    if (s.paras.length && !invisible) {
      for (const p of s.paras) {
        const align = ALIGN[p.algn] || "left";
        let spans = "";
        for (const r of p.runs) {
          const pt = r.size || s.fontSize;
          const fs = cqw(pt);
          const col = r.color || color;
          const fam = cssFamily(r.face || p.face, s.isTitle);
          // data-pt carries the exact point size for lossless reverse
          // conversion; the cqw font-size is what actually scales on screen.
          spans += `<span data-pt="${pt}" style="font-size:${fs}cqw;color:${col};${r.bold ? "font-weight:700;" : ""}${fam ? `font-family:${fam};` : ""}">${esc(r.text)}</span>`;
        }
        inner += `<div class="para" style="text-align:${align};">${spans}</div>`;
      }
    }

    if (s.textPlain && !invisible) {
      const key = addEntry(s.textPlain);
      const cls = s.isTitle ? "shp txt title" : "shp txt";
      shapesHtml += `<div class="${cls}" data-info="${esc(key)}" style="${style}">${inner}</div>\n`;
    } else {
      shapesHtml += `<div class="shp" style="${style}"></div>\n`;
    }
  }

  const infoJs = infoEntries
    .map(
      (e) =>
        `        "${e.key}": {\n            title: ${JSON.stringify(e.title)},\n            body: ${JSON.stringify(e.body)}\n        }`
    )
    .join(",\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(pageTitle)}</title>
    <link rel="icon" type="image/svg+xml" href="${TELIA_FAVICON}">
    <style>
        @font-face { font-family: "Telia Sans Heading"; src: url("${FONT_BASE}/TeliaSansHeading-Heading.woff2") format("woff2"); font-weight: 300; font-style: normal; font-display: swap; }
        @font-face { font-family: "Telia Sans"; src: url("${FONT_BASE}/TeliaSans-Regular.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
        @font-face { font-family: "Telia Sans"; src: url("${FONT_BASE}/TeliaSans-Medium.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
        @font-face { font-family: "Telia Sans"; src: url("${FONT_BASE}/TeliaSans-Bold.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; min-height: 100vh; font-family: "Telia Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #1a0029; }
        body { display: flex; align-items: center; justify-content: center; padding: 24px; }

        .back-link { position: fixed; top: 16px; right: 24px; z-index: 1000; color: #F4E0FF; text-decoration: underline; text-decoration-color: #990AE3; text-decoration-thickness: 2px; text-underline-offset: 4px; font-size: 15px; font-weight: 500; opacity: 0.7; transition: opacity .15s, color .15s; }
        .back-link:hover { opacity: 1; color: #fff; }

        /* The slide canvas: fixed aspect ratio, everything scales with it */
        .canvas {
            position: relative;
            width: min(100%, 1500px);
            aspect-ratio: ${W} / ${H};
            background: ${slide.bg};
            container-type: inline-size;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 24px 80px rgba(0,0,0,0.5);
        }
        .connectors { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        .shp { position: absolute; display: flex; flex-direction: column; overflow: visible; }
        .shp .para { width: 100%; line-height: 1.15; white-space: pre-wrap; }
        .shp.title .para { font-family: "Telia Sans Heading", "Telia Sans", system-ui, sans-serif; font-weight: 300; }
        .shp.img img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .shp.txt { cursor: pointer; transition: filter 0.15s ease, outline-color 0.15s ease; outline: 2px solid transparent; outline-offset: 2px; }
        .shp.txt:hover { filter: brightness(1.12); outline-color: rgba(153,10,227,0.7); border-radius: 6px; }
        [data-info].active { outline-color: #990AE3 !important; box-shadow: 0 0 24px rgba(153,10,227,0.4); }

        /* Info panel */
        .info-overlay { display: none; position: fixed; inset: 0; z-index: 2000; background: rgba(26,0,41,0.6); backdrop-filter: blur(4px); justify-content: center; align-items: center; }
        .info-overlay.visible { display: flex; }
        .info-panel { background: linear-gradient(135deg, #3D1556, #29003E); border: 1px solid rgba(153,10,227,0.3); border-radius: 20px; padding: 36px 40px 32px; max-width: 560px; width: 90%; position: relative; box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(153,10,227,0.15); }
        .info-panel-title { font-family: "Telia Sans Heading", "Telia Sans", system-ui, sans-serif; font-weight: 700; font-size: 20px; color: #fff; margin-bottom: 16px; padding-right: 32px; }
        .info-panel-body { font-size: 15px; line-height: 1.6; color: rgba(244,224,255,0.85); }
        .info-panel-close { position: absolute; top: 20px; right: 20px; width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(153,10,227,0.3); background: rgba(153,10,227,0.15); color: #F4E0FF; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .info-panel-close:hover { background: #990AE3; border-color: #990AE3; color: #fff; }

        /* Explanation-source selector (built-in → NorthStar API → generic Perplexity) */
        .live-toggle { position: fixed; bottom: 20px; left: 24px; z-index: 1500; display: flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: 999px; background: rgba(61,21,86,0.9); border: 1px solid rgba(153,10,227,0.4); color: #F4E0FF; font-size: 13px; font-weight: 500; cursor: pointer; user-select: none; transition: border-color 0.15s; }
        .live-toggle:hover { border-color: #990AE3; }
        .live-toggle .dot { width: 10px; height: 10px; border-radius: 50%; background: #6E5C84; transition: background 0.15s, box-shadow 0.15s; }
        .live-toggle.northstar .dot { background: #3FBFA0; box-shadow: 0 0 10px rgba(63,191,160,0.7); }
        .live-toggle.generic .dot { background: #CE7DF2; box-shadow: 0 0 10px rgba(206,125,242,0.7); }
        .live-wait { color: rgba(244,224,255,0.6); animation: livePulse 1.2s ease infinite; }
        @keyframes livePulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        .live-note { font-size: 12px; color: #F2A33C; margin-bottom: 12px; }

        @media (max-width: 700px) { body { padding: 8px; } }
    </style>
</head>
<body>
    <a href="${esc(backLink)}" class="back-link">&larr; Back to NorthStar main page</a>

    <div class="info-overlay" id="infoOverlay">
        <div class="info-panel">
            <button class="info-panel-close" id="infoClose">&times;</button>
            <div class="info-panel-title" id="infoTitle"></div>
            <div class="info-panel-body" id="infoBody"></div>
        </div>
    </div>

    <div class="canvas">
        <svg class="connectors" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
${linesSvg}        </svg>
${shapesHtml}    </div>

    <div class="live-toggle" id="liveToggle" title="Click to cycle where explanations come from: the text built into this page, the NorthStar corpus API, or the generic Perplexity API">
        <span class="dot"></span> Explanations: <b id="liveState">built-in</b>
    </div>

    <script>
    const INFO = {
${infoJs}
    };
    const API_URLS = {
        northstar: "https://northstar-program.com/.netlify/functions/perplexity-api",
        generic: "https://northstar-program.com/.netlify/functions/perplexity-generic",
    };
    const MODES = ["off", "northstar", "generic"];
    const MODE_LABELS = { off: "built-in", northstar: "NorthStar API", generic: "Perplexity (generic)" };
    const overlay = document.getElementById('infoOverlay');
    const titleEl = document.getElementById('infoTitle');
    const bodyEl  = document.getElementById('infoBody');
    const closeBtn = document.getElementById('infoClose');
    const liveToggle = document.getElementById('liveToggle');
    const liveState = document.getElementById('liveState');
    let activeEl = null;
    let liveMode = "off";
    let reqSeq = 0;
    const liveCache = new Map();

    liveToggle.addEventListener('click', () => {
        liveMode = MODES[(MODES.indexOf(liveMode) + 1) % MODES.length];
        liveToggle.classList.toggle('northstar', liveMode === 'northstar');
        liveToggle.classList.toggle('generic', liveMode === 'generic');
        liveState.textContent = MODE_LABELS[liveMode];
    });

    // Escape HTML, then render the API's markdown emphasis and strip any
    // citation markers that slipped through.
    function mdBody(t) {
        const e = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return e
            .replace(/\\s*\\[\\d+\\]/g, '')
            .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
            .replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
    }

    // The API often echoes the term as a "LABEL – " prefix, duplicating the
    // modal title. Strip it, but only when followed by a separator — a
    // normal sentence starting with the term stays intact.
    function stripEcho(label, text) {
        const escd = label.replace(/[.*+?^$\{\}()|[\\]\\\\]/g, '\\\\$&');
        const re = new RegExp('^\\\\s*(?:\\\\*\\\\*)?' + escd + '(?:\\\\*\\\\*)?\\\\s*[–—:-]\\\\s*', 'i');
        let t = text;
        while (re.test(t)) t = t.replace(re, '');
        return t;
    }

    // Stream a fresh explanation from the selected API, calling render()
    // with the accumulated text as it arrives.
    async function fetchLive(label, mode, render) {
        const cacheKey = mode + ":" + label;
        if (liveCache.has(cacheKey)) { render(liveCache.get(cacheKey)); return; }
        const query = mode === "generic"
            ? "In the context of 5G mobile networks, explain briefly (one short paragraph, no headings): " + label
            : "In the NorthStar / Telia 5G SA architecture, explain briefly (one short paragraph, no headings): " + label;
        const res = await fetch(API_URLS[mode], {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, history: [] }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "", out = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\\n");
            buf = lines.pop();
            for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith("data:")) continue;
                const p = t.slice(5).trim();
                if (!p || p === "[DONE]") continue;
                try {
                    const j = JSON.parse(p);
                    const c = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? "";
                    if (c) { out += c; render(out); }
                } catch {}
            }
        }
        if (out) liveCache.set(cacheKey, out);
    }

    function showInfo(key, srcEl) {
        const entry = INFO[key]; if (!entry) return;
        if (activeEl) activeEl.classList.remove('active');
        activeEl = srcEl; srcEl.classList.add('active');
        titleEl.textContent = entry.title;
        overlay.classList.add('visible');
        const my = ++reqSeq;
        if (liveMode !== "off") {
            bodyEl.innerHTML = '<span class="live-wait">Asking ' + (liveMode === 'generic' ? 'Perplexity' : 'NorthStar') + '&hellip;</span>';
            fetchLive(entry.title, liveMode, txt => { if (my === reqSeq) bodyEl.innerHTML = mdBody(stripEcho(entry.title, txt)); })
                .catch(() => { if (my === reqSeq) bodyEl.innerHTML = '<div class="live-note">&#9888; Live API unreachable — showing built-in text instead</div>' + mdBody(stripEcho(entry.title, entry.body)); });
        } else {
            bodyEl.innerHTML = mdBody(stripEcho(entry.title, entry.body));
        }
    }
    function hideInfo() { overlay.classList.remove('visible'); if (activeEl) { activeEl.classList.remove('active'); activeEl = null; } }
    document.querySelectorAll('[data-info]').forEach(el => {
        el.addEventListener('click', e => { e.stopPropagation(); showInfo(el.dataset.info, el); });
    });
    closeBtn.addEventListener('click', hideInfo);
    overlay.addEventListener('click', e => { if (e.target === overlay) hideInfo(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideInfo(); });
    </script>
</body>
</html>`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Map a pptx typeface to a CSS family stack. PowerPoint knows the heading
// cut by its GDI name "Telia Sans Heading Heading"; on the web we alias it
// as "Telia Sans Heading". Unknown faces are passed through with fallbacks.
function cssFamily(typeface, isTitle) {
  if (!typeface) {
    return isTitle
      ? `'Telia Sans Heading', 'Telia Sans', system-ui, sans-serif`
      : null; // inherit the page default (Telia Sans)
  }
  if (/telia sans heading/i.test(typeface))
    return `'Telia Sans Heading', 'Telia Sans', system-ui, sans-serif`;
  if (/^telia sans$/i.test(typeface)) return null;
  return `'${typeface.replace(/'/g, "")}', 'Telia Sans', system-ui, sans-serif`;
}
