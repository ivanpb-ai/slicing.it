// Auto-arrange — a deterministic layout engine that tidies the current slide.
//
// Elements are classified into three bands on the 1280×720 stage:
//   header  — kickers, headings and (when other content exists) the first
//             text block, stacked and centred at the top;
//   footer  — buttons, in a centred row at the bottom;
//   content — everything else, laid out on a balanced grid between the two.
// Wide storytelling blocks (charts, quotes, AI loops) get a full-width row of
// their own; the rest are chunked into grid rows, re-sized to fit their cell
// while keeping a per-type preferred aspect ratio, and normalised so identical
// types end up identical sizes. Only geometry (x/y/w/h/rotation) and — when a
// dense layout demands it — heading/intro font sizes are touched; content,
// styling and z-order are preserved, so a checkpoint before applying makes the
// whole operation a single undo step.

const STAGE_W = 1280;
const STAGE_H = 720;
const MARGIN_X = 80;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const GUTTER = 28;
const BAND_W = STAGE_W - MARGIN_X * 2;

// Blocks that read best spanning the whole content band.
const FULL_ROW_TYPES = new Set(["chart", "quote", "loop"]);

// Per-type sizing preferences: aspect = w/h the block looks best at, plus
// caps so a lone icon is not blown up to fill a huge cell.
const SIZE = {
  card: { aspect: 1.05, maxW: 400, maxH: 380 },
  counter: { aspect: 2.0, maxW: 320, maxH: 150 },
  ring: { aspect: 0.9, maxW: 220, maxH: 245 },
  icon: { aspect: 1.0, maxW: 140, maxH: 140 },
  image: { aspect: 1.35, maxW: 640, maxH: 430 },
  chart: { aspect: 2.1, maxW: 1000, maxH: 400, flexW: true },
  orbit: { aspect: 1.0, maxW: 400, maxH: 400 },
  radar: { aspect: 1.33, maxW: 520, maxH: 390 },
  loop: { aspect: 1.4, maxW: 620, maxH: 440 },
  quote: { aspect: 3.4, maxW: 960, maxH: 280, flexW: true },
  list: { aspect: 1.6, maxW: 520, maxH: 330 },
  text: { aspect: 3.2, maxW: 700, maxH: 260 },
  shape: { aspect: 1.7, maxW: 420, maxH: 260 },
  heading: { aspect: 4.0, maxW: 1120, maxH: 300 },
  default: { aspect: 1.5, maxW: 520, maxH: 360 },
};

const sizePref = (type) => SIZE[type] || SIZE.default;

// Rough line-count estimate for wrapped text (average glyph ≈ factor·fontSize).
function estLines(text, fontSize, width, factor, letterSpacing = 0) {
  const t = String(text || "").trim();
  if (!t) return 1;
  const cw = Math.max(1, fontSize * factor + letterSpacing);
  const perLine = Math.max(4, Math.floor(width / cw));
  return Math.max(1, Math.ceil(t.length / perLine));
}

function fitToCell(type, cellW, cellH) {
  const p = sizePref(type);
  let w = Math.min(cellW, p.maxW);
  const maxH = Math.min(cellH, p.maxH);
  // Charts and quotes stretch horizontally without distortion; the rest keep
  // their preferred aspect so they never look squashed.
  if (p.flexW) return { w: Math.round(w), h: Math.round(maxH) };
  let h = w / p.aspect;
  if (h > maxH) { h = maxH; w = Math.min(w, h * p.aspect); }
  return { w: Math.round(w), h: Math.round(h) };
}

// Stable-group content so identical types sit next to each other (rows of
// cards, rows of counters) while first-occurrence order decides group order.
function groupByType(items) {
  const order = [];
  const buckets = new Map();
  for (const el of items) {
    if (!buckets.has(el.type)) { buckets.set(el.type, []); order.push(el.type); }
    buckets.get(el.type).push(el);
  }
  return order.flatMap((t) => buckets.get(t));
}

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const gridCols = (n) => (n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4);

