// ─────────────────────────────────────────────────────────────────────────
// PowerPoint export — converts a Studio presentation to .pptx using the
// HTML→PowerPoint conversion function from slide-converter.html: each slide
// is first serialised to the converter's canvas HTML format
// (canvas-interop.js), then addCanvasPageToPptx — the same parser the
// converter's "Reverse: HTML → PowerPoint" step runs — rebuilds it as native
// PowerPoint shapes, text runs, images and connector lines. Studio charts
// travel as data and become native PowerPoint charts.
//
// pptxgenjs is loaded on demand (dynamic import) so the Studio bundle stays
// lean until the first export.
// ─────────────────────────────────────────────────────────────────────────
import { STAGE_W, STAGE_H } from "./model";
import { slideToCanvasHtml } from "./canvas-interop";
import { SLICE_COLORS } from "./chart-svg";

const EMU_PER_IN = 914400;

function cssLen(v) { const m = /(-?[\d.]+)/.exec(v || ""); return m ? parseFloat(m[1]) : 0; }

function cssColor(c) {
  if (!c) return null;
  c = c.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return { color: m[1].toUpperCase() };
  m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return { color: m[1].split("").map((x) => x + x).join("").toUpperCase() };
  m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)$/i.exec(c);
  if (m) {
    const hex = [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, "0")).join("").toUpperCase();
    const out = { color: hex };
    if (m[4] !== undefined) out.transparency = Math.round((1 - parseFloat(m[4])) * 100);
    return out;
  }
  return null;
}

