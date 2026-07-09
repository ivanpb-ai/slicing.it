// ─────────────────────────────────────────────────────────────────────────
// Deck linting — the consistency checks behind the ✓ Review panel:
//
//   scanDeviations(deck)   brand-token enforcement: every colour-like value
//                          in the deck that isn't the Telia palette (or a
//                          tint/alpha of it) is reported with its location.
//   measureOverflow(el)    DOM-measures whether an element's text fits its
//                          box on the 1280×720 stage (truncation warning).
//   lintDeck(deck)         per-slide checklist: text fit, projector-size
//                          fonts, contrast, text density, missing alt text,
//                          off-brand colours.
// ─────────────────────────────────────────────────────────────────────────
import { P, FONTS, STAGE_W } from "./model";

// ── colour helpers ──────────────────────────────────────────────────────────
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA_RE = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i;

function rgbOf(c) {
  if (typeof c !== "string") return null;
  const s = c.trim();
  let m = HEX_RE.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split("").map((x) => x + x).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = RGBA_RE.exec(s);
  if (m) return [+m[1], +m[2], +m[3]];
  return null;
}

const isColorLike = (v) => typeof v === "string" && (HEX_RE.test(v.trim()) || RGBA_RE.test(v.trim()));

// The approved brand set: the palette itself. Tints/alphas of a palette colour
// (same RGB, any opacity) count as on-brand — the Studio derives many of them.
const PALETTE_RGB = Object.values(P).map(rgbOf).filter(Boolean);
export function isBrandColor(v) {
  const rgb = rgbOf(v);
  if (!rgb) return true; // not a colour (gradient keyword etc.) — not ours to judge
  return PALETTE_RGB.some((p) => p[0] === rgb[0] && p[1] === rgb[1] && p[2] === rgb[2]);
}

export function paletteNameOf(v) {
  const rgb = rgbOf(v);
  if (!rgb) return null;
  for (const [name, val] of Object.entries(P)) {
    const p = rgbOf(val);
    if (p && p[0] === rgb[0] && p[1] === rgb[1] && p[2] === rgb[2]) return name;
  }
  return null;
}

