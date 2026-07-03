import { readFile } from "node:fs/promises";
import JSZip from "jszip";

const EMU_PER_IN = 914400;

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/**
 * Parse a .pptx into a *faithful* visual model. Rather than re-flowing
 * content, every drawable (shape, picture, connector) is captured with its
 * absolute geometry and resolved styling so the generator can reproduce the
 * slide as a scaled canvas:
 *
 * slide = {
 *   title, width, height,          // EMU
 *   bg,                            // css color (slide → layout → master)
 *   shapes: [{
 *     kind: "shape"|"image"|"line",
 *     x, y, w, h,                  // absolute EMU (group transforms applied)
 *     rot, flipH, flipV,
 *     fill, stroke: {color,w}, radius,
 *     paras: [{text, algn}], textPlain, fontSize, bold, color, anchor,
 *     image: {dataUri, alt},
 *   }]
 * }
 */
export async function parsePptx(filePath) {
  const buf = await readFile(filePath);
  const zip = await JSZip.loadAsync(buf);

  let slideW = 12192000,
    slideH = 6858000;
  const presFile = zip.file("ppt/presentation.xml");
  if (presFile) {
    const m = (await presFile.async("string")).match(
      /<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/
    );
    if (m) {
      slideW = +m[1];
      slideH = +m[2];
    }
  }

  const theme = await loadTheme(zip);

  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => num(a) - num(b));

  const slides = [];
  for (const sf of slideFiles) {
    const xml = await zip.file(sf).async("string");
    const rels = await readRels(zip, sf);
    const embeds = await readEmbeds(zip, rels);

    // Layout + master (placeholder geometry & background inheritance)
    let layoutXml = "",
      masterXml = "";
    const layoutTarget = Object.values(rels).find((t) =>
      /slideLayout/.test(t)
    );
    if (layoutTarget) {
      const layoutPath = "ppt/" + layoutTarget.replace(/^(\.\.\/)+/, "");
      layoutXml = (await zip.file(layoutPath)?.async("string")) || "";
      const lrels = await readRels(zip, layoutPath);
      const masterTarget = Object.values(lrels).find((t) =>
        /slideMaster/.test(t)
      );
      if (masterTarget) {
        masterXml =
          (await zip
            .file("ppt/" + masterTarget.replace(/^(\.\.\/)+/, ""))
            ?.async("string")) || "";
      }
    }

    slides.push(
      buildSlide(xml, layoutXml, masterXml, slideW, slideH, theme, embeds)
    );
  }
  return slides;
}

function num(s) {
  return parseInt(s.match(/slide(\d+)/)[1], 10);
}

async function readRels(zip, path) {
  const parts = path.split("/");
  const relsPath =
    parts.slice(0, -1).join("/") + "/_rels/" + parts[parts.length - 1] + ".rels";
  const f = zip.file(relsPath);
  if (!f) return {};
  const xml = await f.async("string");
  const out = {};
  for (const m of xml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g))
    out[m[1]] = m[2];
  return out;
}

async function readEmbeds(zip, rels) {
  const embeds = {};
  for (const [id, target] of Object.entries(rels)) {
    const ext = target.split(".").pop().toLowerCase();
    const mime = MIME[ext];
    if (!mime) continue;
    const f = zip.file("ppt/" + target.replace(/^(\.\.\/)+/, ""));
    if (!f) continue;
    embeds[id] = `data:${mime};base64,${await f.async("base64")}`;
  }
  return embeds;
}

// ---------- Theme colors ----------------------------------------------------

async function loadTheme(zip) {
  const path = Object.keys(zip.files).find((f) =>
    /^ppt\/theme\/theme1\.xml$/.test(f)
  );
  const colors = {};
  if (path) {
    const xml = await zip.file(path).async("string");
    const scheme = (xml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/) || [
      "",
    ])[0];
    for (const m of scheme.matchAll(
      /<a:(dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink)>\s*<a:(?:srgbClr val="([0-9A-Fa-f]{6})"|sysClr[^>]*lastClr="([0-9A-Fa-f]{6})")/g
    ))
      colors[m[1]] = "#" + (m[2] || m[3]);
  }
  return colors;
}