// Mirrors htmlToPptx in slide-converter.html, generalised to add ONE slide to
// an existing presentation (the converter writes one file per page; a Studio
// deck is many slides in one file) and extended with native chart support.
export function addCanvasPageToPptx(pptx, htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const canvas = doc.querySelector(".canvas");
  if (!canvas) throw new Error("No slide canvas found in the generated page.");

  // Slide geometry + background live in the page's stylesheet
  const css = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("\n");
  const cm = css.match(/\.canvas\s*\{[^}]*aspect-ratio:\s*(\d+)\s*\/\s*(\d+)[^}]*\}/);
  if (!cm) throw new Error("Slide dimensions not found in the page.");
  const W = +cm[1], H = +cm[2];
  const WIn = W / EMU_PER_IN, HIn = H / EMU_PER_IN;
  const bgm = cm[0].match(/background:\s*(#[0-9a-fA-F]{6}|rgba?\([^)]*\))/);
  const bg = bgm ? cssColor(bgm[1]) : null;

  const slide = pptx.addSlide();
  if (bg) slide.background = { color: bg.color };

  const pctX = (v) => v / 100 * WIn;
  const pctY = (v) => v / 100 * HIn;
  const cqwIn = (v) => v / 100 * WIn;

  // Connector lines (SVG overlay, coordinates in EMU)
  doc.querySelectorAll(".connectors line").forEach((ln) => {
    const x1 = +ln.getAttribute("x1") / EMU_PER_IN, y1 = +ln.getAttribute("y1") / EMU_PER_IN;
    const x2 = +ln.getAttribute("x2") / EMU_PER_IN, y2 = +ln.getAttribute("y2") / EMU_PER_IN;
    const col = cssColor(ln.getAttribute("stroke")) || { color: "000000" };
    const wpt = (+ln.getAttribute("stroke-width") || 9525) / EMU_PER_IN * 72;
    slide.addShape(pptx.shapes.LINE, {
      x: Math.min(x1, x2), y: Math.min(y1, y2),
      w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      flipV: (x2 - x1) * (y2 - y1) < 0,
      line: { color: col.color, width: Math.max(wpt, 0.75) },
    });
  });

  // Shapes, text, images and charts
  doc.querySelectorAll(".canvas > .shp").forEach((shp) => {
    const st = shp.style;
    const x = pctX(cssLen(st.left)), y = pctY(cssLen(st.top));
    const w = pctX(cssLen(st.width)), h = pctY(cssLen(st.height));
    if (!w || !h) return;

    const rotM = /rotate\((-?[\d.]+)deg\)/.exec(st.transform || "");
    const rotate = rotM ? ((parseFloat(rotM[1]) % 360) + 360) % 360 : 0;

    const img = shp.querySelector("img");
    if (img) {
      const src = img.getAttribute("src") || "";
      // The converter's pages inline images as data URIs; Studio images may
      // also reference an external URL.
      slide.addImage(src.startsWith("data:") ? { data: src, x, y, w, h, rotate } : { path: src, x, y, w, h, rotate });
      return;
    }

    // Studio charts travel as structured data → native PowerPoint chart.
    const chartAttr = shp.getAttribute("data-chart");
    if (chartAttr) {
      try {
        addNativeChart(pptx, slide, JSON.parse(chartAttr), { x, y, w, h }, bg?.color);
        return;
      } catch { /* fall through to generic handling */ }
    }

    const fill = cssColor(st.background || st.backgroundColor);
    const radius = cssLen(st.borderRadius);
    const borderM = /solid\s+(#[0-9a-fA-F]{6}|rgba?\([^)]*\))/.exec(st.border || "");
    const line = borderM
      ? { color: cssColor(borderM[1]).color, width: Math.max(cqwIn(cssLen(st.border)) * 72, 0.5) }
      : undefined;

    const paras = [...shp.querySelectorAll(".para")];
    const isHeading = shp.classList.contains("title");
    const valign = { "flex-start": "top", center: "middle", "flex-end": "bottom" }[st.justifyContent] || "top";

    const runs = [];
    for (const p of paras) {
      // Per-run styling lives on <span>s; fall back to the paragraph itself
      // for pages generated before run-level fidelity.
      const spans = [...p.querySelectorAll("span")];
      const parts = spans.length ? spans : [p];
      parts.forEach((el, j) => {
        const es = el.style;
        const famRaw = ((es.fontFamily || p.style.fontFamily) || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
        let runFace = null;
        if (/telia sans heading/i.test(famRaw)) runFace = "Telia Sans Heading Heading";
        else if (famRaw && !/^telia sans$/i.test(famRaw)) runFace = famRaw;
        const weight = es.fontWeight || p.style.fontWeight;
        // Exact point size from data-pt when present; otherwise reconstruct
        // from cqw and snap to the nearest half point.
        const dataPt = el.getAttribute && el.getAttribute("data-pt");
        const fontSize = dataPt
          ? parseFloat(dataPt)
          : Math.max(Math.round(cqwIn(cssLen(es.fontSize || p.style.fontSize)) * 72 * 2) / 2, 6);
        const options = {
          fontSize,
          color: (cssColor(es.color || p.style.color) || { color: "121214" }).color,
          bold: weight === "700" || weight === "bold",
          align: p.style.textAlign || "left",
          breakLine: j === parts.length - 1,
        };
        if (runFace) options.fontFace = runFace;
        runs.push({ text: el.textContent, options });
      });
    }

    const opts = {
      x, y, w, h, rotate, valign,
      // PowerPoint resolves fonts by their GDI name (nameID 1):
      // the heading cut is literally "Telia Sans Heading Heading".
      fontFace: isHeading ? "Telia Sans Heading Heading" : "Telia Sans",
      shape: radius > 0 ? pptx.shapes.ROUNDED_RECTANGLE : pptx.shapes.RECTANGLE,
    };
    if (radius > 0) opts.rectRadius = Math.min(cqwIn(radius), Math.min(w, h) / 2);
    if (fill) opts.fill = fill;
    if (line) opts.line = line;

    if (runs.length) slide.addText(runs, opts);
    else if (fill || line) slide.addShape(opts.shape, opts);
  });
}

// Map a Studio chart (props.kind + series) to a native PowerPoint chart —
// every kind offered by the Insert → Chart picker exports as the matching
// PowerPoint chart type.
function addNativeChart(pptx, slide, c, pos, bgHex) {
  const kind = c.kind || "area";
  const series = c.series || [];
  const labels = c.xLabels || [];
  const hex = (col, fallback = "990AE3") => (cssColor(col) || { color: fallback }).color;
  const seriesData = series.map((s) => ({ name: s.label, labels, values: s.values || [] }));
  const seriesColors = series.map((s) => hex(s.color));
  const common = {
    ...pos,
    showLegend: true, legendPos: "t", legendColor: "F4E0FF",
    catAxisLabelColor: "F4E0FF", valAxisLabelColor: "F4E0FF",
    valAxisMaxVal: c.axisMax || undefined,
    catGridLine: { style: "none" }, valGridLine: { color: "3D1556", style: "dash" },
    plotArea: { fill: { color: "29003E", transparency: 100 } },
  };

  switch (kind) {
    case "bar":
      slide.addChart(pptx.charts.BAR, seriesData, { ...common, barDir: "col", chartColors: seriesColors });
      return;
    case "barh":
      slide.addChart(pptx.charts.BAR, seriesData, { ...common, barDir: "bar", chartColors: seriesColors });
      return;
    case "line":
      slide.addChart(pptx.charts.LINE, seriesData, { ...common, chartColors: seriesColors, lineSize: 2.5 });
      return;
    case "combo": {
      // Columns for every series but the last, which draws as the line —
      // same convention as the canvas renderer.
      const cols = seriesData.slice(0, -1), lineS = seriesData.slice(-1);
      if (!cols.length || !lineS.length) break;
      slide.addChart([
        { type: pptx.charts.BAR, data: cols, options: { barDir: "col", chartColors: seriesColors.slice(0, -1) } },
        { type: pptx.charts.LINE, data: lineS, options: { chartColors: seriesColors.slice(-1), lineSize: 2.5 } },
      ], common);
      return;
    }
    case "pie":
    case "doughnut": {
      const first = seriesData.slice(0, 1);
      if (!first.length) break;
      slide.addChart(kind === "pie" ? pptx.charts.PIE : pptx.charts.DOUGHNUT, first, {
        ...common, holeSize: kind === "doughnut" ? 55 : undefined,
        chartColors: labels.map((_, i) => hex(SLICE_COLORS[i % SLICE_COLORS.length])),
        dataLabelColor: "F4E0FF",
      });
      return;
    }
    case "radar":
      slide.addChart(pptx.charts.RADAR, seriesData, { ...common, radarStyle: "standard", chartColors: seriesColors });
      return;
    case "bubble":
      // First entry supplies the X positions; each series contributes Y values
      // with the value doubling as the bubble size (matches the canvas).
      slide.addChart(pptx.charts.BUBBLE, [
        { name: "X-Axis", values: labels.map((_, i) => i + 1) },
        ...series.map((s) => ({ name: s.label, values: s.values || [], sizes: (s.values || []).map((v) => Math.max(0.1, v)) })),
      ], { ...common, chartColors: seriesColors });
      return;
    case "waterfall": {
      // PowerPoint (pre-2016 format) has no native waterfall: build the
      // classic stacked-bar equivalent — an invisible base series (slide
      // background colour) carrying visible delta bars, plus a Total column.
      const deltas = (series[0]?.values || []).slice(0, labels.length);
      const cum = [];
      deltas.reduce((acc, d, i) => (cum[i] = acc + d), 0);
      const end = cum[cum.length - 1] || 0;
      const base = deltas.map((d, i) => Math.min(i === 0 ? 0 : cum[i - 1], cum[i])).concat(0);
      const mag = deltas.map((d) => Math.abs(d)).concat(end);
      const wLabels = [...labels, "Total"];
      slide.addChart(pptx.charts.BAR, [
        { name: "", labels: wLabels, values: base },
        { name: series[0]?.label || "Change", labels: wLabels, values: mag },
      ], {
        ...common, barDir: "col", barGrouping: "stacked", showLegend: false,
        chartColors: [bgHex || "29003E", hex(series[0]?.color, "00D4FF")],
        valAxisMaxVal: c.axisMax || undefined,
      });
      return;
    }
    default:
      break;
  }
  // Fallback (unknown kind / degenerate data): area chart of whatever we have.
  slide.addChart(pptx.charts.AREA, seriesData, { ...common, chartColors: seriesColors });
}

// ── Deck → .pptx download ───────────────────────────────────────────────────
export async function exportDeckPptx(deck) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "STAGE", width: STAGE_W / 96, height: STAGE_H / 96 }); // 1280×720 px @96dpi = 13.33"×7.5"
  pptx.layout = "STAGE";
  pptx.title = deck.title || "Presentation";

  for (const slide of deck.slides) addCanvasPageToPptx(pptx, slideToCanvasHtml(slide));

  const safe = (deck.title || "presentation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "presentation";
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}
