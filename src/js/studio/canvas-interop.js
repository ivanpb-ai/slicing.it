// ─────────────────────────────────────────────────────────────────────────
// Canvas interop — bridges the Studio's deck model and the "canvas" HTML
// format produced by slide-converter.html (one page per slide: a .canvas div
// with absolutely-positioned .shp shapes, per-run <span data-pt> text styling
// and an SVG connector layer, geometry expressed in EMU / % / cqw).
//
//   slideToCanvasHtml(slide)   Studio slide → converter-format HTML page.
//                              Feeds the converter's HTML→PowerPoint function
//                              (export-pptx.js) and round-trips through
//                              canvasHtmlToSlide.
//   canvasHtmlToSlide(html)    Converter-generated page → editable Studio
//                              slide (null if the HTML isn't a canvas page).
//
// The Studio stage is 1280×720 px; a canvas page is 12192000×6858000 EMU
// (13.333"×7.5" — the standard 16:9 PowerPoint slide), so 1 px = 9525 EMU
// and 1 px = 0.75 pt.
// ─────────────────────────────────────────────────────────────────────────
import { P, FONTS, STAGE_W, STAGE_H, createSlide, createElement, baseAnim } from "./model";
import { chartMarkup } from "./chart-svg";

const EMU_PER_IN = 914400;
const EMU_PER_PX = 9525;
const CANVAS_W = STAGE_W * EMU_PER_PX; // 12192000
const CANVAS_H = STAGE_H * EMU_PER_PX; // 6858000
const PT_PER_PX = 0.75;

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pctX = (px) => (px / STAGE_W * 100).toFixed(3);
const pctY = (px) => (px / STAGE_H * 100).toFixed(3);
const cqw = (px) => (px / STAGE_W * 100).toFixed(3); // container-query width units
const HEAD_FAMILY = "'Telia Sans Heading', 'Telia Sans', system-ui, sans-serif";

// First solid colour of a fill that may be a palette gradient array.
const solidOf = (grad, bg, fallback = P.purple) => (Array.isArray(grad) && grad.length ? grad[0] : bg || fallback);

