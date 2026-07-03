// ─────────────────────────────────────────────────────────────────────────
// Export a deck as a complete, self-contained HTML presentation.
//
// The exported file embeds the deck JSON plus a dependency-free player that
// mirrors present mode: live backgrounds, every block type, entrance + idle
// animations, slide transitions and keyboard / click / dot navigation. It is
// a single file — share it, open it from disk, or host it anywhere. Fonts
// load from northstar-program.com when online and fall back to system fonts.
//
// The player is written below as a real function (PLAYER) and serialised into
// the file with Function.toString(), so it stays plain readable JS here. It
// must remain fully self-contained: no imports, no references to outer scope —
// everything it needs arrives via its (deck, P) arguments or is defined inside.
// ─────────────────────────────────────────────────────────────────────────
import { P } from "../palette";
import { KEYFRAMES } from "./effects";

/* eslint-disable no-var */
function PLAYER(DECK, P) {
  var STAGE_W = 1280, STAGE_H = 720, TRANS_DUR = 0.9;
  var TR_CSS = "opacity " + TRANS_DUR + "s cubic-bezier(0.16,1,0.3,1), transform " + TRANS_DUR + "s cubic-bezier(0.16,1,0.3,1)";
  var FONTS = {
    head: "'Telia Sans Heading','Telia Sans',system-ui,sans-serif",
    body: "'Telia Sans',system-ui,sans-serif",
    mono: "'JetBrains Mono',ui-monospace,'SFMono-Regular',monospace",
  };
  var EASES = { out: "cubic-bezier(0.16,1,0.3,1)", inout: "cubic-bezier(0.65,0,0.35,1)", back: "cubic-bezier(0.34,1.56,0.64,1)", linear: "linear" };
  var UNITLESS = { opacity: 1, lineHeight: 1, fontWeight: 1, zIndex: 1, flex: 1, flexShrink: 1, flexGrow: 1 };

  // ── tiny DOM helpers ──────────────────────────────────────────────────
  function css(node, style) {
    for (var k in style) {
      var v = style[k];
      if (v == null) continue;
      node.style[k] = typeof v === "number" && !UNITLESS[k] ? v + "px" : String(v);
    }
    return node;
  }
  function div(style, parent) {
    var n = document.createElement("div");
    if (style) css(n, style);
    if (parent) parent.appendChild(n);
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function svg(markup, style) {
    var wrap = document.createElement("div");
    wrap.innerHTML = markup;
    var node = wrap.firstChild;
    if (style) css(node, style);
    return node;
  }
  function justify(a) { return a === "left" ? "flex-start" : a === "right" ? "flex-end" : "center"; }
  function hexToRgb(hex) {
    if (typeof hex !== "string") return [120, 30, 170];
    var m = hex.replace("#", "");
    if (m.length === 6) return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
    var rg = hex.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (rg) return [+rg[1], +rg[2], +rg[3]];
    return [120, 30, 170];
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function countUp(to, dur, tick) {
    var start = performance.now();
    function step(now) {
      var p = Math.min(1, (now - start) / (dur * 1000));
      tick((1 - Math.pow(1 - p, 3)) * to);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── entrance / idle (mirrors studio effects.js) ───────────────────────
  var HIDDEN = {
    none: { o: 1, t: "none", f: "none" },
    fade: { o: 0, t: "none", f: "none" },
    "fade-up": { o: 0, t: "translateY(42px)", f: "none" },
    "fade-down": { o: 0, t: "translateY(-42px)", f: "none" },
    "fade-left": { o: 0, t: "translateX(42px)", f: "none" },
    "fade-right": { o: 0, t: "translateX(-42px)", f: "none" },
    "zoom-in": { o: 0, t: "scale(0.82)", f: "none" },
    "zoom-out": { o: 0, t: "scale(1.16)", f: "none" },
    "blur-in": { o: 0, t: "none", f: "blur(16px)" },
    "flip-up": { o: 0, t: "perspective(900px) rotateX(38deg)", f: "none" },
    rise: { o: 0, t: "translateY(64px) scale(0.96)", f: "none" },
    pop: { o: 0, t: "scale(0.5)", f: "none" },
  };
  function entranceCss(anim, active) {
    var dur = anim && anim.duration != null ? anim.duration : 0.6;
    var delay = active ? (anim && anim.delay ? anim.delay : 0) : 0;
    var ease = EASES[anim && anim.ease] || EASES.out;
    return "opacity " + dur + "s " + ease + " " + delay + "s, transform " + dur + "s " + ease + " " + delay + "s, filter " + dur + "s " + ease + " " + delay + "s";
  }
  function idleAnim(idle) {
    switch (idle) {
      case "float": return "stFloat 5s ease-in-out infinite";
      case "sway": return "stSway 6s ease-in-out infinite";
      case "pulse": return "stPulse 2.6s ease-in-out infinite";
      case "breathe": return "stBreathe 5s ease-in-out infinite";
      case "spin": return "stSpin 20s linear infinite";
      case "glow": return "stGlow 3.2s ease-in-out infinite";
      default: return "none";
    }
  }

  // ── block renderers (mirror studio blocks.jsx; return {node, activate?}) ─
  var RENDER = {
    heading: function (el) {
      var s = el.style, grad = el.props.gradient;
      var box = div({ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: justify(s.align), textAlign: s.align, fontFamily: s.fontFamily || FONTS.head, fontWeight: s.fontWeight, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, fontStyle: s.italic ? "italic" : "normal" });
      var span = document.createElement("span");
      span.textContent = el.props.text || "";
      if (grad) {
        css(span, { backgroundImage: "linear-gradient(120deg, " + grad.join(", ") + ")", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" });
        if (el.anim && el.anim.idle === "shimmer") css(span, { backgroundSize: "200% auto", animation: "stShimmer 6s linear infinite" });
      } else span.style.color = s.color;
      box.appendChild(span);
      return { node: box };
    },
    text: function (el) {
      var s = el.style;
      var box = div({ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: justify(s.align), textAlign: s.align, color: s.color, fontFamily: s.fontFamily || FONTS.body, fontWeight: s.fontWeight, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, fontStyle: s.italic ? "italic" : "normal" });
      var span = document.createElement("span");
      span.textContent = el.props.text || "";
      box.appendChild(span);
      return { node: box };
    },
    kicker: function (el) {
      var s = el.style;
      var box = div({ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: justify(s.align), textAlign: s.align, color: s.color, fontFamily: FONTS.mono, fontSize: s.fontSize, letterSpacing: s.letterSpacing, textTransform: "uppercase" });
      box.textContent = el.props.text || "";
      return { node: box };
    },
    quote: function (el) {
      var s = el.style;
      var box = div({ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: s.align });
      div({ fontSize: s.fontSize * 1.6, lineHeight: 0, color: s.accent, fontFamily: FONTS.head, height: s.fontSize * 0.6 }, box).textContent = "“";
      div({ color: s.color, fontFamily: FONTS.head, fontWeight: 300, fontSize: s.fontSize, lineHeight: 1.25 }, box).textContent = el.props.text || "";
      if (el.props.author) div({ marginTop: 14, color: s.accent, fontFamily: FONTS.mono, fontSize: Math.max(12, s.fontSize * 0.34), letterSpacing: 1 }, box).textContent = el.props.author;
      return { node: box };
    },
    counter: function (el) {
      var s = el.style, p = el.props, d = p.decimals || 0;
      var box = div({ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" });
      var big = div({ fontFamily: FONTS.head, fontWeight: 300, fontSize: s.fontSize, color: s.color, letterSpacing: -1, lineHeight: 1 }, box);
      var fmt = function (v) { return (p.prefix || "") + (d > 0 ? v.toFixed(d) : Math.round(v).toLocaleString()) + (p.suffix || ""); };
      big.textContent = fmt(0);
      if (p.label) div({ marginTop: 10, fontSize: Math.max(11, s.fontSize * 0.2), color: P.muted, letterSpacing: 1, lineHeight: 1.35 }, box).textContent = p.label;
      return { node: box, activate: function () { countUp(p.value, 1.5, function (v) { big.textContent = fmt(v); }); } };
    },
    button: function (el) {
      var s = el.style, primary = el.props.variant !== "ghost";
      var a = document.createElement("a");
      a.href = el.props.href || "#";
      a.textContent = el.props.label || "";
      css(a, {
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: "100%",
        borderRadius: 999, textDecoration: "none", fontWeight: s.fontWeight || 500, fontSize: s.fontSize, fontFamily: FONTS.body,
        boxSizing: "border-box", cursor: "pointer",
        color: s.color || (primary ? P.white : P.light),
        background: primary ? "linear-gradient(135deg, " + (s.bg || P.purple) + ", " + P.magenta + ")" : "transparent",
        border: primary ? "0" : "1px solid " + (s.color || P.light) + "66",
        boxShadow: primary ? "0 10px 26px " + (s.bg || P.purple) + "55" : "none",
      });
      a.addEventListener("click", function (e) { e.stopPropagation(); });
      return { node: a };
    },
    list: function (el) {
      var s = el.style;
      var box = div({ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: s.gap, color: s.color, fontFamily: FONTS.body, fontSize: s.fontSize, lineHeight: 1.45 });
      (el.props.items || []).forEach(function (it) {
        var row = div({ display: "flex", gap: 12, alignItems: "flex-start" }, box);
        var mark = document.createElement("span");
        css(mark, { color: s.accent, fontSize: s.fontSize * 0.6, marginTop: s.fontSize * 0.28, flexShrink: 0 });
        mark.textContent = s.marker || "◆";
        var txt = document.createElement("span");
        txt.textContent = it;
        row.appendChild(mark); row.appendChild(txt);
      });
      return { node: box };
    },
    card: function (el) {
      var c = el.style.accent, p = el.props;
      var box = div({ width: "100%", height: "100%", boxSizing: "border-box", background: "linear-gradient(180deg, " + c + "1c, " + c + "05)", border: "1px solid " + c + "45", borderRadius: 18, padding: "22px 20px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" });
      div({ position: "absolute", top: -40, right: -40, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle, " + c + "40, transparent 70%)", filter: "blur(6px)" }, box);
      var head = div({ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }, box);
      var ic = document.createElement("span"); ic.style.fontSize = "28px"; ic.textContent = p.icon || ""; head.appendChild(ic);
      if (p.tag) { var tg = document.createElement("span"); css(tg, { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 2, color: c, textTransform: "uppercase" }); tg.textContent = p.tag; head.appendChild(tg); }
      div({ fontFamily: FONTS.head, fontWeight: 300, fontSize: 30, color: el.style.color || P.white, marginBottom: 10, letterSpacing: -0.5 }, box).textContent = p.title || "";
      if (p.body) div({ fontSize: 13.5, color: P.dim, lineHeight: 1.6, marginBottom: 12 }, box).textContent = p.body;
      var bl = div({ marginTop: "auto" }, box);
      (p.bullets || []).forEach(function (b) {
        var row = div({ display: "flex", gap: 8, fontSize: 12.5, color: "rgba(244,224,255,0.8)", lineHeight: 1.5, marginBottom: 5 }, bl);
        var mark = document.createElement("span"); css(mark, { color: c, fontSize: 8, marginTop: 6, flexShrink: 0 }); mark.textContent = "◆";
        var txt = document.createElement("span"); txt.textContent = b;
        row.appendChild(mark); row.appendChild(txt);
      });
      return { node: box };
    },
    icon: function (el) {
      var box = div({ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: el.style.fontSize, lineHeight: 1 });
      box.textContent = el.props.glyph || "";
      return { node: box };
    },
    image: function (el) {
      var s = el.style;
      if (!el.props.src) {
        var ph = div({ width: "100%", height: "100%", borderRadius: s.borderRadius, border: "1px dashed " + P.faint, display: "flex", alignItems: "center", justifyContent: "center", color: P.muted, fontSize: 13, background: "rgba(255,255,255,0.03)" });
        return { node: ph };
      }
      var img = document.createElement("img");
      img.src = el.props.src; img.alt = el.props.alt || "";
      css(img, { width: "100%", height: "100%", objectFit: el.props.fit || "cover", borderRadius: s.borderRadius, border: s.borderWidth ? s.borderWidth + "px solid " + (s.borderColor || P.faint) : "none", display: "block" });
      return { node: img };
    },
    shape: function (el) {
      var s = el.style, shape = el.props.shape || "rect";
      var fill = s.gradient ? "linear-gradient(135deg, " + s.gradient.join(", ") + ")" : (s.bg || P.purple);
      var common = { width: "100%", height: "100%", background: fill, boxShadow: s.glow ? "0 0 40px " + ((s.gradient ? s.gradient[0] : s.bg) || P.purple) + "66" : "none", border: s.borderWidth ? s.borderWidth + "px solid " + s.borderColor : "none", boxSizing: "border-box" };
      if (shape === "ellipse") return { node: div(Object.assign(common, { borderRadius: "50%" })) };
      if (shape === "pill") return { node: div(Object.assign(common, { borderRadius: 999 })) };
      if (shape === "line") return { node: div({ width: "100%", height: Math.max(2, s.borderWidth || 3), background: fill, marginTop: "calc(50% - 1px)" }) };
      if (shape === "triangle") {
        var col = s.gradient ? s.gradient[0] : (s.bg || P.purple);
        return { node: div({ width: 0, height: 0, margin: "0 auto", borderLeft: el.w / 2 + "px solid transparent", borderRight: el.w / 2 + "px solid transparent", borderBottom: el.h + "px solid " + col }) };
      }
      return { node: div(Object.assign(common, { borderRadius: s.borderRadius != null ? s.borderRadius : 12 })) };
    },
    ring: function (el) {
      var s = el.style, p = el.props, R = 70, C = 2 * Math.PI * R;
      var box = div({ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" });
      var node = svg(
        '<svg viewBox="0 0 180 180" style="width:78%;height:78%">' +
        '<circle cx="90" cy="90" r="' + R + '" fill="none" stroke="' + esc(s.track || P.faint) + '" stroke-width="12"/>' +
        '<circle class="val" cx="90" cy="90" r="' + R + '" fill="none" stroke="' + esc(s.accent) + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" transform="rotate(-90 90 90)" style="filter:drop-shadow(0 0 8px ' + esc(s.accent) + 'aa)"/>' +
        '<text class="num" x="90" y="96" text-anchor="middle" font-family="' + esc(FONTS.head) + '" font-weight="300" font-size="' + esc(s.fontSize) + '" fill="' + P.white + '">0' + esc(p.suffix || "") + "</text></svg>"
      );
      box.appendChild(node);
      if (p.label) div({ marginTop: 4, fontSize: 12, color: P.muted, letterSpacing: 1 }, box).textContent = p.label;
      var arc = node.querySelector(".val"), num = node.querySelector(".num");
      return {
        node: box,
        activate: function () {
          countUp(p.value, 1.5, function (v) {
            var pct = Math.max(0, Math.min(100, v)) / 100;
            arc.setAttribute("stroke-dashoffset", C * (1 - pct));
            num.textContent = Math.round(v) + (p.suffix || "");
          });
        },
      };
    },
    chart: function (el) {
      var p = el.props, W = 800, H = 340, padL = 50, padB = 36, padT = 12, padR = 20;
      var max = p.axisMax || Math.max.apply(null, [1].concat(p.series.reduce(function (a, s) { return a.concat(s.values); }, [])));
      var n = p.xLabels.length;
      var xAt = function (i) { return padL + (i / Math.max(1, n - 1)) * (W - padL - padR); };
      var yAt = function (v) { return (H - padB) - (v / max) * (H - padB - padT); };
      var lineP = function (vals) { return vals.map(function (v, i) { return (i === 0 ? "M " : "L ") + xAt(i) + " " + yAt(v); }).join(" "); };
      var areaP = function (vals) { return lineP(vals) + " L " + xAt(n - 1) + " " + (H - padB) + " L " + xAt(0) + " " + (H - padB) + " Z"; };
      var box = div({ width: "100%", height: "100%", display: "flex", flexDirection: "column" });
      var legend = div({ display: "flex", justifyContent: "flex-end", gap: 16, marginBottom: 6, fontFamily: FONTS.mono, fontSize: 11 }, box);
      p.series.forEach(function (s) {
        var item = document.createElement("span");
        css(item, { display: "inline-flex", alignItems: "center", gap: 6, color: P.dim });
        var sw = document.createElement("span");
        css(sw, { width: 10, height: 10, borderRadius: 2, background: s.color });
        item.appendChild(sw); item.appendChild(document.createTextNode(s.label));
        legend.appendChild(item);
      });
      var uid = "cg" + Math.random().toString(36).slice(2, 8);
      var defs = p.series.map(function (s, i) {
        return '<linearGradient id="' + uid + i + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="' + esc(s.color) + '" stop-opacity="0.8"/><stop offset="100%" stop-color="' + esc(s.color) + '" stop-opacity="0.12"/></linearGradient>';
      }).join("");
      var grid = [0, 0.25, 0.5, 0.75, 1].map(function (f, i) {
        var y = (H - padB) - (i / 4) * (H - padB - padT);
        return '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="' + esc(el.style.grid || P.faint) + '" stroke-dasharray="2 4"/><text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="9" fill="' + esc(el.style.axis || P.muted) + '" font-family="' + esc(FONTS.mono) + '">' + Math.round(max * f) + "</text>";
      }).join("");
      var seriesM = p.series.map(function (s, i) {
        var body;
        if (p.kind === "bar") {
          body = s.values.map(function (v, j) {
            var bw = (W - padL - padR) / n * 0.5 / p.series.length;
            return '<rect x="' + (xAt(j) - (p.series.length * bw) / 2 + i * bw) + '" y="' + yAt(v) + '" width="' + bw * 0.85 + '" height="' + ((H - padB) - yAt(v)) + '" fill="' + esc(s.color) + '" rx="2" opacity="0.85"/>';
          }).join("");
        } else {
          body = (p.kind !== "line" ? '<path d="' + areaP(s.values) + '" fill="url(#' + uid + i + ')" opacity="0.7"/>' : "") +
            '<path d="' + lineP(s.values) + '" fill="none" stroke="' + esc(s.color) + '" stroke-width="2.5"/>';
        }
        return '<g class="sgrp" style="transition:opacity 1s;opacity:0">' + body + "</g>";
      }).join("");
      var labels = p.xLabels.map(function (x, i) {
        return '<text x="' + xAt(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="' + esc(P.dim) + '" font-family="' + esc(FONTS.mono) + '">' + esc(x) + "</text>";
      }).join("");
      var node = svg('<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet" style="width:100%;flex:1;min-height:0"><defs>' + defs + "</defs>" + grid + seriesM + labels + "</svg>");
      box.appendChild(node);
      return {
        node: box,
        activate: function () {
          node.querySelectorAll(".sgrp").forEach(function (g) { g.style.opacity = 1; });
        },
      };
    },
    orbit: function (el) {
      var s = el.style, sats = ["🛰️", "🛰️", "📡"];
      var box = div({ position: "relative", width: "100%", height: "100%" });
      div({ position: "absolute", inset: "32%", borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, " + s.planet + ", " + P.deep + " 72%)", boxShadow: "0 0 60px " + s.planet + "55, inset -18px -18px 50px " + P.deep }, box);
      var rings = [];
      for (var i = 0; i < (el.props.rings || 3); i++) {
        var inset = 6 + i * 13, dur = 22 - i * 5, c = [s.accent, P.magenta, P.gold][i % 3];
        var ring = div({ position: "absolute", inset: inset + "%", borderRadius: "50%", border: "1px dashed " + c + "55" }, box);
        div({ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", fontSize: 18 }, ring).textContent = sats[i % sats.length];
        rings.push({ node: ring, anim: (i % 2 ? "stOrbitR" : "stOrbit") + " " + dur + "s linear infinite" });
      }
      var lbl = div({ position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)", fontFamily: FONTS.mono, fontSize: 11, color: s.accent, letterSpacing: 2 }, box);
      lbl.textContent = el.props.label || "";
      return { node: box, activate: function () { rings.forEach(function (r) { r.node.style.animation = r.anim; }); } };
    },
    radar: function (el) {
      var s = el.style;
      var box = div({ position: "relative", width: "100%", height: "100%", borderRadius: 16, overflow: "hidden", background: "radial-gradient(circle at 30% 50%, " + s.accent + "1f, transparent 70%)", border: "1px solid " + s.accent + "33" });
      var st = div({ position: "absolute", left: 30, top: "50%", transform: "translateY(-50%)", textAlign: "center", zIndex: 3 }, box);
      div({ width: 46, height: 46, borderRadius: "50%", background: "radial-gradient(circle, " + s.accent + ", " + P.purple + "aa)", boxShadow: "0 0 26px " + s.accent + "88", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }, st).textContent = "📡";
      div({ fontFamily: FONTS.mono, fontSize: 9, color: P.light, marginTop: 6, letterSpacing: 1 }, st).textContent = el.props.label || "";
      var waves = [0, 1, 2].map(function (i) {
        return { node: div({ position: "absolute", left: 52, top: "50%", width: "118%", aspectRatio: "1/1", borderRadius: "50%", border: "1px solid " + s.accent + "55", transformOrigin: "center", opacity: 0 }, box), anim: "stRadar 3.6s ease-out " + i * 1.2 + "s infinite" };
      });
      var dots = (el.props.targets || []).map(function (t, i) {
        var w = div({ position: "absolute", left: t.x + "%", top: t.y + "%" }, box);
        var dot = div({ width: 14, height: 14, borderRadius: "50%", background: t.color, boxShadow: "0 0 16px " + t.color + "cc" }, w);
        div({ fontFamily: FONTS.mono, fontSize: 9, color: t.color, marginTop: 4, letterSpacing: 1, whiteSpace: "nowrap" }, w).textContent = t.label || "";
        return { node: dot, anim: "stBlink 2.4s ease-in-out " + i * 0.4 + "s infinite" };
      });
      return {
        node: box,
        activate: function () {
          waves.forEach(function (w) { w.node.style.opacity = ""; w.node.style.animation = w.anim; });
          dots.forEach(function (d) { d.node.style.animation = d.anim; });
        },
      };
    },
    loop: function (el) {
      var stages = el.props.stages || [], cx = 410, cy = 230, R = 165;
      var pts = stages.map(function (s, i) {
        var a = (i / stages.length) * 2 * Math.PI - Math.PI / 2;
        return { label: s.label, color: s.color, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
      });
      var uid = "lp" + Math.random().toString(36).slice(2, 8);
      var paths = pts.map(function (s, i) {
        var next = pts[(i + 1) % pts.length];
        var d = "M " + s.x + " " + s.y + " Q " + (s.x + next.x) / 2 + " " + ((s.y + next.y) / 2 + (i % 2 ? -36 : 36)) + " " + next.x + " " + next.y;
        return '<g><path d="' + d + '" fill="none" stroke="' + esc(s.color) + '" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="4 6"><animate attributeName="stroke-dashoffset" from="0" to="-200" dur="3s" repeatCount="indefinite"/></path>' +
          '<circle r="4" fill="' + esc(s.color) + '"><animateMotion dur="' + (3 + i * 0.2) + 's" repeatCount="indefinite" path="' + d + '"/></circle></g>';
      }).join("");
      var nodes = pts.map(function (s) {
        return '<g transform="translate(' + s.x + "," + s.y + ')"><circle r="33" fill="' + esc(s.color) + '22" stroke="' + esc(s.color) + '" stroke-width="1.5"/><text text-anchor="middle" y="4" font-family="' + esc(FONTS.mono) + '" font-size="11" font-weight="700" letter-spacing="1.2" fill="' + esc(s.color) + '">' + esc(s.label) + "</text></g>";
      }).join("");
      var node = svg(
        '<svg viewBox="0 0 820 460" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;opacity:0;transition:opacity 0.8s">' +
        '<defs><radialGradient id="' + uid + '" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="' + P.purple + '" stop-opacity="0.55"/><stop offset="60%" stop-color="' + P.magenta + '" stop-opacity="0.16"/><stop offset="100%" stop-color="' + P.purple + '" stop-opacity="0"/></radialGradient></defs>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="118" fill="url(#' + uid + ')"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="60" fill="none" stroke="' + P.light + '" stroke-opacity="0.18" stroke-dasharray="3 5"/>' +
        '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-family="' + esc(FONTS.head) + '" font-weight="300" font-size="22" fill="' + P.white + '">' + esc(el.props.title) + "</text>" +
        '<text x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle" font-family="' + esc(FONTS.mono) + '" font-size="10" letter-spacing="2" fill="' + P.light + '" opacity="0.6">' + esc(el.props.sub) + "</text>" +
        paths + nodes + "</svg>"
      );
      return { node: node, activate: function () { node.style.opacity = 1; } };
    },
  };

  // ── backgrounds (mirror studio backgrounds.jsx; return {node, stop?}) ──
  function blob(color, x, y, size, anim, dur, parent) {
    return div({
      position: "absolute", left: x + "%", top: y + "%", width: size, height: size,
      borderRadius: "50%", background: "radial-gradient(circle, " + color + ", transparent 65%)",
      filter: "blur(40px)", transform: "translate(-50%,-50%)", animation: anim + " " + dur + "s ease-in-out infinite",
    }, parent);
  }
  function canvasBg(drawLoop) {
    var cvs = document.createElement("canvas");
    css(cvs, { width: STAGE_W, height: STAGE_H, position: "absolute", inset: 0 });
    var ctx = cvs.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = STAGE_W * dpr; cvs.height = STAGE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var raf = 0, stopped = false;
    var frame = function () { if (stopped) return; drawLoop(ctx); raf = requestAnimationFrame(frame); };
    frame();
    return { node: cvs, stop: function () { stopped = true; cancelAnimationFrame(raf); } };
  }
  function buildBackground(bg) {
    var colors = bg && bg.colors && bg.colors.length ? bg.colors : [P.deep];
    var type = (bg && bg.type) || "solid";
    var fill = { position: "absolute", inset: 0, overflow: "hidden" };

    if (type === "nebula") {
      var base = hexToRgb(colors[0] || P.purple), deep = hexToRgb(colors[1] || P.deep);
      var pal = [base, hexToRgb(P.cyan), hexToRgb(P.magenta), hexToRgb(P.light)];
      var nodes = [];
      for (var i = 0; i < 64; i++) nodes.push({ x: Math.random() * STAGE_W, y: Math.random() * STAGE_H, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, r: 0.8 + Math.random() * 1.7, hue: Math.random() });
      var t = 0;
      return canvasBg(function (ctx) {
        t += 0.007;
        var g = ctx.createRadialGradient(STAGE_W * 0.7, STAGE_H * 0.3, 40, STAGE_W * 0.5, STAGE_H * 0.5, STAGE_W);
        g.addColorStop(0, rgba(base, 0.22)); g.addColorStop(0.45, rgba(deep, 0.9)); g.addColorStop(1, rgba(deep, 1));
        ctx.fillStyle = g; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
        ctx.beginPath();
        ctx.arc(STAGE_W * 0.7 + Math.sin(t * 0.3) * 40, STAGE_H * 0.3 + Math.cos(t * 0.2) * 28, Math.min(STAGE_W, STAGE_H) * 0.5, -0.8, 1.6);
        ctx.strokeStyle = rgba(base, 0.10); ctx.lineWidth = 60; ctx.stroke();
        nodes.forEach(function (n) {
          n.x += n.vx + Math.sin(t + n.hue * 12) * 0.05;
          n.y += n.vy + Math.cos(t * 0.8 + n.hue * 9) * 0.05;
          if (n.x < -30) n.x = STAGE_W + 20; if (n.x > STAGE_W + 30) n.x = -20;
          if (n.y < -30) n.y = STAGE_H + 20; if (n.y > STAGE_H + 30) n.y = -20;
        });
        var maxD2 = 170 * 170;
        ctx.lineWidth = 0.6;
        for (var a = 0; a < nodes.length; a++) {
          for (var b = a + 1; b < nodes.length; b++) {
            var A = nodes[a], B = nodes[b];
            var dx = A.x - B.x, dy = A.y - B.y, d2 = dx * dx + dy * dy;
            if (d2 < maxD2) {
              var k = 1 - d2 / maxD2;
              var c = pal[Math.floor((A.hue + B.hue) * 0.5 * pal.length) % pal.length];
              ctx.strokeStyle = rgba(c, k * 0.16);
              ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
            }
          }
        }
        nodes.forEach(function (n) {
          var pulse = 0.6 + 0.4 * Math.sin(t * 2 + n.hue * 6.28);
          var c = pal[Math.floor(n.hue * pal.length) % pal.length];
          ctx.fillStyle = rgba(c, 0.55 * pulse);
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (1 + pulse * 0.4), 0, Math.PI * 2); ctx.fill();
        });
      });
    }

    if (type === "starfield") {
      var tint = hexToRgb(colors[0] || P.cyan);
      var stars = [];
      for (var j = 0; j < 160; j++) stars.push({ x: Math.random() * STAGE_W, y: Math.random() * STAGE_H, z: 0.2 + Math.random() * 1, r: Math.random() * 1.4 + 0.3, tw: Math.random() * 6.28 });
      var shoot = null, ts = 0;
      return canvasBg(function (ctx) {
        ts += 0.016;
        ctx.fillStyle = "#0a0518"; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
        var g = ctx.createRadialGradient(STAGE_W * 0.5, STAGE_H * 0.9, 60, STAGE_W * 0.5, STAGE_H * 0.9, STAGE_W * 0.8);
        g.addColorStop(0, rgba(tint, 0.12)); g.addColorStop(1, "rgba(10,5,24,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
        stars.forEach(function (s) {
          s.x -= s.z * 0.25; if (s.x < 0) s.x = STAGE_W;
          var a = 0.4 + 0.6 * Math.abs(Math.sin(ts + s.tw));
          ctx.fillStyle = "rgba(244,236,255," + a * s.z + ")";
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        });
        if (!shoot && Math.random() < 0.012) shoot = { x: Math.random() * STAGE_W, y: Math.random() * STAGE_H * 0.5, life: 1 };
        if (shoot) {
          shoot.x += 9; shoot.y += 4; shoot.life -= 0.02;
          ctx.strokeStyle = rgba(tint, Math.max(0, shoot.life)); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - 60, shoot.y - 26); ctx.stroke();
          if (shoot.life <= 0) shoot = null;
        }
      });
    }

    if (type === "aurora") {
      var au = div(Object.assign({}, fill, { background: P.deep }));
      blob(colors[0], 25, 30, 620, "stAurora", 18, au);
      blob(colors[1] || P.magenta, 78, 64, 560, "stAurora", 22, au);
      blob(colors[2] || P.cyan, 60, 20, 480, "stAurora", 26, au);
      return { node: au };
    }
    if (type === "mesh") {
      var me = div(Object.assign({}, fill, { background: P.deep }));
      blob(colors[0], 20, 28, 540, "stBreathe", 9, me);
      blob(colors[1] || P.magenta, 82, 36, 500, "stBreathe", 11, me);
      blob(colors[2] || P.cyan, 50, 84, 560, "stBreathe", 13, me);
      return { node: me };
    }
    if (type === "grid") {
      var line = colors[0] + "33";
      var gr = div(Object.assign({}, fill, { background: "linear-gradient(180deg, " + P.deep + ", #15052b)" }));
      div({
        position: "absolute", inset: "-20%", backgroundImage: "linear-gradient(" + line + " 1px, transparent 1px), linear-gradient(90deg, " + line + " 1px, transparent 1px)",
        backgroundSize: "60px 60px", transform: "perspective(420px) rotateX(58deg)", transformOrigin: "50% 100%",
        animation: "stGridMove 3s linear infinite", maskImage: "linear-gradient(to top, #000 10%, transparent 75%)", WebkitMaskImage: "linear-gradient(to top, #000 10%, transparent 75%)",
      }, gr);
      div({ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 75%, " + colors[0] + "22, transparent 60%)" }, gr);
      return { node: gr };
    }
    if (type === "gradient") return { node: div(Object.assign({}, fill, { background: "linear-gradient(135deg, " + colors[0] + ", " + (colors[1] || P.deep) + ")" })) };
    return { node: div(Object.assign({}, fill, { background: colors[0] || P.deep })) };
  }

  // ── slide instance ────────────────────────────────────────────────────
  function buildSlide(slide) {
    var root = div({ position: "absolute", inset: 0, background: P.deep, overflow: "hidden" });
    var bg = buildBackground(slide.background);
    root.appendChild(bg.node);
    var blocks = (slide.elements || []).map(function (elm) {
      var hidden = HIDDEN[(elm.anim && elm.anim.in) || "fade-up"] || HIDDEN["fade-up"];
      var rot = elm.rotation ? "rotate(" + elm.rotation + "deg)" : "";
      var baseOpacity = elm.style && elm.style.opacity != null ? elm.style.opacity : 1;
      var outer = div({ position: "absolute", left: elm.x, top: elm.y, width: elm.w, height: elm.h, boxSizing: "border-box" }, root);
      outer.style.opacity = baseOpacity * hidden.o;
      outer.style.filter = hidden.f;
      outer.style.transform = (rot + " " + hidden.t).trim();
      outer.style.transition = entranceCss(elm.anim, false);
      var inner = div({ width: "100%", height: "100%" }, outer);
      inner.style.animation = idleAnim(elm.anim && elm.anim.idle);
      var r = RENDER[elm.type];
      var made = r ? r(elm) : null;
      if (made) inner.appendChild(made.node);
      return {
        activate: function () {
          outer.style.transition = entranceCss(elm.anim, true);
          outer.style.opacity = baseOpacity;
          outer.style.filter = "none";
          outer.style.transform = rot || "none";
          if (made && made.activate) made.activate();
        },
      };
    });
    return {
      node: root,
      activate: function () { blocks.forEach(function (b) { b.activate(); }); },
      destroy: function () { if (bg.stop) bg.stop(); if (root.parentNode) root.parentNode.removeChild(root); },
    };
  }

  // ── present shell ─────────────────────────────────────────────────────
  function transitionStates(type, dir) {
    switch (type) {
      case "none": return { enter: { o: 1, t: "none" }, exit: { o: 1, t: "none" } };
      case "fade": return { enter: { o: 0, t: "none" }, exit: { o: 0, t: "none" } };
      case "slide-left": return { enter: { o: 1, t: "translateX(" + STAGE_W * dir + "px)" }, exit: { o: 1, t: "translateX(" + -STAGE_W * dir + "px)" } };
      case "slide-up": return { enter: { o: 1, t: "translateY(" + STAGE_H * dir + "px)" }, exit: { o: 1, t: "translateY(" + -STAGE_H * dir + "px)" } };
      case "zoom": return { enter: { o: 0, t: "scale(0.82)" }, exit: { o: 0, t: "scale(1.14)" } };
      case "flip": return { enter: { o: 0, t: "perspective(1800px) rotateY(" + 35 * dir + "deg)" }, exit: { o: 0, t: "perspective(1800px) rotateY(" + -35 * dir + "deg)" } };
      default: return { enter: { o: 0, t: "none" }, exit: { o: 0, t: "none" } };
    }
  }

  var slides = DECK.slides || [];
  document.title = DECK.title || "Presentation";

  var root = document.getElementById("player");
  var frame = div({ position: "relative" }, root);
  var stage = div({ position: "absolute", top: 0, left: 0, width: STAGE_W, height: STAGE_H, transformOrigin: "top left", borderRadius: 4, overflow: "hidden" }, frame);

  function fit() {
    var scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    css(frame, { width: STAGE_W * scale, height: STAGE_H * scale });
    stage.style.transform = "scale(" + scale + ")";
  }
  window.addEventListener("resize", fit);
  fit();

  var cur = -1, curLayer = null, curInst = null, navTimer = 0;

  function navigate(d, target) {
    var ni = Math.max(0, Math.min(slides.length - 1, target != null ? target : cur + d));
    if (ni === cur) return;
    var dir = ni >= cur ? 1 : -1;
    var first = cur < 0;
    var tt = transitionStates(slides[ni].transition, dir);
    clearTimeout(navTimer);

    var outLayer = curLayer, outInst = curInst;
    var inst = buildSlide(slides[ni]);
    var layer = div({ position: "absolute", inset: 0, transition: TR_CSS, zIndex: 2 });
    if (!first) { layer.style.opacity = tt.enter.o; layer.style.transform = tt.enter.t; }
    layer.appendChild(inst.node);
    if (outLayer) outLayer.style.zIndex = 1;
    stage.appendChild(layer);
    cur = ni; curLayer = layer; curInst = inst;
    updateChrome();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        layer.style.opacity = 1;
        layer.style.transform = "none";
        inst.activate();
        if (outLayer) {
          var animateOut = slides[ni].transition !== "none";
          if (animateOut) {
            outLayer.style.opacity = tt.exit.o;
            outLayer.style.transform = tt.exit.t;
            navTimer = setTimeout(function () { outInst.destroy(); if (outLayer.parentNode) outLayer.parentNode.removeChild(outLayer); }, TRANS_DUR * 1000 + 90);
          } else {
            outInst.destroy();
            if (outLayer.parentNode) outLayer.parentNode.removeChild(outLayer);
          }
        }
      });
    });
  }

  // chrome: dots + bottom bar
  var dots = document.getElementById("dots");
  var dotEls = slides.map(function (s, k) {
    var b = document.createElement("button");
    b.className = "pdot";
    b.title = s.name || "Slide " + (k + 1);
    b.addEventListener("click", function (e) { e.stopPropagation(); navigate(0, k); });
    dots.appendChild(b);
    return b;
  });
  var countEl = document.getElementById("count");
  var prevBtn = document.getElementById("prev");
  var nextBtn = document.getElementById("next");
  function updateChrome() {
    countEl.textContent = (cur + 1) + " / " + slides.length;
    prevBtn.disabled = cur === 0;
    nextBtn.disabled = cur === slides.length - 1;
    dotEls.forEach(function (d, k) { d.className = "pdot" + (k === cur ? " on" : ""); });
  }
  prevBtn.addEventListener("click", function (e) { e.stopPropagation(); navigate(-1); });
  nextBtn.addEventListener("click", function (e) { e.stopPropagation(); navigate(1); });
  document.getElementById("fs").addEventListener("click", function (e) {
    e.stopPropagation();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
  document.getElementById("bar").addEventListener("click", function (e) { e.stopPropagation(); });
  dots.addEventListener("click", function (e) { e.stopPropagation(); });

  root.addEventListener("click", function (e) {
    navigate(e.clientX > window.innerWidth / 2 ? 1 : -1);
  });
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); navigate(1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); navigate(-1); }
    else if (e.key === "Home") navigate(-1, 0);
    else if (e.key === "End") navigate(1, slides.length - 1);
    else if (e.key.toLowerCase() === "f") document.getElementById("fs").click();
  });

  navigate(0, 0);
}
/* eslint-enable no-var */

const PLAYER_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
body { font-family: 'Telia Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #F4E0FF; }
#player { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; }
#bar { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
  background: rgba(20,5,40,0.8); backdrop-filter: blur(8px); border: 1px solid rgba(244,224,255,0.14); border-radius: 999px;
  padding: 6px 10px; cursor: default; z-index: 10; opacity: 0.25; transition: opacity .2s; }
#bar:hover { opacity: 1; }
#bar button { font: inherit; cursor: pointer; background: rgba(255,255,255,0.06); color: #F4E0FF;
  border: 1px solid rgba(244,224,255,0.14); border-radius: 8px; padding: 7px 12px; transition: border-color .15s; }
#bar button:hover { border-color: ${P.cyan}; }
#bar button:disabled { opacity: .35; cursor: default; }
#count { font-family: ui-monospace, monospace; font-size: 12px; color: ${P.dim}; min-width: 54px; text-align: center; }
#dots { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 7px; cursor: default; z-index: 10;
  opacity: 0.25; transition: opacity .2s; }
#dots:hover { opacity: 1; }
.pdot { width: 8px; height: 8px; border-radius: 50%; background: rgba(244,224,255,0.25); border: 0; padding: 0; cursor: pointer; }
.pdot.on { background: ${P.cyan}; box-shadow: 0 0 10px ${P.cyan}; }
`;

// Telia fonts from the stable NorthStar host; system fonts take over offline.
const FONT_CSS = `
@font-face { font-family: "Telia Sans Heading"; src: url("https://northstar-program.com/fonts/TeliaSansHeading-Heading.woff2") format("woff2"); font-weight: 300; font-style: normal; font-display: swap; }
@font-face { font-family: "Telia Sans"; src: url("https://northstar-program.com/fonts/TeliaSans-Regular.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Telia Sans"; src: url("https://northstar-program.com/fonts/TeliaSans-Medium.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "Telia Sans"; src: url("https://northstar-program.com/fonts/TeliaSans-Bold.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
`;

export function buildDeckHtml(deck) {
  // <-escape so user text can never terminate the <script> block early.
  const deckJson = JSON.stringify(deck).replace(/</g, "\\u003c");
  const paletteJson = JSON.stringify(P);
  const title = deck.title || "Presentation";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>
<style>${FONT_CSS}${KEYFRAMES}${PLAYER_CSS}</style>
</head>
<body>
<div id="player"></div>
<div id="dots"></div>
<div id="bar">
  <button id="prev" title="Previous slide">‹</button>
  <span id="count"></span>
  <button id="next" title="Next slide">›</button>
  <button id="fs" title="Fullscreen (F)">⛶</button>
</div>
<script>
/* Built with NorthStar Presentation Studio. Navigate with arrow keys, space or click. */
(${PLAYER.toString()})(${deckJson}, ${paletteJson});
</script>
</body>
</html>
`;
}

export function downloadDeckHtml(deck) {
  const safe = (deck.title || "presentation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "presentation";
  const blob = new Blob([buildDeckHtml(deck)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${safe}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