/**
 * Returns a new elements array (same order, same ids) with x/y/w/h/rotation —
 * and, on dense slides, heading/intro font sizes — recomputed for a clean,
 * balanced layout. Call checkpoint() before applying so it is one undo step.
 */
export function arrangeElements(elements) {
  if (!elements || elements.length < 1) return elements;
  const patch = new Map(); // id -> geometry/style patch

  const kickers = elements.filter((e) => e.type === "kicker");
  const headings = elements.filter((e) => e.type === "heading");
  const texts = elements.filter((e) => e.type === "text");
  const buttons = elements.filter((e) => e.type === "button");
  let content = elements.filter((e) => !["kicker", "heading", "text", "button"].includes(e.type));

  // The first text block plays the sub-title when there is other content;
  // remaining texts (or all of them on a text-only slide) join the grid.
  let intro = null;
  if (content.length && texts.length) { intro = texts[0]; content = [...content, ...texts.slice(1)]; }
  else if (!content.length && headings.length && texts.length === 1) { intro = texts[0]; }
  else { content = [...content, ...texts]; }
  content = groupByType(content);

  // ── Footer: buttons in a centred row at the bottom ─────────────────────
  let bandBottom = STAGE_H - MARGIN_BOTTOM;
  if (buttons.length) {
    const bh = 52;
    const widths = buttons.map((b) => Math.round(Math.min(280, Math.max(170, b.w))));
    const total = widths.reduce((a, w) => a + w, 0) + GUTTER * (buttons.length - 1);
    let x = Math.round((STAGE_W - total) / 2);
    const y = STAGE_H - 48 - bh;
    buttons.forEach((b, i) => {
      patch.set(b.id, { x, y, w: widths[i], h: bh, rotation: 0 });
      x += widths[i] + GUTTER;
    });
    bandBottom = y - GUTTER;
  }

  // ── Header stack: measure, then place ──────────────────────────────────
  const rowsEstimate = content.length ? Math.max(1, Math.ceil(content.length / gridCols(content.length))) : 0;
  const stack = []; // { el, w, h, gapAfter, style? }
  for (const k of kickers) stack.push({ el: k, w: 700, h: 30, gapAfter: 16 });
  for (const h of headings) {
    const s = h.style || {};
    let fontSize = s.fontSize || 64;
    // Dense slides need the headline to make room for the grid.
    if (rowsEstimate >= 2) fontSize = Math.min(fontSize, 52);
    else if (rowsEstimate === 1) fontSize = Math.min(fontSize, 64);
    const w = Math.min(1120, BAND_W);
    const lines = estLines(h.props && h.props.text, fontSize, w, 0.5, s.letterSpacing || 0);
    const hh = Math.round(lines * fontSize * (s.lineHeight || 1.05) + 12);
    stack.push({ el: h, w, h: hh, gapAfter: 14, style: fontSize !== s.fontSize ? { fontSize } : null });
  }
  if (intro) {
    const s = intro.style || {};
    let fontSize = s.fontSize || 22;
    if (content.length) fontSize = Math.min(fontSize, 24);
    const w = 820;
    const lines = estLines(intro.props && intro.props.text, fontSize, w, 0.5, s.letterSpacing || 0);
    const ih = Math.round(lines * fontSize * (s.lineHeight || 1.6) + 8);
    stack.push({ el: intro, w, h: ih, gapAfter: 0, style: fontSize !== s.fontSize ? { fontSize } : null });
  }
  const stackH = stack.reduce((a, r, i) => a + r.h + (i < stack.length - 1 ? r.gapAfter : 0), 0);

  // Title-style slide (no grid): centre the stack vertically instead.
  let y = stack.length
    ? content.length
      ? MARGIN_TOP
      : Math.max(MARGIN_TOP, Math.round(MARGIN_TOP + (bandBottom - MARGIN_TOP - stackH) / 2))
    : MARGIN_TOP;
  stack.forEach((r, i) => {
    patch.set(r.el.id, {
      x: Math.round((STAGE_W - r.w) / 2), y, w: r.w, h: r.h, rotation: 0,
      ...(r.style ? { style: { ...(r.el.style || {}), ...r.style } } : {}),
    });
    y += r.h + (i < stack.length - 1 ? r.gapAfter : 0);
  });

  // ── Content grid between header and footer ─────────────────────────────
  if (content.length) {
    const bandTop = stack.length ? y + 30 : MARGIN_TOP;
    const bandH = Math.max(120, bandBottom - bandTop);

    // Build rows: full-width blocks alone, the rest chunked into a grid.
    const wide = content.filter((e) => FULL_ROW_TYPES.has(e.type));
    const grid = content.filter((e) => !FULL_ROW_TYPES.has(e.type));
    const cols = gridCols(grid.length);
    const rows = [
      ...wide.map((e) => ({ items: [e], weight: e.type === "quote" ? 0.8 : 1.4 })),
      ...chunk(grid, cols).map((items) => ({ items, weight: 1 })),
    ];
    const weightSum = rows.reduce((a, r) => a + r.weight, 0);
    const freeH = bandH - GUTTER * (rows.length - 1);

    let ry = bandTop;
    for (const row of rows) {
      const rowH = Math.max(80, Math.floor((freeH * row.weight) / weightSum));
      const k = row.items.length;
      const fullRow = k === 1 && FULL_ROW_TYPES.has(row.items[0].type);
      const cellW = fullRow ? BAND_W : Math.floor((BAND_W - GUTTER * (cols - 1)) / Math.max(1, cols));
      const sizes = row.items.map((e) => fitToCell(e.type, cellW, rowH));
      const totalW = sizes.reduce((a, s) => a + s.w, 0) + GUTTER * (k - 1);
      let x = Math.round((STAGE_W - totalW) / 2);
      row.items.forEach((e, i) => {
        const s = sizes[i];
        patch.set(e.id, { x, y: Math.round(ry + (rowH - s.h) / 2), w: s.w, h: s.h, rotation: 0 });
        x += s.w + GUTTER;
      });
      ry += rowH + GUTTER;
    }

    // Normalise: identical types get identical sizes even across rows.
    const minByType = new Map();
    for (const e of grid) {
      const p = patch.get(e.id);
      const m = minByType.get(e.type);
      minByType.set(e.type, m ? { w: Math.min(m.w, p.w), h: Math.min(m.h, p.h) } : { w: p.w, h: p.h });
    }
    for (const e of grid) {
      const p = patch.get(e.id);
      const m = minByType.get(e.type);
      if (p.w !== m.w || p.h !== m.h) {
        patch.set(e.id, { ...p, x: p.x + Math.round((p.w - m.w) / 2), y: p.y + Math.round((p.h - m.h) / 2), w: m.w, h: m.h });
      }
    }

    // Re-centre each grid row horizontally after normalisation.
    const byY = new Map();
    for (const e of grid) {
      const p = patch.get(e.id);
      const key = Math.round((p.y + p.h / 2) / 10);
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key).push(e);
    }
    for (const rowEls of byY.values()) {
      rowEls.sort((a, b) => patch.get(a.id).x - patch.get(b.id).x);
      const total = rowEls.reduce((a, e) => a + patch.get(e.id).w, 0) + GUTTER * (rowEls.length - 1);
      let x = Math.round((STAGE_W - total) / 2);
      for (const e of rowEls) {
        const p = patch.get(e.id);
        patch.set(e.id, { ...p, x });
        x += p.w + GUTTER;
      }
    }
  }

  return elements.map((e) => (patch.has(e.id) ? { ...e, ...patch.get(e.id) } : e));
}