function hexToRgba(hex, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// ── Studio slide → canvas HTML ──────────────────────────────────────────────
// Returns the building blocks of a converter-format page: positioned shape
// markup, the connector SVG, the background, and the click-to-explain label
// entries ({key, title} per text-bearing shape — the same labels the Slide
// Converter's Generate step enriches via the description APIs).
export function slideToCanvasParts(slide) {
  let shapesHtml = "";
  let linesSvg = "";
  const entries = [];
  const seenKeys = new Set();
  const toKey = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
  const addEntry = (text) => {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t || /^\d{1,3}$/.test(t)) return null; // bare numbers make useless labels
    const key = toKey(t);
    if (!seenKeys.has(key)) { seenKeys.add(key); entries.push({ key, title: t }); }
    return key;
  };

  const span = (text, { px = 22, color = P.light, bold = false, family = null } = {}) =>
    `<span data-pt="${(px * PT_PER_PX).toFixed(2)}" style="font-size:${cqw(px)}cqw;color:${color};` +
    (bold ? "font-weight:700;" : "") + (family ? `font-family:${esc(family)};` : "") + `">${esc(text)}</span>`;

  const para = (align, spans) => `<div class="para" style="text-align:${align};">${spans}</div>`;

  const shp = (el, { cls = "shp", fill = null, border = null, radiusPx = 0, anchor = "center", inner = "", info = null } = {}) => {
    let style = `left:${pctX(el.x)}%;top:${pctY(el.y)}%;width:${pctX(el.w)}%;height:${pctY(el.h)}%;`;
    if (el.rotation) style += `transform:rotate(${el.rotation.toFixed(2)}deg);`;
    if (fill) style += `background:${fill};`;
    if (border) style += `border:${cqw(border.w)}cqw solid ${border.color};`;
    if (radiusPx) style += `border-radius:${cqw(radiusPx)}cqw;`;
    style += `justify-content:${anchor};`;
    const key = info != null ? addEntry(info) : null;
    if (key && !/\btxt\b/.test(cls)) cls += " txt";
    shapesHtml += `<div class="${cls}"${key ? ` data-info="${esc(key)}"` : ""} style="${style}">${inner}</div>\n`;
  };

  const line = (x1, y1, x2, y2, color, widthPx) => {
    linesSvg += `<line x1="${Math.round(x1 * EMU_PER_PX)}" y1="${Math.round(y1 * EMU_PER_PX)}" x2="${Math.round(x2 * EMU_PER_PX)}" y2="${Math.round(y2 * EMU_PER_PX)}" stroke="${color}" stroke-width="${Math.max(Math.round(widthPx * EMU_PER_PX), 6350)}"/>\n`;
  };

  for (const el of slide.elements) {
    const s = el.style || {}, p = el.props || {};
    const align = s.align || "center";
    switch (el.type) {
      case "heading":
        shp(el, { cls: "shp txt title", info: p.text, inner: para(align, span(p.text || "", { px: s.fontSize || 60, color: solidOf(p.gradient, s.color, P.white), family: HEAD_FAMILY })) });
        break;
      case "text":
        shp(el, { info: p.text, inner: (p.text || "").split("\n").map((t) => para(align, span(t, { px: s.fontSize || 22, color: s.color || P.dim, bold: s.fontWeight >= 700 }))).join("") });
        break;
      case "kicker":
        shp(el, { info: p.text, inner: para(align, span(String(p.text || "").toUpperCase(), { px: s.fontSize || 13, color: s.color || P.cyan })) });
        break;
      case "quote":
        shp(el, { info: p.text, inner:
          para(align, span("“" + (p.text || "") + "”", { px: s.fontSize || 40, color: s.color || P.white, family: HEAD_FAMILY })) +
          (p.author ? para(align, span(p.author, { px: Math.max(16, (s.fontSize || 40) * 0.34), color: s.accent || P.cyan })) : "") });
        break;
      case "counter": {
        const d = p.decimals || 0;
        const val = d > 0 ? Number(p.value || 0).toFixed(d) : Math.round(p.value || 0).toLocaleString();
        shp(el, { info: p.label, inner:
          para("center", span(`${p.prefix || ""}${val}${p.suffix || ""}`, { px: s.fontSize || 64, color: s.color || P.light, family: HEAD_FAMILY })) +
          (p.label ? para("center", span(p.label, { px: Math.max(15, (s.fontSize || 64) * 0.2), color: P.muted })) : "") });
        break;
      }
      case "button": {
        const primary = p.variant !== "ghost";
        shp(el, {
          fill: primary ? (s.bg || P.purple) : null,
          border: primary ? null : { w: 2, color: s.color || P.light },
          radiusPx: el.h / 2,
          inner: para("center", span(p.label || "", { px: s.fontSize || 15, color: s.color || P.white, bold: true })),
        });
        break;
      }
      case "list":
        shp(el, { inner: (p.items || []).map((it) => para("left", span(`${s.marker || "◆"}  ${it}`, { px: s.fontSize || 17, color: s.color || P.light }))).join("") });
        break;
      case "card": {
        const c = s.accent || P.cyan;
        shp(el, {
          fill: hexToRgba(c, 0.1), border: { w: 1.5, color: c }, radiusPx: 18, anchor: "flex-start", info: p.title,
          inner:
            para("left", span(`${p.icon || ""}  ${String(p.tag || "").toUpperCase()}`, { px: 15, color: c })) +
            para("left", span(p.title || "", { px: 30, color: s.color || P.white, family: HEAD_FAMILY })) +
            (p.body ? para("left", span(p.body, { px: 13.5, color: P.dim })) : "") +
            (p.bullets || []).map((b) => para("left", span(`◆  ${b}`, { px: 12.5, color: "rgba(244,224,255,0.8)" }))).join(""),
        });
        break;
      }
      case "icon":
        shp(el, { inner: para("center", span(p.glyph || "", { px: s.fontSize || 90, color: P.white })) });
        break;
      case "image":
        if (p.src) {
          let style = `left:${pctX(el.x)}%;top:${pctY(el.y)}%;width:${pctX(el.w)}%;height:${pctY(el.h)}%;`;
          if (el.rotation) style += `transform:rotate(${el.rotation.toFixed(2)}deg);`;
          shapesHtml += `<div class="shp img" style="${style}"><img src="${esc(p.src)}" alt="${esc(p.alt || "")}"></div>\n`;
        }
        break;
      case "shape": {
        const kind = p.shape || "rect";
        const fill = solidOf(s.gradient, s.bg);
        if (kind === "line") { line(el.x, el.y + el.h / 2, el.x + el.w, el.y + el.h / 2, fill, Math.max(2, s.borderWidth || 3)); break; }
        const radiusPx = kind === "ellipse" ? Math.max(el.w, el.h) : kind === "pill" ? el.h / 2 : (s.borderRadius ?? 12);
        shp(el, { fill, border: s.borderWidth ? { w: s.borderWidth, color: s.borderColor || P.faint } : null, radiusPx });
        break;
      }
      case "ring":
        shp(el, { info: p.label, inner:
          para("center", span(`${Math.round(p.value || 0)}${p.suffix || ""}`, { px: s.fontSize || 44, color: P.white, family: HEAD_FAMILY })) +
          (p.label ? para("center", span(p.label, { px: 16, color: P.muted })) : "") });
        break;
      case "chart":
        // Drawn inline for the HTML view; carried as data so the PowerPoint
        // exporter can rebuild it as a native, editable chart.
        shapesHtml += `<div class="shp" data-chart="${esc(JSON.stringify({ kind: p.kind, xLabels: p.xLabels, axisMax: p.axisMax, series: p.series, legend: s.legend, axis: s.axis, grid: s.grid, rotate: p.rotate || undefined, reveal: p.reveal || undefined }))}" style="left:${pctX(el.x)}%;top:${pctY(el.y)}%;width:${pctX(el.w)}%;height:${pctY(el.h)}%;justify-content:center;">${chartMarkup(el).svg}</div>\n`;
        break;
      case "orbit":
        shp(el, { info: p.label, inner: para("center", span(p.label || "Orbit", { px: 18, color: s.accent || P.cyan })) });
        break;
      case "radar":
        shp(el, { border: { w: 1.5, color: s.accent || P.cyan }, radiusPx: 16, info: p.label, inner: para("center", span(p.label || "Radar", { px: 16, color: s.accent || P.cyan })) });
        break;
      case "loop":
        shp(el, { info: p.title, inner:
          para("center", span(p.title || "", { px: 28, color: P.white, family: HEAD_FAMILY })) +
          (p.stages ? para("center", span(p.stages.map((st) => st.label).join(" → "), { px: 14, color: P.light })) : "") });
        break;
      default:
        break;
    }
  }

  const bg = slide.background?.type === "solid" ? (slide.background.colors?.[0] || P.deep) : P.deep;

  return { shapesHtml, linesSvg, entries, bg, name: slide.name || "Slide", W: CANVAS_W, H: CANVAS_H };
}

