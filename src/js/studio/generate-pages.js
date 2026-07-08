// ─────────────────────────────────────────────────────────────────────────
// Generate interactive pages — the Slide Converter's "Generate" step (step 3
// of slide-converter.html) applied to a Studio deck. Each slide becomes a
// standalone, Telia-branded HTML page with click-to-explain panels; the
// text labels can be enriched with one-sentence descriptions from the
// NorthStar-corpus or generic Perplexity API, and every generated page
// carries the same live explanation-source toggle the converter's pages do.
//
// The pages are full converter-format canvases, so they round-trip: import
// them back into the Studio, or feed them to the converter's
// HTML → PowerPoint step (the descriptions become speaker notes there).
// ─────────────────────────────────────────────────────────────────────────
import { slideToCanvasParts } from "./canvas-interop";

// Same endpoints as slide-converter.html — absolute so this works from any
// origin; the functions live on northstar-program.com and are CORS-enabled.
export const API_URLS = {
  northstar: "https://northstar-program.com/.netlify/functions/perplexity-api",
  generic: "https://northstar-program.com/.netlify/functions/perplexity-generic",
};

export const API_MODES = [
  { value: "none", label: "No API", desc: "components get generic placeholder text" },
  { value: "northstar", label: "NorthStar API", desc: "descriptions grounded in the NorthStar corpus (internal Telia/Ericsson material)" },
  { value: "generic", label: "Generic Perplexity", desc: "plain web-knowledge answers, no NorthStar-specific context" },
];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Fonts hosted on northstar-program.com (CORS-enabled) so generated pages keep
// the Telia typography even when downloaded standalone — same as the converter.
const FONT_BASE = "https://northstar-program.com/fonts";
const TELIA_FAVICON = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 205 216"><path fill="#990AE3" d="M141.19,151.57c27.97-16.22,53.16-43.73,61.11-63.35c2.26-16.23,2.71-18.29,2.99-36.15c0.04-2.47-0.12-4.85-0.34-7.12c-1.63,26.23-35.53,59.21-80.39,80.76c-54.1,25.99-94.7,32.99-112.81,13.16c6.29,12.42,10.42,18.46,17.49,27.68C50.14,185.07,94.11,178.88,141.19,151.57z"/><path fill="#990AE3" d="M118.25,107.13c51.04-24.62,86.58-59.64,80.38-82.86C188.45,6.69,167.86,0,145.78,0C80.33,0-0.01,43.14-0.01,98.18c0,7.07,1.56,14.99,4.36,23.27C19.29,141.27,64.93,132.85,118.25,107.13z"/><path fill="#990AE3" d="M113.95,185.15L113.95,185.15c-35.89,14.56-56.44,9.92-67.79,0.84L46,185.86c17.58,17.53,37.6,29.86,55.17,29.86c30.76,0,72.88-37.32,92.8-95.18C182.73,141.43,158.63,167.09,113.95,185.15z"/></svg>');

// The API often echoes the queried term as a "LABEL – " prefix, which
// duplicates the modal title. Strip it, but only when followed by a separator.
function stripLabelEcho(label, text) {
  const escd = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("^\\s*(?:\\*\\*)?" + escd + "(?:\\*\\*)?\\s*[–—:-]\\s*", "i");
  let t = text;
  while (re.test(t)) t = t.replace(re, "");
  return t;
}

// Read one streamed SSE response into the accumulated completion text.
async function readStream(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const c = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? "";
        if (c) out += c;
      } catch { /* partial frame */ }
    }
  }
  return out;
}

// Batch-describe the labels of one slide — mirrors enrichSlide in
// slide-converter.html, operating on the Studio's label list.
export async function enrichLabels(labels, mode, log = () => {}) {
  const descriptions = new Map();
  const todo = labels.filter((l) => l && !/^\d{1,3}$/.test(l) && !/internal$/i.test(l));
  if (!todo.length || mode === "none") return descriptions;

  const framing = mode === "generic"
    ? "In the context of 5G mobile networks, give a one-sentence description for each of the following terms."
    : "In the NorthStar / Telia 5G SA architecture, give a one-sentence description for each of the following components.";

  const batchSize = 8;
  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    const listStr = batch.map((l, j) => (j + 1) + ". " + l).join("\n");
    const query = framing + " Return ONLY a numbered list matching the input — one line per item, number then description. No markdown headers.\n\n" + listStr;
    try {
      const res = await fetch(API_URLS[mode], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history: [] }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const out = await readStream(res);
      const resultLines = out.split("\n").filter((l) => /^\d+[.)]\s/.test(l.trim()));
      for (let k = 0; k < Math.min(resultLines.length, batch.length); k++) {
        let desc = resultLines[k].replace(/^\d+[.)]\s*/, "").replace(/\s*\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();
        desc = stripLabelEcho(batch[k], desc);
        if (desc && !desc.toLowerCase().startsWith("not available")) descriptions.set(batch[k], desc);
      }
    } catch (err) {
      log("  API error: " + (err?.message || err));
    }
  }
  return descriptions;
}