const SCHEME_MAP = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" };

// Resolve the first color inside an XML snippet (srgbClr or schemeClr),
// applying lumMod/lumOff/shade/tint/alpha modifiers.
export function resolveColor(snippet, theme) {
  if (!snippet) return null;
  const m = snippet.match(
    /<a:(srgbClr|schemeClr)\s+val="([^"]+)"\s*(\/>|>([\s\S]*?)<\/a:\1>)/
  );
  if (!m) return null;
  let hex;
  if (m[1] === "srgbClr") hex = "#" + m[2];
  else {
    const name = SCHEME_MAP[m[2]] || m[2];
    hex = theme[name];
    if (!hex) return null;
  }
  const mods = m[4] || "";
  let [r, g, b] = hexRgb(hex);
  const val = (tag) => {
    const mm = mods.match(new RegExp(`<a:${tag} val="(\\d+)"`));
    return mm ? +mm[1] / 100000 : null;
  };
  const shade = val("shade");
  if (shade !== null) [r, g, b] = [r, g, b].map((c) => c * shade);
  const tint = val("tint");
  if (tint !== null) [r, g, b] = [r, g, b].map((c) => c * tint + 255 * (1 - tint));
  const lumMod = val("lumMod");
  const lumOff = val("lumOff");
  if (lumMod !== null || lumOff !== null) {
    let [h, s, l] = rgbHsl(r, g, b);
    l = l * (lumMod ?? 1) + (lumOff ?? 0);
    [r, g, b] = hslRgb(h, s, Math.max(0, Math.min(1, l)));
  }
  const alpha = val("alpha");
  const to = (c) => Math.round(Math.max(0, Math.min(255, c)));
  if (alpha !== null && alpha < 1)
    return `rgba(${to(r)},${to(g)},${to(b)},${alpha.toFixed(3)})`;
  return (
    "#" + [r, g, b].map((c) => to(c).toString(16).padStart(2, "0")).join("")
  );
}

function hexRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
function rgbHsl(r, g, b) {
  (r /= 255), (g /= 255), (b /= 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// ---------- XML block walking (handles nested groups) ------------------------

const CHILD_TAGS = ["sp", "pic", "cxnSp", "grpSp"];

function validBoundary(xml, idx, open) {
  const c = xml[idx + open.length];
  return c === " " || c === ">" || c === "\r" || c === "\n" || c === "/";
}

function nextIndexOf(xml, open, from) {
  let i = from;
  while (true) {
    const j = xml.indexOf(open, i);
    if (j === -1) return -1;
    if (validBoundary(xml, j, open)) return j;
    i = j + open.length;
  }
}

function findClose(xml, start, tag) {
  const open = "<p:" + tag;
  const close = "</p:" + tag + ">";
  let depth = 0,
    i = start;
  while (i < xml.length) {
    const o = nextIndexOf(xml, open, i);
    const c = xml.indexOf(close, i);
    if (c === -1) return xml.length;
    if (o !== -1 && o < c) {
      depth++;
      i = o + open.length;
    } else {
      depth--;
      i = c + close.length;
      if (depth === 0) return i;
    }
  }
  return xml.length;
}

function* childBlocks(xml) {
  let i = 0;
  while (i < xml.length) {
    let bestTag = null,
      bestIdx = -1;
    for (const tag of CHILD_TAGS) {
      const j = nextIndexOf(xml, "<p:" + tag, i);
      if (j !== -1 && (bestIdx === -1 || j < bestIdx)) {
        bestIdx = j;
        bestTag = tag;
      }
    }
    if (bestIdx === -1) return;
    const end = findClose(xml, bestIdx, bestTag);
    yield { tag: bestTag, xml: xml.slice(bestIdx, end) };
    i = end;
  }
}

// ---------- Shape property extraction ----------------------------------------

function xfrmOf(xml) {
  const x = xml.match(/<a:xfrm([^>]*)>([\s\S]*?)<\/a:xfrm>/);
  if (!x) return null;
  const attrs = x[1],
    body = x[2];
  const g = (re) => {
    const m = body.match(re);
    return m ? m.slice(1).map(Number) : null;
  };
  const off = g(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"/);
  const ext = g(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
  const chOff = g(/<a:chOff\s+x="(-?\d+)"\s+y="(-?\d+)"/);
  const chExt = g(/<a:chExt\s+cx="(\d+)"\s+cy="(\d+)"/);
  const rot = attrs.match(/rot="(-?\d+)"/);
  return {
    off: off && { x: off[0], y: off[1] },
    ext: ext && { cx: ext[0], cy: ext[1] },
    chOff: chOff && { x: chOff[0], y: chOff[1] },
    chExt: chExt && { cx: chExt[0], cy: chExt[1] },
    rot: rot ? +rot[1] / 60000 : 0,
    flipH: /flipH="1"/.test(attrs),
    flipV: /flipV="1"/.test(attrs),
  };
}

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

// Extract paragraphs preserving *per-run* styling (size, bold, color,
// typeface) — a single paragraph often mixes a bold lead-in with regular
// body text, and flattening it loses the visual hierarchy.
function extractParas(xml, theme) {
  const paras = [];
  let fontSize = 0,
    bold = false,
    color = null; // shape-level dominants, used as defaults
  for (const pm of xml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)) {
    const para = pm[0];
    const algn = (para.match(/<a:pPr[^>]*algn="([^"]+)"/) || [])[1] || null;
    const runs = [];
    for (const rm of para.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)) {
      const run = rm[1];
      const t = run.match(/<a:t>([\s\S]*?)<\/a:t>/);
      if (!t) continue;
      const rPr = (run.match(/<a:rPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:rPr>)/) || [
        "",
      ])[0];
      const sz = rPr.match(/sz="(\d+)"/);
      const size = sz ? +sz[1] / 100 : null;
      const rBold = /\bb="1"/.test(rPr);
      const face = (rPr.match(/<a:latin typeface="([^"]+)"/) || [])[1] || null;
      const fill = (rPr.match(/<a:solidFill>[\s\S]*?<\/a:solidFill>/) || [
        "",
      ])[0];
      const rColor = resolveColor(fill, theme);
      // Preserve interior spacing (it may be a deliberate separator);
      // only normalise line breaks/tabs.
      const text = decode(t[1]).replace(/[\t\r\n]+/g, " ");
      runs.push({ text, size, bold: rBold, color: rColor, face });
      if (size) fontSize = Math.max(fontSize, size);
      if (rBold) bold = true;
      if (!color && rColor) color = rColor;
    }
    // Trim the paragraph's outer edges but keep spacing between runs.
    if (runs.length) {
      runs[0].text = runs[0].text.replace(/^\s+/, "");
      runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, "");
    }
    const textJoined = runs.map((r) => r.text).join("");
    if (textJoined.trim()) {
      paras.push({
        algn,
        face: (runs.find((r) => r.face) || {}).face || null,
        runs: runs.filter((r) => r.text),
      });
    }
  }
  return { paras, fontSize, bold, color };
}

function fillOf(spPr, theme) {
  // strip line + effect defs so we read the shape's own fill only
  const own = spPr
    .replace(/<a:ln\b[\s\S]*?<\/a:ln>/g, "")
    .replace(/<a:effectLst[\s\S]*?<\/a:effectLst>/g, "");
  if (/<a:noFill\/>/.test(own)) return null;
  const solid = (own.match(/<a:solidFill>[\s\S]*?<\/a:solidFill>/) || [""])[0];
  if (solid) return resolveColor(solid, theme);
  const grad = (own.match(/<a:gradFill[\s\S]*?<\/a:gradFill>/) || [""])[0];
  if (grad) {
    const gs = (grad.match(/<a:gs [^>]*>[\s\S]*?<\/a:gs>/) || [""])[0];
    return resolveColor(gs, theme);
  }
  return undefined; // no explicit fill → inherit (we treat as none)
}

