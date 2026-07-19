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
  const mono = esc(MONO);
  const tick = (x, y, text, anchor = "middle") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="10" fill="${esc(axisCol)}" font-family="${mono}">${esc(text)}</text>`;

  let body = "";
  let defs = "";

  // ── axis frame shared by the x/y kinds ─────────────────────────────────
  const padL = 50, padB = 30, padT = 12, padR = 20;
  const plotW = W - padL - padR, plotH = H - padB - padT;
  const allVals = series.flatMap((s) => s.values);
  const yTicks = (max) => [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = (H - padB) - f * plotH;
    return `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="${esc(gridCol)}" stroke-dasharray="2 4"/>` + tick(padL - 8, y + 4, String(Math.round(max * f)), "end");
  }).join("");
  const xCats = (centered) => xLabels.map((l, i) => {
    const x = centered ? padL + ((i + 0.5) / Math.max(1, xLabels.length)) * plotW : padL + (i / Math.max(1, xLabels.length - 1)) * plotW;
    return tick(x, H - 10, l);
  }).join("");

  if (kind === "bar" || kind === "combo") {
    const max = p.axisMax || Math.max(1, ...allVals);
    const yAt = (v) => (H - padB) - (v / max) * plotH;
    const n = Math.max(1, xLabels.length);
    const cols = kind === "combo" ? series.slice(0, -1) : series;
    const lineSeries = kind === "combo" ? series[series.length - 1] : null;
    body += yTicks(max) + xCats(true);
    cols.forEach((s, i) => {
      const bw = plotW / n * 0.6 / Math.max(1, cols.length);
      body += s.values.map((v, j) => {
        const cx = padL + ((j + 0.5) / n) * plotW;
        return item(`<rect x="${cx - (cols.length * bw) / 2 + i * bw}" y="${yAt(v)}" width="${bw * 0.85}" height="${(H - padB) - yAt(v)}" fill="${esc(s.color)}" rx="2" opacity="0.9"/>`);
      }).join("");
    });
    if (lineSeries) {
      const pts = lineSeries.values.map((v, j) => `${padL + ((j + 0.5) / n) * plotW},${yAt(v)}`);
      body += item(`<polyline points="${pts.join(" ")}" fill="none" stroke="${esc(lineSeries.color)}" stroke-width="2.5"/>`
        + pts.map((pt) => { const [x, y] = pt.split(","); return `<circle cx="${x}" cy="${y}" r="4" fill="${esc(lineSeries.color)}"/>`; }).join(""));
    }
  } else if (kind === "barh") {
    const max = p.axisMax || Math.max(1, ...allVals);
    const padL2 = 110;
    const plotW2 = W - padL2 - padR;
    const xAt = (v) => padL2 + (v / max) * plotW2;
    const n = Math.max(1, xLabels.length);
    body += [0, 0.25, 0.5, 0.75, 1].map((f) =>
      `<line y1="${padT}" y2="${H - padB}" x1="${xAt(max * f)}" x2="${xAt(max * f)}" stroke="${esc(gridCol)}" stroke-dasharray="2 4"/>` + tick(xAt(max * f), H - 10, String(Math.round(max * f)))
    ).join("");
    series.forEach((s, i) => {
      const bh = plotH / n * 0.6 / Math.max(1, series.length);
      body += s.values.map((v, j) => {
        const cy = padT + ((j + 0.5) / n) * plotH;
        return item(`<rect x="${padL2}" y="${cy - (series.length * bh) / 2 + i * bh}" width="${xAt(v) - padL2}" height="${bh * 0.85}" fill="${esc(s.color)}" rx="2" opacity="0.9"/>`);
      }).join("");
    });
    body += xLabels.map((l, j) => tick(padL2 - 8, padT + ((j + 0.5) / n) * plotH + 4, l, "end")).join("");
  } else if (kind === "line" || kind === "area") {
    const max = p.axisMax || Math.max(1, ...allVals);
    const n = xLabels.length;
    const xAt = (i) => padL + (i / Math.max(1, n - 1)) * plotW;
    const yAt = (v) => (H - padB) - (v / max) * plotH;
    const lineP = (vals) => vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    body += yTicks(max) + xCats(false);
    series.forEach((s, i) => {
      let seg = "";
      if (kind === "area") {
        defs += `<linearGradient id="cg_${el.id}_${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${esc(s.color)}" stop-opacity="0.8"/><stop offset="100%" stop-color="${esc(s.color)}" stop-opacity="0.12"/></linearGradient>`;
        seg += `<path d="${lineP(s.values)} L ${xAt(n - 1)} ${H - padB} L ${xAt(0)} ${H - padB} Z" fill="url(#cg_${el.id}_${i})" opacity="0.7"/>`;
      }
      seg += `<path d="${lineP(s.values)}" fill="none" stroke="${esc(s.color)}" stroke-width="2.5"/>`;
      body += item(seg);
    });
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
    const max = p.axisMax || Math.max(1, ...allVals);
    const yAt = (v) => (H - padB) - (v / max) * plotH;
    const n = Math.max(1, xLabels.length);
    body += yTicks(max) + xCats(true);
    series.forEach((s) => {
      body += s.values.map((v, j) => {
        const x = padL + ((j + 0.5) / n) * plotW;
        return item(`<circle cx="${x}" cy="${yAt(v)}" r="${8 + (Math.max(0, v) / max) * 20}" fill="${esc(s.color)}" fill-opacity="0.75" stroke="${esc(s.color)}"/>`);
      }).join("");
    });
  } else if (kind === "waterfall") {
    // Values are deltas per category; a Total bar is appended automatically.
    const deltas = s0.values.slice(0, xLabels.length);
    const cum = [];
    deltas.reduce((acc, d, i) => (cum[i] = acc + d), 0);
    const end = cum[cum.length - 1] || 0;
    const max = p.axisMax || Math.max(1, ...cum, end);
    const yAt = (v) => (H - padB) - (Math.max(0, v) / max) * plotH;
    const n = deltas.length + 1;
    body += yTicks(max);
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
    body += item(`<rect x="${xT}" y="${yAt(end)}" width="${bw}" height="${(H - padB) - yAt(end)}" fill="${esc(el.style?.total || P.purple)}" rx="2"/>`
      + tick(xT + bw / 2, yAt(end) - 6, String(end))) + tick(padL + ((n - 0.5) / n) * plotW, H - 10, "Total");
  }

  const spin = p.rotate ? "animation:stSpin 40s linear infinite;transform-origin:50% 50%;" : "";
  return {
    legend,
    svg: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;flex:1;min-height:0;${spin}"><defs>${defs}</defs>${body}</svg>`,
  };
  };
}

// Module-level instances for the Studio itself.
export const chartMarkup = makeChartMarkup(P);
export const SLICE_COLORS = [P.purple, P.cyan, P.magenta, P.gold, P.green, P.electric, P.orange, P.teal];