// The interactive page shell — mirrors generateHtml in slide-converter.html:
// same styles, info overlay and live explanation-source toggle.
function buildInteractivePage({ name, bg, W, H, linesSvg, shapesHtml, entries }, descriptions) {
  const infoJs = entries.map((e) =>
    '        "' + e.key + '": {\n            title: ' + JSON.stringify(e.title) + ',\n            body: ' + JSON.stringify(descriptions.get(e.title) || "Component of the NorthStar architecture.") + "\n        }"
  ).join(",\n");

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
    + '    <meta charset="UTF-8">\n'
    + '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '    <title>' + esc(name) + '</title>\n'
    + '    <link rel="icon" type="image/svg+xml" href="' + TELIA_FAVICON + '">\n'
    + '    <style>\n'
    + '        @font-face { font-family: "Telia Sans Heading"; src: url("' + FONT_BASE + '/TeliaSansHeading-Heading.woff2") format("woff2"); font-weight: 300; font-style: normal; font-display: swap; }\n'
    + '        @font-face { font-family: "Telia Sans"; src: url("' + FONT_BASE + '/TeliaSans-Regular.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }\n'
    + '        @font-face { font-family: "Telia Sans"; src: url("' + FONT_BASE + '/TeliaSans-Medium.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }\n'
    + '        @font-face { font-family: "Telia Sans"; src: url("' + FONT_BASE + '/TeliaSans-Bold.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }\n'
    + '        * { margin: 0; padding: 0; box-sizing: border-box; }\n'
    + '        html, body { width: 100%; min-height: 100vh; font-family: "Telia Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #1a0029; }\n'
    + '        body { display: flex; align-items: center; justify-content: center; padding: 24px; }\n'
    + '        .canvas { position: relative; width: min(100%, 1500px); aspect-ratio: ' + W + ' / ' + H + '; background: ' + bg + '; container-type: inline-size; border-radius: 12px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.5); }\n'
    + '        .connectors { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }\n'
    + '        .shp { position: absolute; display: flex; flex-direction: column; overflow: visible; }\n'
    + '        .shp .para { width: 100%; line-height: 1.2; white-space: pre-wrap; }\n'
    + '        .shp.title .para { font-family: "Telia Sans Heading", "Telia Sans", system-ui, sans-serif; font-weight: 300; }\n'
    + '        .shp.img { padding: 0; }\n'
    + '        .shp.img img { width: 100%; height: 100%; object-fit: contain; display: block; }\n'
    + '        .shp.txt { cursor: pointer; transition: filter 0.15s ease, outline-color 0.15s ease; outline: 2px solid transparent; outline-offset: 2px; }\n'
    + '        .shp.txt:hover { filter: brightness(1.12); outline-color: rgba(153,10,227,0.7); border-radius: 6px; }\n'
    + '        [data-info].active { outline-color: #990AE3 !important; box-shadow: 0 0 24px rgba(153,10,227,0.4); }\n'
    + '        .info-overlay { display: none; position: fixed; inset: 0; z-index: 2000; background: rgba(26,0,41,0.6); backdrop-filter: blur(4px); justify-content: center; align-items: center; }\n'
    + '        .info-overlay.visible { display: flex; }\n'
    + '        .info-panel { background: linear-gradient(135deg, #3D1556, #29003E); border: 1px solid rgba(153,10,227,0.3); border-radius: 20px; padding: 36px 40px 32px; max-width: 560px; width: 90%; position: relative; box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(153,10,227,0.15); }\n'
    + '        .info-panel-title { font-family: "Telia Sans Heading", "Telia Sans", system-ui, sans-serif; font-weight: 700; font-size: 20px; color: #fff; margin-bottom: 16px; padding-right: 32px; }\n'
    + '        .info-panel-body { font-size: 15px; line-height: 1.6; color: rgba(244,224,255,0.85); }\n'
    + '        .info-panel-close { position: absolute; top: 20px; right: 20px; width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(153,10,227,0.3); background: rgba(153,10,227,0.15); color: #F4E0FF; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }\n'
    + '        .info-panel-close:hover { background: #990AE3; border-color: #990AE3; color: #fff; }\n'
    + '        .live-toggle { position: fixed; bottom: 20px; left: 24px; z-index: 1500; display: flex; align-items: center; gap: 9px; padding: 8px 16px; border-radius: 999px; background: rgba(61,21,86,0.9); border: 1px solid rgba(153,10,227,0.4); color: #F4E0FF; font-size: 13px; font-weight: 500; cursor: pointer; user-select: none; transition: border-color 0.15s; }\n'
    + '        .live-toggle:hover { border-color: #990AE3; }\n'
    + '        .live-toggle .dot { width: 10px; height: 10px; border-radius: 50%; background: #6E5C84; transition: background 0.15s, box-shadow 0.15s; }\n'
    + '        .live-toggle.northstar .dot { background: #3FBFA0; box-shadow: 0 0 10px rgba(63,191,160,0.7); }\n'
    + '        .live-toggle.generic .dot { background: #CE7DF2; box-shadow: 0 0 10px rgba(206,125,242,0.7); }\n'
    + '        .live-wait { color: rgba(244,224,255,0.6); animation: livePulse 1.2s ease infinite; }\n'
    + '        @keyframes livePulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }\n'
    + '        .live-note { font-size: 12px; color: #F2A33C; margin-bottom: 12px; }\n'
    + '        @media (max-width: 700px) { body { padding: 8px; } }\n'
    + '    </style>\n</head>\n<body>\n'
    + '    <div class="info-overlay" id="infoOverlay">\n'
    + '        <div class="info-panel">\n'
    + '            <button class="info-panel-close" id="infoClose">&times;</button>\n'
    + '            <div class="info-panel-title" id="infoTitle"></div>\n'
    + '            <div class="info-panel-body" id="infoBody"></div>\n'
    + '        </div>\n    </div>\n'
    + '    <div class="canvas">\n'
    + '        <svg class="connectors" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">\n'
    + linesSvg
    + '        </svg>\n'
    + shapesHtml
    + '    </div>\n'
    + '    <div class="live-toggle" id="liveToggle" title="Click to cycle where explanations come from: the text built into this page, the NorthStar corpus API, or the generic Perplexity API">\n'
    + '        <span class="dot"></span> Explanations: <b id="liveState">built-in</b>\n'
    + '    </div>\n'
    + '    <script>\n'
    + '    const INFO = {\n' + infoJs + '\n    };\n'
    + '    const API_URLS = {\n'
    + '        northstar: "' + API_URLS.northstar + '",\n'
    + '        generic: "' + API_URLS.generic + '",\n'
    + '    };\n'
    + '    const MODES = ["off", "northstar", "generic"];\n'
    + '    const MODE_LABELS = { off: "built-in", northstar: "NorthStar API", generic: "Perplexity (generic)" };\n'
    + "    const overlay = document.getElementById('infoOverlay');\n"
    + "    const titleEl = document.getElementById('infoTitle');\n"
    + "    const bodyEl  = document.getElementById('infoBody');\n"
    + "    const closeBtn = document.getElementById('infoClose');\n"
    + "    const liveToggle = document.getElementById('liveToggle');\n"
    + "    const liveState = document.getElementById('liveState');\n"
    + '    let activeEl = null;\n'
    + '    let liveMode = "off";\n'
    + '    let reqSeq = 0;\n'
    + '    const liveCache = new Map();\n'
    + "    liveToggle.addEventListener('click', () => {\n"
    + '        liveMode = MODES[(MODES.indexOf(liveMode) + 1) % MODES.length];\n'
    + "        liveToggle.classList.toggle('northstar', liveMode === 'northstar');\n"
    + "        liveToggle.classList.toggle('generic', liveMode === 'generic');\n"
    + '        liveState.textContent = MODE_LABELS[liveMode];\n'
    + '    });\n'
    + '    function mdBody(t) {\n'
    + "        const e = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
    + "        return e.replace(/\\s*\\[\\d+\\]/g, '')\n"
    + "            .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')\n"
    + "            .replace(/\\*([^*]+)\\*/g, '<em>$1</em>');\n"
    + '    }\n'
    + '    function stripEcho(label, text) {\n'
    + "        const escd = label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');\n"
    + "        const re = new RegExp('^\\\\s*(?:\\\\*\\\\*)?' + escd + '(?:\\\\*\\\\*)?\\\\s*[–—:-]\\\\s*', 'i');\n"
    + '        let t = text;\n'
    + "        while (re.test(t)) t = t.replace(re, '');\n"
    + '        return t;\n'
    + '    }\n'
    + '    async function fetchLive(label, mode, render) {\n'
    + '        const cacheKey = mode + ":" + label;\n'
    + '        if (liveCache.has(cacheKey)) { render(liveCache.get(cacheKey)); return; }\n'
    + '        const query = mode === "generic"\n'
    + '            ? "In the context of 5G mobile networks, explain briefly (one short paragraph, no headings): " + label\n'
    + '            : "In the NorthStar / Telia 5G SA architecture, explain briefly (one short paragraph, no headings): " + label;\n'
    + '        const res = await fetch(API_URLS[mode], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, history: [] }) });\n'
    + '        if (!res.ok) throw new Error("HTTP " + res.status);\n'
    + '        const reader = res.body.getReader();\n'
    + '        const dec = new TextDecoder();\n'
    + '        let buf = "", out = "";\n'
    + '        while (true) {\n'
    + '            const { done, value } = await reader.read();\n'
    + '            if (done) break;\n'
    + '            buf += dec.decode(value, { stream: true });\n'
    + '            const lines = buf.split("\\n");\n'
    + '            buf = lines.pop();\n'
    + '            for (const line of lines) {\n'
    + '                const t = line.trim();\n'
    + '                if (!t.startsWith("data:")) continue;\n'
    + '                const p = t.slice(5).trim();\n'
    + '                if (!p || p === "[DONE]") continue;\n'
    + '                try {\n'
    + '                    const j = JSON.parse(p);\n'
    + '                    const c = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? "";\n'
    + '                    if (c) { out += c; render(out); }\n'
    + '                } catch {}\n'
    + '            }\n'
    + '        }\n'
    + '        if (out) liveCache.set(cacheKey, out);\n'
    + '    }\n'
    + '    function showInfo(key, srcEl) {\n'
    + '        const entry = INFO[key]; if (!entry) return;\n'
    + "        if (activeEl) activeEl.classList.remove('active');\n"
    + "        activeEl = srcEl; srcEl.classList.add('active');\n"
    + '        titleEl.textContent = entry.title;\n'
    + "        overlay.classList.add('visible');\n"
    + '        const my = ++reqSeq;\n'
    + '        if (liveMode !== "off") {\n'
    + '            bodyEl.innerHTML = \'<span class="live-wait">Asking \' + (liveMode === "generic" ? "Perplexity" : "NorthStar") + \'&hellip;</span>\';\n'
    + '            fetchLive(entry.title, liveMode, txt => { if (my === reqSeq) bodyEl.innerHTML = mdBody(stripEcho(entry.title, txt)); })\n'
    + '                .catch(() => { if (my === reqSeq) bodyEl.innerHTML = \'<div class="live-note">&#9888; Live API unreachable &mdash; showing built-in text instead</div>\' + mdBody(stripEcho(entry.title, entry.body)); });\n'
    + '        } else {\n'
    + '            bodyEl.innerHTML = mdBody(stripEcho(entry.title, entry.body));\n'
    + '        }\n'
    + '    }\n'
    + "    function hideInfo() { overlay.classList.remove('visible'); if (activeEl) { activeEl.classList.remove('active'); activeEl = null; } }\n"
    + "    document.querySelectorAll('[data-info]').forEach(el => {\n"
    + "        el.addEventListener('click', e => { e.stopPropagation(); showInfo(el.dataset.info, el); });\n"
    + '    });\n'
    + "    closeBtn.addEventListener('click', hideInfo);\n"
    + "    overlay.addEventListener('click', e => { if (e.target === overlay) hideInfo(); });\n"
    + "    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideInfo(); });\n"
    + '    <\/script>\n</body>\n</html>';
}