// Plain converter-format page (no click-to-explain chrome) — the input to the
// PowerPoint exporter. Same skeleton slide-converter.html generates, so its
// HTML→PowerPoint function — and this module's importer — read it unchanged.
export function slideToCanvasHtml(slide) {
  const { shapesHtml, linesSvg, bg, name } = slideToCanvasParts(slide);
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n'
    + `<title>${esc(name)}</title>\n`
    + "<style>\n"
    + '* { margin: 0; padding: 0; box-sizing: border-box; }\n'
    + 'html, body { width: 100%; min-height: 100vh; font-family: "Telia Sans", system-ui, sans-serif; background: #1a0029; }\n'
    + 'body { display: flex; align-items: center; justify-content: center; padding: 24px; }\n'
    + `.canvas { position: relative; width: min(100%, 1500px); aspect-ratio: ${CANVAS_W} / ${CANVAS_H}; background: ${bg}; container-type: inline-size; border-radius: 12px; overflow: hidden; }\n`
    + ".connectors { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }\n"
    + ".shp { position: absolute; display: flex; flex-direction: column; overflow: visible; }\n"
    + ".shp .para { width: 100%; line-height: 1.2; white-space: pre-wrap; }\n"
    + ".shp.img img { width: 100%; height: 100%; object-fit: contain; display: block; }\n"
    + "</style>\n</head>\n<body>\n"
    + '<div class="canvas">\n'
    + `<svg class="connectors" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" preserveAspectRatio="none">\n${linesSvg}</svg>\n`
    + shapesHtml
    + "</div>\n</body>\n</html>";
}