// ── brand deviation detector ────────────────────────────────────────────────
// Walks the whole deck JSON and reports every colour-like string that isn't
// (a tint of) a palette colour: [{ slideIndex, elementId, path, value }].
export function scanDeviations(deck) {
  const out = [];
  const walk = (v, path, ctx) => {
    if (typeof v === "string") {
      if (isColorLike(v) && !isBrandColor(v)) out.push({ ...ctx, path, value: v.trim() });
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`, ctx)); return; }
    if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], path ? `${path}.${k}` : k, ctx);
  };
  (deck.slides || []).forEach((s, si) => {
    walk(s.background, "background", { slideIndex: si, elementId: null });
    (s.elements || []).forEach((el) => {
      walk(el.props, "props", { slideIndex: si, elementId: el.id, elementType: el.type });
      walk(el.style, "style", { slideIndex: si, elementId: el.id, elementType: el.type });
    });
  });
  return out;
}

// ── text-fit measurement ────────────────────────────────────────────────────
// A hidden measuring box styled like the element's text at true stage size;
// if the wrapped text is taller than the element, it won't fit.
let measurer = null;
function getMeasurer() {
  if (!measurer || !measurer.isConnected) {
    measurer = document.createElement("div");
    measurer.style.cssText = "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;box-sizing:border-box;white-space:pre-line;";
    document.body.appendChild(measurer);
  }
  return measurer;
}

// Returns null when the type has no meaningful fit check, else
// { fits, neededH, boxH }.
export function measureOverflow(el) {
  const s = el.style || {}, p = el.props || {};
  const m = getMeasurer();
  const set = (text, css) => {
    m.style.width = el.w + "px";
    m.style.font = "";
    Object.assign(m.style, { fontFamily: FONTS.body, fontWeight: "400", lineHeight: "1.4", letterSpacing: "0", padding: "0" }, css);
    m.textContent = text || "";
  };
  switch (el.type) {
    case "heading":
      set(p.text, { fontFamily: s.fontFamily || FONTS.head, fontSize: (s.fontSize || 60) + "px", fontWeight: String(s.fontWeight || 300), lineHeight: String(s.lineHeight || 1.1), letterSpacing: (s.letterSpacing || 0) + "px" });
      break;
    case "text":
      set(p.text, { fontFamily: s.fontFamily || FONTS.body, fontSize: (s.fontSize || 22) + "px", fontWeight: String(s.fontWeight || 400), lineHeight: String(s.lineHeight || 1.5), letterSpacing: (s.letterSpacing || 0) + "px" });
      break;
    case "kicker":
      set(String(p.text || "").toUpperCase(), { fontFamily: FONTS.mono, fontSize: (s.fontSize || 13) + "px", letterSpacing: (s.letterSpacing || 0) + "px" });
      break;
    case "quote":
      set((p.text || "") + (p.author ? "\n" + p.author : ""), { fontFamily: FONTS.head, fontSize: (s.fontSize || 40) + "px", fontWeight: "300", lineHeight: "1.25" });
      break;
    case "list":
      set((p.items || []).join("\n"), { fontSize: (s.fontSize || 17) + "px", lineHeight: "1.45", padding: "0 0 0 " + Math.round((s.fontSize || 17) * 1.4) + "px" });
      m.style.height = "auto";
      // account for the per-item gap the List block adds
      return finish(el, m.scrollHeight + Math.max(0, (p.items || []).length - 1) * (s.gap || 14));
    case "button":
      set(p.label, { fontSize: (s.fontSize || 15) + "px", fontWeight: "500", padding: "0 18px" });
      break;
    default:
      return null;
  }
  return finish(el, m.scrollHeight);
}
function finish(el, neededH) {
  return { fits: neededH <= el.h + 1, neededH: Math.round(neededH), boxH: el.h };
}

// ── slide lint ──────────────────────────────────────────────────────────────
const TEXT_TYPES = new Set(["heading", "text", "kicker", "quote", "list", "button"]);
const MIN_PROJECTOR_PX = 15; // ≈11pt at the 1280×720 stage — below this, unreadable projected
const DENSITY_LIMIT = 560;   // characters of copy per slide before it reads as a document

const luminance = (rgb) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};
export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function elementText(el) {
  const p = el.props || {};
  switch (el.type) {
    case "heading": case "text": case "kicker": case "quote": return p.text || "";
    case "button": return p.label || "";
    case "list": return (p.items || []).join(" ");
    case "card": return [p.tag, p.title, p.body, ...(p.bullets || [])].filter(Boolean).join(" ");
    case "counter": return p.label || "";
    default: return "";
  }
}

const short = (t, n = 34) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

// Per-slide checklist. Returns [{ slideIndex, name, status, issues, checks }]
// where issues = [{ level: "warn"|"info", check, msg, elementId }].
export function lintDeck(deck) {
  const deviations = scanDeviations(deck);
  return (deck.slides || []).map((slide, si) => {
    const issues = [];
    const bgRgb = rgbOf(slide.background?.type === "solid" ? slide.background?.colors?.[0] : P.deep) || rgbOf(P.deep);
    let chars = 0;

    for (const el of slide.elements || []) {
      chars += elementText(el).length;

      // 1 · text fit (truncation)
      if (TEXT_TYPES.has(el.type)) {
        const fit = measureOverflow(el);
        if (fit && !fit.fits) issues.push({ level: "warn", check: "fit", elementId: el.id, msg: `${el.type} “${short(elementText(el))}” overflows its box (needs ${fit.neededH}px, box is ${fit.boxH}px)` });
      }

      // 2 · projector-size fonts
      if ((el.type === "text" || el.type === "list") && (el.style?.fontSize || 0) > 0 && el.style.fontSize < MIN_PROJECTOR_PX) {
        issues.push({ level: "warn", check: "font-size", elementId: el.id, msg: `${el.type} at ${el.style.fontSize}px — too small to read on a projector (min ${MIN_PROJECTOR_PX}px)` });
      }

      // 3 · contrast vs slide background (skip gradient-filled headings)
      if (TEXT_TYPES.has(el.type) && !(el.type === "heading" && el.props?.gradient)) {
        const fg = rgbOf(el.style?.color);
        if (fg && bgRgb && slide.background?.type === "solid") {
          const ratio = contrastRatio(fg, bgRgb);
          if (ratio < 3) issues.push({ level: "warn", check: "contrast", elementId: el.id, msg: `${el.type} “${short(elementText(el))}” has low contrast against the background (${ratio.toFixed(1)}:1, want ≥ 3:1)` });
        }
      }

      // 4 · missing alt text
      if (el.type === "image" && el.props?.src && !String(el.props.alt || "").trim()) {
        issues.push({ level: "info", check: "alt", elementId: el.id, msg: "image has no alt text" });
      }
    }

    // 5 · text density
    if (chars > DENSITY_LIMIT) issues.push({ level: "warn", check: "density", elementId: null, msg: `${chars} characters of copy — consider splitting this slide (guide: ≤ ${DENSITY_LIMIT})` });

    // 6 · off-brand colours (from the deviation scan)
    for (const d of deviations.filter((d) => d.slideIndex === si)) {
      issues.push({ level: "warn", check: "brand", elementId: d.elementId, msg: `off-brand colour ${d.value} at ${d.elementType ? d.elementType + "." : ""}${d.path}` });
    }

    const checks = 6;
    const failed = new Set(issues.map((i) => i.check)).size;
    return { slideIndex: si, name: slide.name || `Slide ${si + 1}`, status: slide.status || "draft", issues, score: `${checks - failed}/${checks}` };
  });
}