const slug = (t) => String(t || "slide").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "slide";

// ── Deck → interactive pages ────────────────────────────────────────────────
export async function generateDeckPages(deck, mode, log = () => {}) {
  const pages = [];
  for (const [i, slide] of deck.slides.entries()) {
    const parts = slideToCanvasParts(slide);
    log(`Processing slide ${i + 1}: ${parts.name}`);
    let descriptions = new Map();
    if (mode !== "none") {
      log(`  Querying ${mode === "northstar" ? "NorthStar" : "generic Perplexity"} API…`);
      descriptions = await enrichLabels(parts.entries.map((e) => e.title), mode, log);
      log(`  Got ${descriptions.size} description(s)`);
    }
    pages.push({ name: parts.name, slug: slug(parts.name) + "-" + (i + 1), html: buildInteractivePage(parts, descriptions) });
  }
  log("Done!");
  return pages;
}

export function downloadPage(page) {
  const blob = new Blob([page.html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = page.slug + ".html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export async function downloadPagesZip(pages, deckTitle) {
  const mod = await import("jszip"); // CJS module — interop differs per bundler
  const JSZip = typeof mod === "function" ? mod : mod.default || mod.JSZip;
  const zip = new JSZip();
  pages.forEach((p) => zip.file(p.slug + ".html", p.html));
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = slug(deckTitle) + "-pages.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
