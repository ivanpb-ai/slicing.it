// ─────────────────────────────────────────────────────────────────────────
// Chart SVG — one pure renderer for every chart kind (the standard
// PowerPoint chart family: column, bar, line, area, column+line combo, pie,
// doughnut, radar, bubble, waterfall). Returns markup, so the same drawing
// serves the Studio canvas (blocks.jsx), the exported HTML presentation
// (export-html.js) and the generated converter-format pages
// (canvas-interop.js). The PowerPoint exporter turns the same model into
// native charts — see export-pptx.js.
//
//   chartMarkup(el) → { legend: [{label, color}], svg: "<svg…>" }
//
// makeChartMarkup(P) is a SELF-CONTAINED factory: export-html.js serialises
// it into the exported presentation with Function.toString(), so nothing in
// it may reference module scope — everything it needs comes from its P
// argument or is defined inside.
// ─────────────────────────────────────────────────────────────────────────
import { P } from "./model";

export function makeChartMarkup(P) {
  const SLICE_COLORS = [P.purple, P.cyan, P.magenta, P.gold, P.green, P.electric, P.orange, P.teal];
  const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace";
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
  const W = 800, H = 340;

  return function chartMarkup(el, opts) {
  const p = el.props || {};
  const kind = p.kind || "area";
  // "Reveal one by one": every data item is wrapped in a <g> that fades in
  // with a staggered delay (stChartIn keyframe, injected globally).
  const animate = !!(opts && opts.animate);
  let itemIdx = 0;
  const item = (inner) => animate
    ? `<g style="opacity:0;animation:stChartIn 0.55s cubic-bezier(0.16,1,0.3,1) ${(0.1 + itemIdx++ * 0.13).toFixed(2)}s forwards">${inner}</g>`
    : inner;
  const series = (p.series || []).map((s) => ({ ...s, values: (s.values || []).map(num) }));
  const xLabels = p.xLabels || [];
  const s0 = series[0] || { label: "", color: P.cyan, values: [] };

  const legend = kind === "pie" || kind === "doughnut"
    ? xLabels.map((l, i) => ({ label: l, color: SLICE_COLORS[i % SLICE_COLORS.length] }))
    : series.map((s) => ({ label: s.label, color: s.color }));

  const gridCol = el.style?.grid || P.faint;
  const axisCol = el.style?.axis || P.muted;
  const axisSize = num(el.style?.axisSize) || 10;
  const mono = esc(MONO);
  const tick = (x, y, text, anchor = "middle") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${axisSize}" fill="${esc(axisCol)}" font-family="${mono}">${esc(text)}</text>`;

  let body = "";
  let defs = "";

  // ── axis frame shared by the x/y kinds ─────────────────────────────────
  const padL = 50, padB = 30, padT = 12, padR = 20;
  const plotW = W - padL - padR, plotH = H - padB - padT;
  const allVals = series.flatMap((s) => s.values);
  // Value domain: negative values extend the axis below a zero baseline.
  const dataMin = Math.min(0, ...allVals, 0);
  const dataMax = Math.max(...allVals, 0);
  // axisMax may stretch the axis but never clip below the data — a stale
  // axisMax (e.g. carried over from another chart kind) must not push bars
  // outside the plot.
  const domain = () => [dataMin, Math.max(p.axisMax || 0, dataMax, dataMin + 1, 1)];
  const yTicks = (lo, hi) => [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = (H - padB) - f * plotH;
    return `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="${esc(gridCol)}" stroke-dasharray="2 4"/>` + tick(padL - 8, y + 4, String(Math.round(lo + f * (hi - lo))), "end");
  }).join("") + (lo < 0
    ? (() => { const zy = (H - padB) - (-lo / (hi - lo)) * plotH; return `<line x1="${padL}" x2="${W - padR}" y1="${zy}" y2="${zy}" stroke="${esc(axisCol)}" stroke-opacity="0.55"/>`; })()
    : "");
  const xCats = (centered) => xLabels.map((l, i) => {
    const x = centered ? padL + ((i + 0.5) / Math.max(1, xLabels.length)) * plotW : padL + (i / Math.max(1, xLabels.length - 1)) * plotW;
    return tick(x, H - 10, l);
  }).join("");

  // Stacked mode (props.stacked): bars pile up per category and areas layer
  // cumulatively, so the axis domain must cover the per-category sums.
  const stacked = !!p.stacked;
  const stackDomain = (list) => {
    const pos = xLabels.map((_, j) => list.reduce((a, s) => a + Math.max(0, num(s.values[j])), 0));
    const neg = xLabels.map((_, j) => list.reduce((a, s) => a + Math.min(0, num(s.values[j])), 0));
    const lo = Math.min(0, ...neg);
    return [lo, Math.max(p.axisMax || 0, ...pos, lo + 1, 1)];
  };

  if (kind === "bar" || kind === "combo") {
    const cols = kind === "combo" ? series.slice(0, -1) : series;
    const lineSeries = kind === "combo" ? series[series.length - 1] : null;
    const [lo, hi] = stacked
      ? (() => { const [l, h] = stackDomain(cols); return [l, Math.max(h, ...(lineSeries ? lineSeries.values : [0]))]; })()
      : domain();
    const yAt = (v) => (H - padB) - ((v - lo) / (hi - lo)) * plotH;
    const n = Math.max(1, xLabels.length);
    body += yTicks(lo, hi) + xCats(true);
    if (stacked) {
      const bw = plotW / n * 0.6;
      const posCum = xLabels.map(() => 0), negCum = xLabels.map(() => 0);
      cols.forEach((s) => {
        body += s.values.map((v, j) => {
          if (!v) return "";
          const from = v >= 0 ? posCum[j] : negCum[j];
          const to = from + v;
          if (v >= 0) posCum[j] = to; else negCum[j] = to;
          const cx = padL + ((j + 0.5) / n) * plotW;
          return item(`<rect x="${cx - bw / 2}" y="${Math.min(yAt(from), yAt(to))}" width="${bw}" height="${Math.max(1, Math.abs(yAt(from) - yAt(to)))}" fill="${esc(s.color)}" rx="1" opacity="0.9"/>`);
        }).join("");
      });
    } else {
      cols.forEach((s, i) => {
        const bw = plotW / n * 0.6 / Math.max(1, cols.length);
        body += s.values.map((v, j) => {
          const cx = padL + ((j + 0.5) / n) * plotW;
          const y0 = yAt(0), y1 = yAt(v);
          return item(`<rect x="${cx - (cols.length * bw) / 2 + i * bw}" y="${Math.min(y0, y1)}" width="${bw * 0.85}" height="${Math.max(1, Math.abs(y0 - y1))}" fill="${esc(s.color)}" rx="2" opacity="0.9"/>`);
        }).join("");
      });
    }
    if (lineSeries) {
      const pts = lineSeries.values.map((v, j) => `${padL + ((j + 0.5) / n) * plotW},${yAt(v)}`);
      body += item(`<polyline points="${pts.join(" ")}" fill="none" stroke="${esc(lineSeries.color)}" stroke-width="2.5"/>`
        + pts.map((pt) => { const [x, y] = pt.split(","); return `<circle cx="${x}" cy="${y}" r="4" fill="${esc(lineSeries.color)}"/>`; }).join(""));
    }
  } else if (kind === "barh") {
    const [lo, hi] = stacked ? stackDomain(series) : domain();
    const padL2 = 110;
    const plotW2 = W - padL2 - padR;
    const xAt = (v) => padL2 + ((v - lo) / (hi - lo)) * plotW2;
    const n = Math.max(1, xLabels.length);
    body += [0, 0.25, 0.5, 0.75, 1].map((f) =>
      `<line y1="${padT}" y2="${H - padB}" x1="${padL2 + f * plotW2}" x2="${padL2 + f * plotW2}" stroke="${esc(gridCol)}" stroke-dasharray="2 4"/>` + tick(padL2 + f * plotW2, H - 10, String(Math.round(lo + f * (hi - lo))))
    ).join("");
    if (lo < 0) body += `<line y1="${padT}" y2="${H - padB}" x1="${xAt(0)}" x2="${xAt(0)}" stroke="${esc(axisCol)}" stroke-opacity="0.55"/>`;
    if (stacked) {
      const bh = plotH / n * 0.6;
      const posCum = xLabels.map(() => 0), negCum = xLabels.map(() => 0);
      series.forEach((s) => {
        body += s.values.map((v, j) => {
          if (!v) return "";
          const from = v >= 0 ? posCum[j] : negCum[j];
          const to = from + v;
          if (v >= 0) posCum[j] = to; else negCum[j] = to;
          const cy = padT + ((j + 0.5) / n) * plotH;
          return item(`<rect x="${Math.min(xAt(from), xAt(to))}" y="${cy - bh / 2}" width="${Math.max(1, Math.abs(xAt(to) - xAt(from)))}" height="${bh}" fill="${esc(s.color)}" rx="1" opacity="0.9"/>`);
        }).join("");
      });
    } else {
      series.forEach((s, i) => {
        const bh = plotH / n * 0.6 / Math.max(1, series.length);
        body += s.values.map((v, j) => {
          const cy = padT + ((j + 0.5) / n) * plotH;
          const x0 = xAt(0), x1 = xAt(v);
          return item(`<rect x="${Math.min(x0, x1)}" y="${cy - (series.length * bh) / 2 + i * bh}" width="${Math.max(1, Math.abs(x1 - x0))}" height="${bh * 0.85}" fill="${esc(s.color)}" rx="2" opacity="0.9"/>`);
        }).join("");
      });
    }
    body += xLabels.map((l, j) => tick(padL2 - 8, padT + ((j + 0.5) / n) * plotH + 4, l, "end")).join("");
  } else if (kind === "line" || kind === "area") {
    const [lo, hi] = kind === "area" && stacked ? stackDomain(series) : domain();
    const n = xLabels.length;
    const xAt = (i) => padL + (i / Math.max(1, n - 1)) * plotW;
    const yAt = (v) => (H - padB) - ((v - lo) / (hi - lo)) * plotH;
    const base = yAt(0); // areas fill to the zero baseline, not the plot floor
    const lineP = (vals) => vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    body += yTicks(lo, hi) + xCats(false);
    if (kind === "area" && stacked) {
      // Each series is a band between the running sum below it and the sum
      // including it (negative values are ignored — stacks are additive).
      let below = xLabels.map(() => 0);
      series.forEach((s, i) => {
        const top = below.map((b, j) => b + Math.max(0, num(s.values[j])));
        defs += `<linearGradient id="cg_${el.id}_${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${esc(s.color)}" stop-opacity="0.85"/><stop offset="100%" stop-color="${esc(s.color)}" stop-opacity="0.25"/></linearGradient>`;
        const topP = top.map((v, j) => `${j === 0 ? "M" : "L"} ${xAt(j)} ${yAt(v)}`).join(" ");
        const belowRev = [...below.keys()].reverse().map((j) => `L ${xAt(j)} ${yAt(below[j])}`).join(" ");
        body += item(`<path d="${topP} ${belowRev} Z" fill="url(#cg_${el.id}_${i})"/>`
          + `<path d="${topP}" fill="none" stroke="${esc(s.color)}" stroke-width="2"/>`);
        below = top;
      });
    } else {
      series.forEach((s, i) => {
        let seg = "";
        if (kind === "area") {
          defs += `<linearGradient id="cg_${el.id}_${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${esc(s.color)}" stop-opacity="0.8"/><stop offset="100%" stop-color="${esc(s.color)}" stop-opacity="0.12"/></linearGradient>`;
          seg += `<path d="${lineP(s.values)} L ${xAt(n - 1)} ${base} L ${xAt(0)} ${base} Z" fill="url(#cg_${el.id}_${i})" opacity="0.7"/>`;
        }
        seg += `<path d="${lineP(s.values)}" fill="none" stroke="${esc(s.color)}" stroke-width="2.5"/>`;
        body += item(seg);
      });
    }
  } else if (kind === "pie" || kind === "doughnut") {
    const cx = W / 2, cy = (H - 8) / 2, R = Math.min(W, H) / 2 - 22;
    const vals = s0.values.slice(0, xLabels.length);
    const total = Math.max(1e-9, vals.reduce((a, b) => a + Math.max(0, b), 0));
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const frac = Math.max(0, v) / total;
      const a1 = a0 + frac * 2 * Math.PI;
      const large = frac > 0.5 ? 1 : 0;
      const [x0, y0] = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)];
      const [x1, y1] = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
      if (frac > 0.999) body += item(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${esc(SLICE_COLORS[i % SLICE_COLORS.length])}"/>`);
      else if (frac > 0) body += item(`<path d="M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z" fill="${esc(SLICE_COLORS[i % SLICE_COLORS.length])}" stroke="${esc(P.deep)}" stroke-width="1.5"/>`);
      a0 = a1;
    });
    if (kind === "doughnut") body += `<circle cx="${cx}" cy="${cy}" r="${R * 0.55}" fill="${esc(el.style?.hole || P.deep)}"/>`;
  } else if (kind === "radar") {
    const cx = W / 2, cy = H / 2 + 4, R = H / 2 - 34;
    const n = Math.max(3, xLabels.length);
    const max = p.axisMax || Math.max(1, ...allVals);
    const pt = (i, r) => { const a = (i / n) * 2 * Math.PI - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    for (const f of [0.25, 0.5, 0.75, 1]) {
      body += `<polygon points="${Array.from({ length: n }, (_, i) => pt(i, R * f).join(",")).join(" ")}" fill="none" stroke="${esc(gridCol)}"/>`;
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, R);
      body += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${esc(gridCol)}"/>`;
      const [lx, ly] = pt(i, R + 18);
      body += tick(lx, ly + 3, xLabels[i] || "");
    }
    series.forEach((s) => {
      const pts = Array.from({ length: n }, (_, i) => pt(i, (Math.max(0, s.values[i] || 0) / max) * R).join(",")).join(" ");
      body += item(`<polygon points="${pts}" fill="${esc(s.color)}" fill-opacity="0.15" stroke="${esc(s.color)}" stroke-width="2"/>`);
    });
  } else if (kind === "bubble") {
    const [lo, hi] = domain();
    const yAt = (v) => (H - padB) - ((v - lo) / (hi - lo)) * plotH;
    const n = Math.max(1, xLabels.length);
    const span = Math.max(Math.abs(lo), Math.abs(hi), 1);
    body += yTicks(lo, hi) + xCats(true);
    series.forEach((s) => {
      body += s.values.map((v, j) => {
        const x = padL + ((j + 0.5) / n) * plotW;
        return item(`<circle cx="${x}" cy="${yAt(v)}" r="${8 + (Math.abs(v) / span) * 20}" fill="${esc(s.color)}" fill-opacity="0.75" stroke="${esc(s.color)}"/>`);
      }).join("");
    });
  } else if (kind === "waterfall") {
    // Values are deltas per category; a Total bar is appended automatically.
    const deltas = s0.values.slice(0, xLabels.length);
    const cum = [];
    deltas.reduce((acc, d, i) => (cum[i] = acc + d), 0);
    const end = cum[cum.length - 1] || 0;
    const lo = Math.min(0, ...cum);
    const hi = Math.max(p.axisMax || 0, ...cum, end, 0, lo + 1, 1);
    const yAt = (v) => (H - padB) - ((v - lo) / (hi - lo)) * plotH;
    const n = deltas.length + 1;
    body += yTicks(lo, hi);
    const bw = plotW / n * 0.6;
    deltas.forEach((d, i) => {
      const from = i === 0 ? 0 : cum[i - 1];
      const to = cum[i];
      const x = padL + ((i + 0.5) / n) * plotW - bw / 2;
      const yTop = yAt(Math.max(from, to));
      const hgt = Math.max(2, Math.abs(yAt(from) - yAt(to)));
      const col = d >= 0 ? s0.color : (el.style?.negative || P.orange);
      body += item(`<rect x="${x}" y="${yTop}" width="${bw}" height="${hgt}" fill="${esc(col)}" rx="2" opacity="0.9"/>`
        + `<line x1="${x + bw}" x2="${x + bw + plotW / n * 0.4}" y1="${yAt(to)}" y2="${yAt(to)}" stroke="${esc(gridCol)}" stroke-dasharray="3 3"/>`
        + tick(x + bw / 2, yTop - 6, String(d)));
      body += tick(padL + ((i + 0.5) / n) * plotW, H - 10, xLabels[i] || "");
    });
    const xT = padL + ((n - 0.5) / n) * plotW - bw / 2;
    const yT0 = yAt(0), yT1 = yAt(end);
    body += item(`<rect x="${xT}" y="${Math.min(yT0, yT1)}" width="${bw}" height="${Math.max(2, Math.abs(yT0 - yT1))}" fill="${esc(el.style?.total || P.purple)}" rx="2"/>`
      + tick(xT + bw / 2, Math.min(yT0, yT1) - 6, String(end))) + tick(padL + ((n - 0.5) / n) * plotW, H - 10, "Total");
  }

  // Horizontal (carousel-style) rotation around the vertical axis.
  const spin = p.rotate ? "animation:stSpinY 26s linear infinite;transform-origin:50% 50%;transform-style:preserve-3d;" : "";
  return {
    legend,
    svg: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;flex:1;min-height:0;${spin}"><defs>${defs}</defs>${body}</svg>`,
  };
  };
}

// Module-level instances for the Studio itself.
export const chartMarkup = makeChartMarkup(P);
export const SLICE_COLORS = [P.purple, P.cyan, P.magenta, P.gold, P.green, P.electric, P.orange, P.teal];