function strokeOf(spPr, theme) {
  const ln = (spPr.match(/<a:ln\b[\s\S]*?<\/a:ln>/) || [""])[0];
  if (!ln || /<a:noFill\/>/.test(ln)) return null;
  const color = resolveColor(ln, theme);
  if (!color) return null;
  const w = ln.match(/w="(\d+)"/);
  return { color, w: w ? +w[1] : 9525 };
}

// ---------- Slide assembly ----------------------------------------------------

function placeholderXfrms(xml) {
  const map = {};
  if (!xml) return map;
  const tree = between(xml, "<p:spTree", "</p:spTree>") || xml;
  for (const blk of childBlocks(tree)) {
    if (blk.tag !== "sp") continue;
    const ph = blk.xml.match(/<p:ph\s+([^>]*)\/>/);
    if (!ph) continue;
    const type = (ph[1].match(/type="([^"]+)"/) || [])[1] || "body";
    const idx = (ph[1].match(/idx="([^"]+)"/) || [])[1];
    const xf = xfrmOf(blk.xml);
    if (!xf || !xf.off || !xf.ext) continue;
    if (idx !== undefined) map["idx:" + idx] = xf;
    map["type:" + type] = map["type:" + type] || xf;
  }
  return map;
}

function slideBg(xml, theme) {
  if (!xml) return null;
  const bg = (xml.match(/<p:bg>[\s\S]*?<\/p:bg>/) || [""])[0];
  if (!bg) return null;
  return resolveColor(bg, theme);
}