// ── Canvas HTML → Studio slide ──────────────────────────────────────────────
const cssLen = (v) => { const m = /(-?[\d.]+)/.exec(v || ""); return m ? parseFloat(m[1]) : 0; };

function parseFamily(raw) {
  const fam = (raw || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  return /telia sans heading/i.test(fam) ? "heading" : fam ? "body" : null;
}

// Extract a shape's paragraphs: [{ align, text, maxPt, color, bold, heading }]
function readParas(shpEl) {
  return [...shpEl.querySelectorAll(".para")].map((pEl) => {
    const spans = [...pEl.querySelectorAll("span")];
    const parts = spans.length ? spans : [pEl];
    let maxPt = 0, color = null, bold = false, heading = false;
    for (const el of parts) {
      const pt = parseFloat(el.getAttribute?.("data-pt")) || cssLen(el.style?.fontSize) * STAGE_W / 100 * PT_PER_PX;
      if (pt > maxPt) maxPt = pt;
      if (!color && el.style?.color) color = el.style.color;
      if (el.style?.fontWeight === "700" || el.style?.fontWeight === "bold") bold = true;
      if (parseFamily(el.style?.fontFamily) === "heading") heading = true;
    }
    return {
      align: pEl.style.textAlign || "left",
      text: parts.map((el) => el.textContent).join(""),
      maxPt, color, bold, heading,
    };
  }).filter((p) => p.text.trim());
}

export function canvasHtmlToSlide(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const canvas = doc.querySelector(".canvas");
  if (!canvas) return null;

  // Slide geometry + background live in the page's stylesheet.
  const css = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("\n");
  const cm = css.match(/\.canvas\s*\{[^}]*aspect-ratio:\s*(\d+)\s*\/\s*(\d+)[^}]*\}/);
  const W = cm ? +cm[1] : CANVAS_W, H = cm ? +cm[2] : CANVAS_H;
  const bgm = (cm ? cm[0] : "").match(/background:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\))/);
  const bg = bgm ? bgm[1] : P.deep;

  const px = (v) => v / 100 * STAGE_W;          // percentage-of-width → stage px
  const py = (v) => v / 100 * STAGE_H;
  const cqwPx = (v) => v / 100 * STAGE_W;       // cqw → stage px
  const emuX = (v) => v / W * STAGE_W;          // connector EMU → stage px
  const emuY = (v) => v / H * STAGE_H;

  const elements = [];
  const el = (type, over) => elements.push(createElement(type, { ...over, anim: baseAnim({ in: "fade", duration: 0.5 }) }));

  // Connector lines (SVG overlay) → thin rotated rectangles.
  doc.querySelectorAll(".connectors line").forEach((ln) => {
    const x1 = emuX(+ln.getAttribute("x1")), y1 = emuY(+ln.getAttribute("y1"));
    const x2 = emuX(+ln.getAttribute("x2")), y2 = emuY(+ln.getAttribute("y2"));
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    const th = Math.max(2, (+ln.getAttribute("stroke-width") || 19050) / EMU_PER_PX);
    el("shape", {
      x: (x1 + x2) / 2 - len / 2, y: (y1 + y2) / 2 - th / 2, w: len, h: th,
      rotation: Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI,
      props: { shape: "rect" },
      style: { bg: ln.getAttribute("stroke") || "#FFFFFF", gradient: null, borderRadius: 0, borderColor: null, borderWidth: 0, glow: false, opacity: 1 },
    });
  });

  canvas.querySelectorAll(":scope > .shp").forEach((shpEl) => {
    const st = shpEl.style;
    const x = px(cssLen(st.left)), y = py(cssLen(st.top));
    const w = px(cssLen(st.width)), h = py(cssLen(st.height));
    if (!w || !h) return;
    const rotM = /rotate\((-?[\d.]+)deg\)/.exec(st.transform || "");
    const rotation = rotM ? parseFloat(rotM[1]) : 0;

    const img = shpEl.querySelector("img");
    if (img) {
      el("image", { x, y, w, h, rotation, props: { src: img.getAttribute("src") || "", fit: "contain", alt: img.getAttribute("alt") || "" }, style: { borderRadius: 0, borderColor: null, borderWidth: 0, opacity: 1 } });
      return;
    }

    const chartData = shpEl.getAttribute("data-chart");
    if (chartData) {
      try {
        const c = JSON.parse(chartData);
        el("chart", {
          x, y, w, h, rotation,
          props: { kind: c.kind || "area", xLabels: c.xLabels || [], axisMax: c.axisMax, series: c.series || [], rotate: !!c.rotate, reveal: !!c.reveal },
          style: { axis: c.axis || P.muted, grid: c.grid || P.faint, legend: c.legend || P.dim, opacity: 1 },
        });
        return;
      } catch { /* fall through to generic handling */ }
    }

    const fill = st.background || st.backgroundColor || null;
    const borderM = /solid\s+(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\))/.exec(st.border || "");
    const borderWidth = borderM ? Math.max(1, Math.round(cqwPx(cssLen(st.border)))) : 0;
    const radius = Math.round(cqwPx(cssLen(st.borderRadius)));
    const paras = readParas(shpEl);

    // A filled / stroked box under the text becomes its own editable shape.
    if (fill || borderM) {
      el("shape", {
        x, y, w, h, rotation,
        props: { shape: "rect" },
        style: { bg: fill || "rgba(0,0,0,0)", gradient: null, borderRadius: radius, borderColor: borderM ? borderM[1] : null, borderWidth, glow: false, opacity: 1 },
      });
    }
    if (!paras.length) return;

    const isHeading = shpEl.classList.contains("title") || paras.some((p) => p.heading);
    const maxPt = Math.max(...paras.map((p) => p.maxPt), 0);
    const fontSize = Math.max(10, Math.round((maxPt || 13.5) / PT_PER_PX));
    const color = paras.find((p) => p.color)?.color || (isHeading ? P.white : P.light);
    const type = isHeading && paras.length === 1 ? "heading" : "text";
    el(type, {
      x, y, w, h, rotation,
      props: type === "heading" ? { text: paras[0].text, gradient: null } : { text: paras.map((p) => p.text).join("\n") },
      style: {
        color, fontSize, align: paras[0].align === "justify" ? "left" : paras[0].align,
        fontFamily: isHeading ? FONTS.head : FONTS.body,
        fontWeight: paras.some((p) => p.bold) ? 700 : type === "heading" ? 300 : 400,
        lineHeight: 1.25, letterSpacing: 0, italic: false, opacity: 1,
      },
    });
  });

  return createSlide({
    name: (doc.querySelector("title")?.textContent || "Imported slide").trim(),
    background: { type: "solid", colors: [bg], variant: 0 },
    transition: "fade",
    elements,
  });
}

// ── Automatic hand-over from slide-converter.html ───────────────────────────
// The converter's "Edit in Presentation Studio" button stores its generated
// pages under this key and navigates here; the Studio consumes them on load.
const TRANSFER_KEY = "northstar.studio.transfer.v1";
const TRANSFER_MAX_AGE = 10 * 60 * 1000; // ignore stale hand-overs

export function takeTransferredSlides() {
  let raw;
  try {
    raw = localStorage.getItem(TRANSFER_KEY);
    if (raw) localStorage.removeItem(TRANSFER_KEY); // consume once
  } catch { return null; }
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    if (!Array.isArray(t.pages) || (t.ts && Date.now() - t.ts > TRANSFER_MAX_AGE)) return null;
    const slides = t.pages.map((p) => { try { return canvasHtmlToSlide(p); } catch { return null; } }).filter(Boolean);
    if (!slides.length) return null;
    return { title: t.title || slides[0].name || "Converted slides", slides };
  } catch {
    return null;
  }
}