function buildSlide(xml, layoutXml, masterXml, slideW, slideH, theme, embeds) {
  const spTree = between(xml, "<p:spTree", "</p:spTree>") || xml;
  const phLayout = placeholderXfrms(layoutXml);
  const phMaster = placeholderXfrms(masterXml);

  const bg =
    slideBg(xml, theme) ||
    slideBg(layoutXml, theme) ||
    slideBg(masterXml, theme) ||
    "#FFFFFF";

  const shapes = [];
  let title = "";

  const identity = { offX: 0, offY: 0, chOffX: 0, chOffY: 0, sx: 1, sy: 1 };

  const walk = (frag, ctx) => {
    for (const blk of childBlocks(frag)) {
      if (blk.tag === "grpSp") {
        const inner = blk.xml.slice(
          blk.xml.indexOf("</p:grpSpPr>") + "</p:grpSpPr>".length,
          blk.xml.lastIndexOf("</p:grpSp>")
        );
        const xf = xfrmOf(blk.xml);
        if (!xf || !xf.off || !xf.ext || !xf.chExt) {
          walk(inner, ctx);
          continue;
        }
        const offX = ctx.offX + (xf.off.x - ctx.chOffX) * ctx.sx;
        const offY = ctx.offY + (xf.off.y - ctx.chOffY) * ctx.sy;
        walk(inner, {
          offX,
          offY,
          chOffX: xf.chOff ? xf.chOff.x : 0,
          chOffY: xf.chOff ? xf.chOff.y : 0,
          sx: ctx.sx * (xf.ext.cx / xf.chExt.cx),
          sy: ctx.sy * (xf.ext.cy / xf.chExt.cy),
        });
        continue;
      }

      let xf = xfrmOf(blk.xml);
      const phM = blk.xml.match(/<p:ph\s+([^>]*)\/>/);
      let phType = null;
      if (phM) {
        phType = (phM[1].match(/type="([^"]+)"/) || [])[1] || "body";
        const idx = (phM[1].match(/idx="([^"]+)"/) || [])[1];
        if (!xf || !xf.off) {
          xf =
            (idx !== undefined && (phLayout["idx:" + idx] || phMaster["idx:" + idx])) ||
            phLayout["type:" + phType] ||
            phMaster["type:" + phType] ||
            xf;
        }
      }
      if (!xf || !xf.off || !xf.ext) continue;

      const x = ctx.offX + (xf.off.x - ctx.chOffX) * ctx.sx;
      const y = ctx.offY + (xf.off.y - ctx.chOffY) * ctx.sy;
      const w = xf.ext.cx * ctx.sx;
      const h = xf.ext.cy * ctx.sy;

      if (blk.tag === "pic") {
        const embed = (blk.xml.match(/r:embed="([^"]+)"/) || [])[1];
        const dataUri = embed && embeds[embed];
        if (!dataUri) continue;
        const alt = (blk.xml.match(/name="([^"]*)"/) || [])[1] || "";
        shapes.push({
          kind: "image",
          x, y, w, h,
          rot: xf.rot, flipH: xf.flipH, flipV: xf.flipV,
          image: { dataUri, alt },
        });
        continue;
      }

      const spPr = (blk.xml.match(/<p:spPr>[\s\S]*?<\/p:spPr>/) || [""])[0];
      const prst = (spPr.match(/<a:prstGeom prst="([^"]+)"/) || [])[1] || "";
      const stroke = strokeOf(spPr, theme);

      if (
        blk.tag === "cxnSp" ||
        prst === "line" ||
        prst.startsWith("straightConnector") ||
        prst.startsWith("bentConnector")
      ) {
        shapes.push({
          kind: "line",
          x, y, w, h,
          flipH: xf.flipH, flipV: xf.flipV, rot: xf.rot,
          stroke: stroke || { color: "#000000", w: 9525 },
        });
        continue;
      }

      const fill = fillOf(spPr, theme);
      let { paras, fontSize, bold, color } = extractParas(blk.xml, theme);
      if (!color) {
        // Default text color comes from the shape style's fontRef.
        const fontRef = (blk.xml.match(
          /<a:fontRef[\s\S]*?<\/a:fontRef>/
        ) || [""])[0];
        color = resolveColor(fontRef, theme);
      }
      const bodyPr = (blk.xml.match(/<a:bodyPr[^>]*>/) || [""])[0];
      const anchor = (bodyPr.match(/anchor="([^"]+)"/) || [])[1] || "t";
      // Text insets (EMU) — PowerPoint defaults are 0.1" l/r, 0.05" t/b,
      // but shapes often set them to 0 to fit tight labels.
      const ins = (name, def) => {
        const m = bodyPr.match(new RegExp(name + '="(-?\\d+)"'));
        return m ? +m[1] : def;
      };
      const insets = {
        l: ins("lIns", 91440),
        t: ins("tIns", 45720),
        r: ins("rIns", 91440),
        b: ins("bIns", 45720),
      };

      let radius = 0;
      if (prst === "roundRect" || prst === "round2SameRect") {
        const adj = spPr.match(/<a:gd name="adj"[^>]*fmla="val (\d+)"/);
        radius = Math.min(w, h) * ((adj ? +adj[1] : 16667) / 100000);
      } else if (prst === "ellipse") {
        radius = Math.max(w, h); // renders as a circle/ellipse
      }

      const textPlain = paras
        .map((p) => p.runs.map((r) => r.text).join(""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!textPlain && fill == null && !stroke) continue; // invisible helper box

      if (phType === "title" || phType === "ctrTitle") {
        title = textPlain || title;
      }

      shapes.push({
        kind: "shape",
        x, y, w, h,
        rot: xf.rot, flipH: xf.flipH, flipV: xf.flipV,
        fill: fill ?? null,
        stroke,
        radius,
        paras,
        textPlain,
        fontSize:
          fontSize ||
          (phType === "title" || phType === "ctrTitle" ? 34 : 18),
        bold,
        color,
        anchor,
        insets,
        isTitle: phType === "title" || phType === "ctrTitle",
      });
    }
  };

  walk(spTree, identity);

  if (!title) {
    // fall back: largest text near the top
    let best = null;
    for (const s of shapes)
      if (s.kind === "shape" && s.textPlain && s.y < 0.25 * slideH)
        if (!best || s.fontSize > best.fontSize) best = s;
    if (best) title = best.textPlain;
  }

  return { title, width: slideW, height: slideH, bg, shapes };
}

function between(xml, startTag, endTag) {
  const i = xml.indexOf(startTag);
  if (i === -1) return null;
  const j = xml.indexOf(endTag, i);
  if (j === -1) return null;
  return xml.slice(i, j + endTag.length);
}
