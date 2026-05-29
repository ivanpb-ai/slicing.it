import { useState, useEffect, useRef, useCallback } from "react";
import { P } from "./palette";
import { COPY } from "./copy";

/* ═══════════════════════════════════════════════════════════════════════
   NORTHSTAR — THE NEXT DECADE
   A future-facing 5G SA vision presentation (2026 → 2036).

   HOW TO EDIT THE TEXT
   All on-screen copy lives in  src/js/copy.js  (colours in  src/js/palette.js).
     - Visual editor: open  /copy-editor.html , edit text + colours, then
       export an updated copy.js and commit it.
     - Or edit copy.js directly. Headline-array formatting:
         "plain text"                       -> normal words
         { t: "word", c: P.cyan }           -> a coloured word
         { t: "word", c: P.gold, b: true }  -> bold + colour
         { t: "words", grad: [P.a, P.b] }   -> gradient text
         { br: true }                       -> a line break

   Embeds:  /5g-sa-architecture-diagram.html  and  /unified-5g-viz.html (iframes)
   ═══════════════════════════════════════════════════════════════════════ */

const FF_HEAD = "'Telia Sans Heading', 'Telia Sans', system-ui, sans-serif";
const FF_BODY = "'Telia Sans', system-ui, sans-serif";
const FF_MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace";

// Section ids (structural — order matches COPY.navLabels)
const SECTIONS = [
  "hero", "inflection", "waves", "innovation", "demo", "core", "slicing", "ainative", "ambient",
  "positioning", "ntn", "verticals", "economy", "vision",
];

// AstaZero demo clips (asset URLs — paired by index with COPY.demo.clips).
const DEMO_VIDEOS = [
  new URL("../assets/videos/astazero-besteffort.mp4", import.meta.url),
  new URL("../assets/videos/astazero-lowlatency.mp4", import.meta.url),
];

// ═════════════════════════════════════════════════════════════════════════
// Rich — renders a COPY text array (strings + styled segments) into spans.
// (You don't need to edit this; it just paints the words from COPY.)
// ═════════════════════════════════════════════════════════════════════════
function Rich({ parts }) {
  return (parts || []).map((p, i) => {
    if (typeof p === "string") return <span key={i}>{p}</span>;
    if (p.br) return <br key={i} />;
    if (p.grad) {
      return (
        <span key={i} style={{
          background: `linear-gradient(135deg, ${p.grad.join(", ")})`,
          WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
          ...(p.anim ? { backgroundSize: "200% 200%", animation: "shimmer 6s ease-in-out infinite" } : {}),
        }}>{p.t}</span>
      );
    }
    const st = {};
    if (p.c) st.color = p.c;
    if (p.size) st.fontSize = p.size;
    return p.b ? <strong key={i} style={st}>{p.t}</strong> : <span key={i} style={st}>{p.t}</span>;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// BACKGROUND: layered animated canvas
// ─────────────────────────────────────────────────────────────────────────
function NeuralNebula({ active }) {
  const ref = useRef(null);
  const raf = useRef(0);
  const t = useRef(0);
  const nodes = useRef([]);
  const last = useRef(active);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      cvs.width  = window.innerWidth  * dpr;
      cvs.height = window.innerHeight * dpr;
      cvs.style.width  = window.innerWidth  + "px";
      cvs.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const N = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 24000), 90);
      nodes.current = Array.from({ length: N }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 0.8 + Math.random() * 1.6,
        hue: Math.random(),
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const palettePurple = [
      [80, 10, 140],
      [153, 10, 227],
      [194, 63, 227],
      [244, 224, 255],
    ];
    const paletteFuture = [
      [0, 130, 124],
      [0, 212, 255],
      [125, 211, 252],
      [105, 240, 174],
    ];

    const animate = () => {
      t.current += 0.0065;
      const time = t.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isFuture = active >= 7; // shift palette toward cyan/teal in future sections
      const palette = isFuture ? paletteFuture : palettePurple;

      if (last.current !== active) last.current = active;

      const g = ctx.createRadialGradient(w * 0.7, h * 0.3, 50, w * 0.5, h * 0.5, Math.max(w, h));
      g.addColorStop(0, isFuture ? "rgba(0, 130, 124, 0.22)" : "rgba(153, 10, 227, 0.22)");
      g.addColorStop(0.4, "rgba(61, 21, 86, 0.85)");
      g.addColorStop(1, "#1A0533");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.beginPath();
      const ax = w * 0.7 + Math.sin(time * 0.3) * 40;
      const ay = h * 0.3 + Math.cos(time * 0.2) * 28;
      ctx.arc(ax, ay, Math.min(w, h) * 0.48, -0.8 + Math.sin(time * 0.15) * 0.2, 1.5 + Math.cos(time * 0.1) * 0.3);
      ctx.strokeStyle = isFuture ? "rgba(0,212,255,0.10)" : "rgba(153,10,227,0.13)";
      ctx.lineWidth = 60;
      ctx.stroke();

      const ns = nodes.current;
      for (const n of ns) {
        n.x += n.vx + Math.sin(time + n.hue * 12) * 0.05;
        n.y += n.vy + Math.cos(time * 0.8 + n.hue * 9) * 0.05;
        if (n.x < -30) n.x = w + 20;
        if (n.x > w + 30) n.x = -20;
        if (n.y < -30) n.y = h + 20;
        if (n.y > h + 30) n.y = -20;
      }

      const maxD2 = 160 * 160;
      ctx.lineWidth = 0.6;
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i];
        for (let j = i + 1; j < ns.length; j++) {
          const b = ns[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxD2) {
            const k = 1 - d2 / maxD2;
            const c = palette[Math.floor((a.hue + b.hue) * 0.5 * palette.length) % palette.length];
            ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${k * 0.16})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of ns) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 2 + n.hue * 6.28);
        const c = palette[Math.floor(n.hue * palette.length) % palette.length];
        ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.55 * pulse})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (1 + pulse * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      if (active === 0 || active === 6 || active === 7) {
        const burst = 8;
        for (let k = 0; k < burst; k++) {
          const phase = (time * 0.6 + k / burst) % 1;
          const i1 = (k * 7) % ns.length;
          const i2 = (k * 13 + 3) % ns.length;
          const a = ns[i1], b = ns[i2];
          if (!a || !b) continue;
          const px = a.x + (b.x - a.x) * phase;
          const py = a.y + (b.y - a.y) * phase;
          const c = palette[3];
          ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.85)`;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize", resize); };
  }, [active]);

  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

// ─────────────────────────────────────────────────────────────────────────
// COUNTER (large, animated)
// ─────────────────────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "", active, duration = 1800, decimals = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) { setV(0); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(eased * to);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, active, duration]);
  const display = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  return <span>{prefix}{display}{suffix}</span>;
}

// ─────────────────────────────────────────────────────────────────────────
// REVEAL — small utility for fade/translate
// ─────────────────────────────────────────────────────────────────────────
function Reveal({ active, delay = 0, children, y = 16, scale = 1, style }) {
  return (
    <div style={{
      opacity: active ? 1 : 0,
      transform: active ? "translateY(0) scale(1)" : `translateY(${y}px) scale(${scale === 1 ? 0.985 : scale})`,
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      ...style,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// THREE WAVES
// ─────────────────────────────────────────────────────────────────────────
function WaveBands({ active }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, width: "100%" }}>
      {COPY.waves.bands.map((b, i) => (
        <Reveal key={b.title} active={active} delay={0.2 + i * 0.14}>
          <div style={{
            background: `linear-gradient(180deg, ${b.color}0e, ${b.color}03)`,
            border: `1px solid ${b.color}30`,
            borderRadius: 18,
            padding: "22px 20px",
            minHeight: 360,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%",
              background: `radial-gradient(circle, ${b.color}33, transparent 70%)`, filter: "blur(8px)",
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 28, lineHeight: 1 }}>{b.icon}</div>
              <div style={{ fontFamily: FF_MONO, fontSize: 10, letterSpacing: 2, color: b.color, textTransform: "uppercase" }}>
                {b.tag}
              </div>
            </div>
            <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 36, color: P.white, marginBottom: 12, letterSpacing: -0.5 }}>
              {b.title}
            </div>
            <div style={{ fontSize: 13, color: P.dim, lineHeight: 1.6, marginBottom: 16 }}>{b.summary}</div>
            {b.bullets.map((tx, j) => (
              <div key={j} style={{ display: "flex", gap: 8, fontSize: 12, color: "rgba(244,224,255,0.78)", lineHeight: 1.55, marginBottom: 6 }}>
                <span style={{ color: b.color, fontSize: 8, marginTop: 7, flexShrink: 0 }}>◆</span>
                <span>{tx}</span>
              </div>
            ))}
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// AI-NATIVE — animated SVG closed-loop
// ─────────────────────────────────────────────────────────────────────────
function ClosedLoopSVG({ active }) {
  const stages = COPY.ainative.loop;
  return (
    <svg viewBox="0 0 820 460" style={{ width: "100%", height: 380, opacity: active ? 1 : 0, transition: "opacity 0.8s" }}>
      <defs>
        <radialGradient id="brain" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={P.purple} stopOpacity="0.55" />
          <stop offset="60%" stopColor={P.magenta} stopOpacity="0.18" />
          <stop offset="100%" stopColor={P.purple} stopOpacity="0" />
        </radialGradient>
        <filter id="g1" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <circle cx="410" cy="220" r="120" fill="url(#brain)" />
      <circle cx="410" cy="220" r="60" fill="none" stroke={P.light} strokeOpacity="0.18" strokeDasharray="3 5" />
      <text x="410" y="218" textAnchor="middle" fontFamily={FF_HEAD} fontWeight="300" fontSize="22" fill={P.white}>{COPY.ainative.brainTitle}</text>
      <text x="410" y="240" textAnchor="middle" fontFamily={FF_MONO} fontSize="10" letterSpacing="2" fill={P.light} opacity="0.6">{COPY.ainative.brainSub}</text>

      {stages.map((s, i) => {
        const next = stages[(i + 1) % stages.length];
        const d = `M ${s.x} ${s.y} Q ${(s.x + next.x) / 2} ${(s.y + next.y) / 2 + (i % 2 ? -40 : 40)} ${next.x} ${next.y}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={s.color} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 6">
              <animate attributeName="stroke-dashoffset" from="0" to="-200" dur="3s" repeatCount="indefinite" />
            </path>
            <circle r="4" fill={s.color}>
              <animateMotion dur={`${3 + i * 0.2}s`} repeatCount="indefinite" path={d} />
              <animate attributeName="opacity" values="0.2;1;0.2" dur="3s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}

      {stages.map((s) => (
        <g key={s.label} transform={`translate(${s.x},${s.y})`}>
          <circle r="34" fill={`${s.color}22`} stroke={s.color} strokeWidth="1.5" />
          <circle r="34" fill={`${s.color}10`} filter="url(#g1)" />
          <text textAnchor="middle" y="-2" fontFamily={FF_MONO} fontSize="11" fontWeight="700" letterSpacing="1.5" fill={s.color}>{s.label}</text>
          <text textAnchor="middle" y="14" fontFamily={FF_BODY} fontSize="9" fill={P.dim}>{s.sub}</text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ISAC RADAR
// ─────────────────────────────────────────────────────────────────────────
function ISACVisual({ active }) {
  return (
    <div style={{
      position: "relative", aspectRatio: "1.6 / 1", width: "100%", maxWidth: 540, margin: "0 auto",
      borderRadius: 16, background: `radial-gradient(circle at 30% 50%, ${P.purple}22, transparent 70%)`,
      border: `1px solid ${P.purple}33`, overflow: "hidden",
    }}>
      <style>{`
        @keyframes radarRing { 0% { transform: scale(0.05); opacity: 0.7; } 100% { transform: scale(1); opacity: 0; } }
        @keyframes targetBlink { 0%, 100% { opacity: 0.25; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.2); } }
      `}</style>
      <div style={{ position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)", textAlign: "center", zIndex: 3 }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          background: `radial-gradient(circle, ${P.cyan}, ${P.purple}aa)`,
          boxShadow: `0 0 30px ${P.cyan}88`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
        }}>📡</div>
        <div style={{ fontFamily: FF_MONO, fontSize: 9, color: P.light, marginTop: 6, letterSpacing: 1 }}>{COPY.ambient.gnbLabel}</div>
      </div>
      {active && [0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute", left: 50, top: "50%", width: "120%", aspectRatio: "1/1", borderRadius: "50%",
          border: `1px solid ${P.cyan}55`, transform: "translateY(-50%)", transformOrigin: "center",
          animation: `radarRing 3.6s ease-out ${i * 1.2}s infinite`,
        }} />
      ))}
      {COPY.ambient.targets.map((tg, i) => (
        <div key={i} style={{
          position: "absolute", left: `${tg.x}%`, top: `${tg.y}%`,
          opacity: active ? 1 : 0, transition: `opacity 0.6s ease ${0.4 + i * 0.12}s`,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: "50%", background: tg.color, boxShadow: `0 0 18px ${tg.color}cc`,
            animation: "targetBlink 2.4s ease-in-out infinite", animationDelay: `${i * 0.4}s`,
          }} />
          <div style={{ fontFamily: FF_MONO, fontSize: 9, color: tg.color, marginTop: 4, letterSpacing: 1, whiteSpace: "nowrap" }}>{tg.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// NTN ORBITAL
// ─────────────────────────────────────────────────────────────────────────
function OrbitalView({ active }) {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 460, aspectRatio: "1/1", margin: "0 auto" }}>
      <style>{`
        @keyframes orbit1 { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes orbit2 { from { transform: rotate(360deg); } to { transform: rotate(0); } }
      `}</style>
      <div style={{
        position: "absolute", inset: "30%", borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, ${P.teal}, ${P.dark} 70%)`,
        boxShadow: `0 0 60px ${P.teal}66, inset -20px -20px 60px ${P.deep}`,
        opacity: active ? 1 : 0, transition: "opacity 0.8s",
      }} />
      <div style={{
        position: "absolute", inset: "22%", borderRadius: "50%",
        background: `radial-gradient(circle, transparent 60%, ${P.cyan}22)`, filter: "blur(8px)",
      }} />
      <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: `1px dashed ${P.light}33`, animation: active ? "orbit1 24s linear infinite" : "none" }}>
        <div style={{ position: "absolute", top: "-8px", left: "50%", width: 16, height: 16, transform: "translateX(-50%)", fontSize: 16 }}>🛰️</div>
      </div>
      <div style={{ position: "absolute", inset: 32, borderRadius: "50%", border: `1px dashed ${P.cyan}44`, animation: active ? "orbit2 18s linear infinite" : "none" }}>
        <div style={{ position: "absolute", bottom: "-6px", left: "30%", width: 14, height: 14, fontSize: 14 }}>🛰️</div>
      </div>
      <div style={{ position: "absolute", inset: 56, borderRadius: "50%", border: `1px dashed ${P.magenta}44`, animation: active ? "orbit1 14s linear infinite" : "none" }}>
        <div style={{ position: "absolute", top: "30%", right: "-6px", width: 14, height: 14, fontSize: 14 }}>📡</div>
      </div>
      <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <line x1="100" y1="10" x2="100" y2="80"   stroke={P.cyan}    strokeOpacity={active ? 0.4 : 0} strokeWidth="1" strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1s" repeatCount="indefinite" />
        </line>
        <line x1="40"  y1="160" x2="80" y2="110"  stroke={P.magenta} strokeOpacity={active ? 0.4 : 0} strokeWidth="1" strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1.2s" repeatCount="indefinite" />
        </line>
        <line x1="190" y1="80"  x2="120" y2="100" stroke={P.gold}    strokeOpacity={active ? 0.4 : 0} strokeWidth="1" strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="0" to="20" dur="0.9s" repeatCount="indefinite" />
        </line>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// VERTICAL CARD
// ─────────────────────────────────────────────────────────────────────────
function VerticalCard({ icon, title, year, body, tech, color, active, delay }) {
  return (
    <Reveal active={active} delay={delay}>
      <div style={{
        background: `linear-gradient(180deg, ${color}10, ${color}02)`,
        border: `1px solid ${color}30`, borderRadius: 16, padding: "20px 18px",
        position: "relative", overflow: "hidden", height: "100%", boxSizing: "border-box",
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, background: `radial-gradient(circle at 90% 10%, ${color}, transparent 60%)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 26 }}>{icon}</span>
          <div>
            <div style={{ fontFamily: FF_MONO, fontSize: 10, letterSpacing: 2, color }}>BY {year}</div>
            <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 18, color: P.white, lineHeight: 1.1 }}>{title}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: P.dim, lineHeight: 1.55, marginBottom: 10 }}>{body}</div>
        <div style={{ fontFamily: FF_MONO, fontSize: 10, color: color, opacity: 0.9, letterSpacing: 1 }}>{tech}</div>
      </div>
    </Reveal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ECONOMY — animated area chart
// ─────────────────────────────────────────────────────────────────────────
function EconomyChart({ active }) {
  const { years, connectivity, slices, apis, sensing, axisMax: max } = COPY.economy.chart;
  return (
    <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginBottom: 10, fontSize: 11, fontFamily: FF_MONO }}>
        {COPY.economy.legend.map((lg, i) => <Legend key={i} color={lg.color} label={lg.label} />)}
      </div>

      <svg viewBox="0 0 800 320" style={{ width: "100%", height: 300 }}>
        <defs>
          <linearGradient id="grad-cy" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={P.cyan} stopOpacity="0.85" />
            <stop offset="100%" stopColor={P.cyan} stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="grad-ma" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={P.magenta} stopOpacity="0.85" />
            <stop offset="100%" stopColor={P.magenta} stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="grad-go" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={P.gold} stopOpacity="0.85" />
            <stop offset="100%" stopColor={P.gold} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {[0, 50, 100, 150, 200].map(v => (
          <g key={v}>
            <line x1="50" x2="780" y1={280 - (v / max) * 240} y2={280 - (v / max) * 240} stroke={P.faint} strokeDasharray="2 4" />
            <text x="40" y={284 - (v / max) * 240} textAnchor="end" fontSize="9" fill={P.muted} fontFamily={FF_MONO}>${v}B</text>
          </g>
        ))}

        <path d={makePath(years, connectivity, max, active)} fill="none" stroke={P.faint} strokeWidth="2" strokeDasharray="6 4" />
        <path d={makeArea(years, slices,  max, active)} fill="url(#grad-cy)" opacity={active ? 0.7 : 0} style={{ transition: "opacity 1s" }} />
        <path d={makeArea(years, apis,    max, active)} fill="url(#grad-ma)" opacity={active ? 0.7 : 0} style={{ transition: "opacity 1.2s" }} />
        <path d={makeArea(years, sensing, max, active)} fill="url(#grad-go)" opacity={active ? 0.6 : 0} style={{ transition: "opacity 1.4s" }} />

        {years.map((y, i) => (
          <text key={y} x={50 + i * 146} y="305" textAnchor="middle" fontSize="11" fill={P.dim} fontFamily={FF_MONO}>{y}</text>
        ))}
      </svg>

      <div style={{ fontSize: 11, color: P.muted, fontStyle: "italic", textAlign: "center", marginTop: 6 }}>
        {COPY.economy.caption}
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: P.dim }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />{label}
    </span>
  );
}

function makePath(years, vals, max, active) {
  const w = 730 / (years.length - 1);
  return vals.map((v, i) => {
    const x = 50 + i * w;
    const y = 280 - (active ? (v / max) * 240 : 0);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
}
function makeArea(years, vals, max, active) {
  const w = 730 / (years.length - 1);
  const top = vals.map((v, i) => {
    const x = 50 + i * w;
    const y = 280 - (active ? (v / max) * 240 : 0);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  return `${top} L 780 280 L 50 280 Z`;
}

// ─────────────────────────────────────────────────────────────────────────
// ROADMAP TIMELINE
// ─────────────────────────────────────────────────────────────────────────
export function RoadmapView({ active }) {
  const data = COPY.roadmap.data;
  const cats = COPY.roadmap.cats;
  const YEAR_COLOR = COPY.roadmap.yearColors;
  const years = Object.keys(data);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (active && open === null) {
      const t = setTimeout(() => setOpen(0), 600);
      return () => clearTimeout(t);
    }
  }, [active, open]);

  return (
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {years.map((y, i) => (
          <div key={y} onClick={() => setOpen(open === i ? null : i)}
               style={{
                 flex: 1, cursor: "pointer",
                 opacity: active ? 1 : 0,
                 transform: active ? "translateY(0)" : `translateY(${28 + i * 8}px)`,
                 transition: `all 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 0.08}s`,
               }}>
            <div style={{
              height: 7, borderRadius: 4, background: YEAR_COLOR[y], marginBottom: 12,
              boxShadow: open === i ? `0 0 20px ${YEAR_COLOR[y]}aa` : `0 0 10px ${YEAR_COLOR[y]}55`,
              transition: "box-shadow 0.3s",
            }} />
            <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 22, color: open === i ? YEAR_COLOR[y] : P.white, textAlign: "center" }}>{y}</div>
          </div>
        ))}
      </div>
      {open !== null && (() => {
        const y = years[open];
        const color = YEAR_COLOR[y];
        const d = data[y];
        return (
          <div style={{ background: `${color}10`, border: `1px solid ${color}40`, borderRadius: 18, padding: "22px 26px", animation: "fadeSlideUp 0.4s ease" }}>
            <div style={{ fontFamily: FF_MONO, fontSize: 11, color, letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" }}>
              {y} · {COPY.ui.roadmapMilestones}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px 24px" }}>
              {cats.map(c => {
                const items = d[c.id] || [];
                if (!items.length) return null;
                return (
                  <div key={c.id}>
                    <div style={{
                      fontSize: 11, fontFamily: FF_MONO, color: `${color}dd`, letterSpacing: 1,
                      textTransform: "uppercase", marginBottom: 6, borderBottom: `1px solid ${color}33`, paddingBottom: 4,
                      display: "flex", gap: 6, alignItems: "center",
                    }}>
                      <span style={{ fontSize: 13 }}>{c.icon}</span>{c.label}
                    </div>
                    {items.map((it, j) => (
                      <div key={j} style={{ fontSize: 12, color: "rgba(244,224,255,0.78)", lineHeight: 1.55, marginBottom: 3, display: "flex", gap: 6 }}>
                        <span style={{ color, fontSize: 8, marginTop: 6, flexShrink: 0 }}>◆</span>{it}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      {open === null && (
        <div style={{ textAlign: "center", color: P.muted, fontSize: 12, fontStyle: "italic", marginTop: 16 }}>
          {COPY.ui.roadmapTapHint}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6G TIMELINE
// ─────────────────────────────────────────────────────────────────────────
export function SixGRoadmap({ active }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, width: "100%", maxWidth: 980, margin: "0 auto" }}>
      {COPY.sixg.items.map((it, i) => (
        <Reveal key={it.rel} active={active} delay={0.15 + i * 0.1}>
          <div style={{
            background: `linear-gradient(180deg, ${it.color}0e, transparent)`,
            border: `1px solid ${it.color}30`, borderRadius: 14, padding: "16px 14px", minHeight: 220,
          }}>
            <div style={{ height: 5, background: it.color, borderRadius: 3, marginBottom: 10, boxShadow: `0 0 10px ${it.color}aa` }} />
            <div style={{ fontFamily: FF_MONO, fontSize: 11, fontWeight: 700, color: it.color, letterSpacing: 1 }}>{it.rel}</div>
            <div style={{ fontSize: 10, color: P.muted, marginTop: 2 }}>{it.period}</div>
            <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 16, color: P.white, marginTop: 6, marginBottom: 10, lineHeight: 1.15 }}>{it.label}</div>
            {it.bullets.map((b, j) => (
              <div key={j} style={{ fontSize: 11, color: P.dim, lineHeight: 1.5, display: "flex", gap: 6, marginBottom: 3 }}>
                <span style={{ color: it.color, fontSize: 7, marginTop: 6 }}>◆</span>{b}
              </div>
            ))}
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Small presentational helpers for section headers (read text from COPY)
// ═════════════════════════════════════════════════════════════════════════
export function Kicker({ children, color, align = "center", mb = 14 }) {
  return (
    <div style={{ fontFamily: FF_MONO, fontSize: 12, color, letterSpacing: 4, marginBottom: mb, textTransform: "uppercase", textAlign: align }}>
      {children}
    </div>
  );
}
export function Heading({ parts, size = "clamp(26px, 5vw, 52px)", mb = 12, lineHeight = 1.1 }) {
  return (
    <h2 style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: size, textAlign: "center", margin: `0 0 ${mb}px`, letterSpacing: -1, lineHeight }}>
      <Rich parts={parts} />
    </h2>
  );
}
export function Lede({ children, size = 15, mb = 28, max = 780 }) {
  return (
    <div style={{ textAlign: "center", color: P.dim, fontSize: size, marginBottom: mb, maxWidth: max, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// NORTHSTAR TOPOLOGY CIRCLE — core / edge / RAN with nomadic towers
// ─────────────────────────────────────────────────────────────────────────
function NorthStarCircle({ active }) {
  const R_OUT = 268, R_MID = 175, R_IN = 88;
  const TOWERS = 10, NOMADIC = 3, EDGE = 12;

  const renderTower = (key, x, y, deg, color, isNomadic) => (
    <g key={key} transform={`translate(${x},${y}) rotate(${deg})`}>
      {/* Triangular truss — two outer legs widening to the base */}
      <line x1="-5" y1="3" x2="-1.5" y2="-14" stroke={color} strokeWidth="1.4" />
      <line x1="5" y1="3" x2="1.5" y2="-14" stroke={color} strokeWidth="1.4" />
      {/* Base bar */}
      <line x1="-6" y1="3" x2="6" y2="3" stroke={color} strokeWidth="1" />
      {/* Horizontal rungs */}
      <line x1="-4.5" y1="-3" x2="4.5" y2="-3" stroke={color} strokeWidth="0.8" />
      <line x1="-3.2" y1="-9" x2="3.2" y2="-9" stroke={color} strokeWidth="0.8" />
      {/* X-brace lattice */}
      <line x1="-5" y1="3" x2="0" y2="-3" stroke={color} strokeOpacity="0.55" strokeWidth="0.6" />
      <line x1="5" y1="3" x2="0" y2="-3" stroke={color} strokeOpacity="0.55" strokeWidth="0.6" />
      <line x1="-4" y1="-3" x2="0" y2="-9" stroke={color} strokeOpacity="0.55" strokeWidth="0.6" />
      <line x1="4" y1="-3" x2="0" y2="-9" stroke={color} strokeOpacity="0.55" strokeWidth="0.6" />
      <line x1="-2.5" y1="-9" x2="0" y2="-14" stroke={color} strokeOpacity="0.55" strokeWidth="0.6" />
      <line x1="2.5" y1="-9" x2="0" y2="-14" stroke={color} strokeOpacity="0.55" strokeWidth="0.6" />
      {/* Top platform */}
      <line x1="-2.6" y1="-14" x2="2.6" y2="-14" stroke={color} strokeWidth="1.4" />
      {/* Three sector-antenna panels at the top */}
      <rect x="-3.6" y="-18.5" width="1.7" height="4.6" rx="0.4" fill={color} />
      <rect x="-0.85" y="-19.6" width="1.7" height="5.7" rx="0.4" fill={color} />
      <rect x="1.9" y="-18.5" width="1.7" height="4.6" rx="0.4" fill={color} />
      {/* Signal lobes */}
      <path d="M -8 -19 Q 0 -27 8 -19" fill="none" stroke={color} strokeOpacity="0.6" strokeWidth="0.9" />
      <path d="M -11 -20 Q 0 -32 11 -20" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="0.7" />
      {isNomadic && (
        <circle cx="0" cy="-22" r="3" fill="none" stroke={color} strokeWidth="0.8">
          <animate attributeName="r" from="3" to="14" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.85" to="0" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );

  const staticT = Array.from({ length: TOWERS }, (_, i) => {
    const a = (i / TOWERS) * 2 * Math.PI - Math.PI / 2 + Math.PI / TOWERS;
    return { x: Math.cos(a) * R_OUT, y: Math.sin(a) * R_OUT, deg: (a * 180 / Math.PI) + 90 };
  });
  const nomadicT = Array.from({ length: NOMADIC }, (_, i) => {
    const a = -Math.PI / 2 + 0.55 + (i - 1) * 0.22;
    return { x: Math.cos(a) * R_OUT, y: Math.sin(a) * R_OUT, deg: (a * 180 / Math.PI) + 90 };
  });
  const edges = Array.from({ length: EDGE }, (_, i) => {
    const a = (i / EDGE) * 2 * Math.PI - Math.PI / 2;
    return { x: Math.cos(a) * R_MID, y: Math.sin(a) * R_MID, isReg: i % 4 === 0 };
  });

  return (
    <svg viewBox="-300 -300 600 600" style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
      {/* Soft glow under outer ring */}
      <circle r={R_OUT} fill="none" stroke={`${P.cyan}1f`} strokeWidth="16" />
      {/* Three concentric rings */}
      <circle r={R_OUT} fill="none" stroke={`${P.cyan}55`} strokeWidth="1.4" strokeDasharray="3 6" />
      <circle r={R_MID} fill="none" stroke={`${P.magenta}55`} strokeWidth="1.4" strokeDasharray="3 6" />
      <circle r={R_IN} fill={`${P.deep}cc`} stroke={`${P.cyan}aa`} strokeWidth="2" />

      {/* Ring labels (just outside each ring) */}
      <text x="0" y={-(R_OUT + 18)} textAnchor="middle" fontFamily={FF_MONO} fontSize="11" fill={P.cyan} letterSpacing="2">5G RAN · including nomadic coverage</text>
      <text x="0" y={-(R_MID + 14)} textAnchor="middle" fontFamily={FF_MONO} fontSize="11" fill={P.light} letterSpacing="2">5G edge nodes with AI</text>

      {/* Center: 5G SA CORE — title + three chips */}
      <g fontFamily={FF_MONO} textAnchor="middle">
        <text x="0" y="-52" fontSize="10" fill={P.cyan} letterSpacing="2">5G SA CORE</text>
        {[
          { x: -32, y: -15, label: "Public", color: P.dim },
          { x: 32, y: -15, label: "Innovation", color: P.cyan },
          { x: 0, y: 33, label: "Special purpose", color: P.gold },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x},${c.y})`}>
            {/* Outer hex glow */}
            <polygon points="-15,0 -7.5,-13 7.5,-13 15,0 7.5,13 -7.5,13" fill="none" stroke={`${c.color}40`} strokeWidth="2.5" />
            {/* Hex body */}
            <polygon points="-13,0 -6.5,-11.3 6.5,-11.3 13,0 6.5,11.3 -6.5,11.3" fill={`${c.color}33`} stroke={c.color} strokeWidth="1.4" />
            {/* Inner top highlight */}
            <polygon points="-9,-1 -4.5,-8 4.5,-8 9,-1" fill={`${c.color}38`} stroke="none" />
            {/* Vertex link dots (suggest network links) */}
            <circle cx="-13" cy="0" r="1.3" fill={c.color} />
            <circle cx="13" cy="0" r="1.3" fill={c.color} />
            {/* 5G label */}
            <text y="3" fontSize="8" fill={c.color} fontWeight="700">5G</text>
            {/* Core name */}
            <text y="24" fontSize="8" fill={c.color}>{c.label}</text>
          </g>
        ))}
      </g>

      {/* Edge nodes (middle ring) */}
      {edges.map((n, i) => {
        const c = n.isReg ? P.gold : P.cyan;
        return (
          <g key={`e${i}`} transform={`translate(${n.x},${n.y})`}>
            {/* Soft halo */}
            <rect x="-11" y="-10" width="22" height="20" rx="3" fill={`${c}1f`} stroke="none" />
            {/* Server cabinet body */}
            <rect x="-9" y="-9" width="18" height="18" rx="2.5" fill={`${c}40`} stroke={c} strokeWidth="1.2" />
            {/* Blade slots */}
            <line x1="-6" y1="-5" x2="6" y2="-5" stroke={c} strokeOpacity="0.75" strokeWidth="0.7" />
            <line x1="-6" y1="-1.5" x2="6" y2="-1.5" stroke={c} strokeOpacity="0.75" strokeWidth="0.7" />
            <line x1="-6" y1="2" x2="6" y2="2" stroke={c} strokeOpacity="0.75" strokeWidth="0.7" />
            <line x1="-6" y1="5.5" x2="6" y2="5.5" stroke={c} strokeOpacity="0.75" strokeWidth="0.7" />
            {/* Status / AI LEDs */}
            <circle cx="6.5" cy="-7" r="1.2" fill={c} />
            <circle cx="-6.5" cy="-7" r="1.1" fill={`${c}80`} />
            <text x="0" y="24" textAnchor="middle" fontFamily={FF_MONO} fontSize="8" fill={n.isReg ? P.gold : P.dim}>{n.isReg ? "regional" : "local"}</text>
          </g>
        );
      })}

      {/* Static towers (outer ring) */}
      {staticT.map((t, i) => renderTower(`t${i}`, t.x, t.y, t.deg, P.light, false))}

      {/* Nomadic towers — a group that rotates around the perimeter */}
      <g>
        {nomadicT.map((t, i) => renderTower(`n${i}`, t.x, t.y, t.deg, P.gold, true))}
        {active && (
          <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="55s" repeatCount="indefinite" />
        )}
      </g>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════
export default function NorthStarFutureVision() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const ref = useRef(null);

  const onScroll = useCallback(() => {
    const el = ref.current; if (!el) return;
    setProgress(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight));
    const cur = Math.round(el.scrollTop / el.clientHeight);
    if (cur !== active) setActive(cur);
  }, [active]);

  const scrollTo = (i) => ref.current?.scrollTo({ top: i * ref.current.clientHeight, behavior: "smooth" });

  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const S = {
    height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
    position: "relative", padding: "40px 60px", scrollSnapAlign: "start", boxSizing: "border-box",
  };

  return (
    <div style={{ width: "100%", height: "100vh", background: P.deep, fontFamily: FF_BODY, color: P.white, overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse  { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        @keyframes drift  { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes spin   { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        * { scrollbar-width: none; } *::-webkit-scrollbar { display: none; }
      `}</style>

      <NeuralNebula active={active} />

      {/* Progress bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, height: 3, zIndex: 100, width: `${progress * 100}%`,
        background: `linear-gradient(90deg, ${P.purple}, ${P.magenta}, ${P.cyan}, ${P.gold})`,
        transition: "width 0.1s", boxShadow: `0 0 16px ${P.purple}88`,
      }} />

      {/* Nav dots */}
      <div style={{ position: "fixed", right: 22, top: "50%", transform: "translateY(-50%)", zIndex: 100, display: "flex", flexDirection: "column", gap: 10 }}>
        {SECTIONS.map((id, i) => (
          <div key={id} onClick={() => scrollTo(i)} title={COPY.navLabels[i] || "Start"} style={{
            width: active === i ? 12 : 7, height: active === i ? 12 : 7, borderRadius: "50%",
            background: active === i ? P.light : "rgba(244,224,255,0.18)",
            cursor: "pointer", transition: "all 0.3s", boxShadow: active === i ? `0 0 14px ${P.light}aa` : "none",
          }} />
        ))}
      </div>

      {/* Back link */}
      <a href="index.html" style={{
        position: "fixed", top: 18, right: 24, zIndex: 110, fontFamily: FF_BODY, fontSize: 12, color: P.light,
        textDecoration: "none", letterSpacing: 1, opacity: 0.65, padding: "6px 12px", borderRadius: 999, border: `1px solid ${P.faint}`,
      }}>{COPY.ui.backLink}</a>

      {/* Top-left logos */}
      <div style={{ position: "fixed", top: 16, left: 24, zIndex: 100, display: "flex", alignItems: "center", gap: 14, opacity: 0.7 }}>
        <img src={new URL("../assets/images/Telia_Logotype_RGB_Purple.png", import.meta.url)} alt="Telia" style={{ height: 36, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>×</span>
        <img src={new URL("../assets/images/Eric.png", import.meta.url)} alt="Ericsson" style={{ height: 36, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
      </div>

      <div ref={ref} style={{ height: "100vh", overflowY: "auto", scrollSnapType: "y mandatory", position: "relative", zIndex: 1 }}>

        {/* ════════════ 0. HERO ════════════ */}
        <div style={S}>
          <div style={{ textAlign: "center", maxWidth: 1100 }}>
            <Reveal active={active === 0}>
              <div style={{ fontFamily: FF_MONO, fontSize: 12, color: P.cyan, letterSpacing: 6, textTransform: "uppercase", marginBottom: 26 }}>
                {COPY.hero.kicker}
              </div>
            </Reveal>
            <Reveal active={active === 0} delay={0.1}>
              <h1 style={{
                fontSize: "clamp(56px, 10vw, 140px)", fontWeight: 300, fontFamily: FF_HEAD, margin: 0, lineHeight: 0.92, letterSpacing: -3,
                background: `linear-gradient(135deg, ${P.white} 0%, ${P.light} 35%, ${P.cyan} 65%, ${P.magenta} 100%)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundSize: "200% 200%", animation: "shimmer 8s ease-in-out infinite",
              }}>{COPY.hero.title}</h1>
            </Reveal>
            <Reveal active={active === 0} delay={0.25}>
              <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: "clamp(20px, 2.8vw, 32px)", color: P.white, marginTop: 18, lineHeight: 1.3 }}>
                <Rich parts={COPY.hero.subtitle} />
              </div>
            </Reveal>
            <Reveal active={active === 0} delay={0.45}>
              <div style={{ display: "flex", justifyContent: "center", gap: 56, marginTop: 60, flexWrap: "wrap" }}>
                {COPY.hero.stats.map((s, i) => (
                  <Reveal key={i} active={active === 0} delay={0.5 + i * 0.12}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 44, color: P.light, letterSpacing: -1 }}>
                        <Counter to={s.v} prefix={s.pre} suffix={s.suf} active={active === 0} decimals={s.dec} />
                      </div>
                      <div style={{ fontSize: 11, color: P.muted, marginTop: 6, letterSpacing: 1, maxWidth: 140 }}>{s.label}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </Reveal>
            <Reveal active={active === 0} delay={0.95}>
              <div style={{ marginTop: 28, fontSize: 12, color: P.dim, maxWidth: 680, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
                {COPY.hero.note}
              </div>
            </Reveal>
            <div style={{ marginTop: 36, animation: "pulse 2s infinite", color: P.muted, fontSize: 12, letterSpacing: 2 }}>
              {COPY.ui.scrollHint}
            </div>
          </div>
        </div>

        {/* ════════════ 1. THE INFLECTION POINT ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1080, width: "100%" }}>
            <Reveal active={active === 1}><Kicker color={P.gold}>{COPY.inflection.kicker}</Kicker></Reveal>
            <Reveal active={active === 1} delay={0.1}>
              <Heading parts={COPY.inflection.headline} size="clamp(28px, 5vw, 56px)" mb={0} />
            </Reveal>

            <div style={{ marginTop: 50, position: "relative" }}>
              <div style={{
                position: "absolute", left: "5%", right: "5%", top: 42, height: 3,
                background: `linear-gradient(90deg, ${P.faint}, ${P.purple} 32%, ${P.cyan} 48%, ${P.gold} 62%, ${P.green})`,
                borderRadius: 2, boxShadow: `0 0 14px ${P.cyan}55`,
              }} />
              <div style={{
                position: "absolute", left: "calc(100% * 18.5 / 30)", top: 30, width: 28, height: 28, borderRadius: "50%",
                background: P.gold, boxShadow: `0 0 22px ${P.gold}, 0 0 50px ${P.gold}88`, animation: "pulse 1.8s ease-in-out infinite",
                transform: "translateX(-50%)", opacity: active === 1 ? 1 : 0, transition: "opacity 0.6s ease 0.4s",
              }} />
              <div style={{
                position: "absolute", left: "calc(100% * 18.5 / 30)", top: 0, transform: "translateX(-50%)",
                fontFamily: FF_MONO, fontSize: 11, color: P.gold, letterSpacing: 2,
                opacity: active === 1 ? 1 : 0, transition: "opacity 0.6s ease 0.5s", textTransform: "uppercase",
              }}>{COPY.inflection.youAreHere}</div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 3fr 3fr 5fr 7fr 8fr", gap: 0, marginTop: 90 }}>
                {COPY.inflection.eras.map((p, i) => (
                  <Reveal key={p.era} active={active === 1} delay={0.2 + i * 0.08}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: FF_MONO, fontSize: 12, fontWeight: 700, color: p.c, letterSpacing: 1 }}>{p.era}</div>
                      <div style={{ fontFamily: FF_MONO, fontSize: 10, color: P.muted, marginTop: 2 }}>{p.y}</div>
                      <div style={{ fontSize: 11, color: P.dim, marginTop: 6 }}>{p.t}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal active={active === 1} delay={0.6}>
              <div style={{
                marginTop: 50, background: `linear-gradient(135deg, ${P.purple}0e, ${P.cyan}0e)`,
                border: `1px solid ${P.purple}30`, borderRadius: 18, padding: "28px 32px",
                fontSize: 15, color: "rgba(244,224,255,0.85)", lineHeight: 1.65, textAlign: "center",
              }}>
                <Rich parts={COPY.inflection.note} />
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 2. THREE WAVES ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 2}><Kicker color={P.cyan}>{COPY.waves.kicker}</Kicker></Reveal>
            <Reveal active={active === 2} delay={0.08}><Heading parts={COPY.waves.headline} size="clamp(28px, 5vw, 52px)" mb={36} /></Reveal>
            <WaveBands active={active === 2} />
          </div>
        </div>

        {/* ════════════ 3. NORTHSTAR INNOVATION NETWORK ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1180, width: "100%" }}>
            <Reveal active={active === 3}><Kicker color={P.cyan}>{COPY.innovation.kicker}</Kicker></Reveal>
            <Reveal active={active === 3} delay={0.08}><Heading parts={COPY.innovation.headline} size="clamp(26px, 5vw, 50px)" mb={10} /></Reveal>
            <Reveal active={active === 3} delay={0.16}><Lede size={14} mb={14} max={820}>{COPY.innovation.body}</Lede></Reveal>
            <div style={{ position: "relative", width: "100%", height: 580, marginTop: 6 }}>
              <Reveal active={active === 3} delay={0.24} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                <div style={{ width: 560, height: 560 }}>
                  <NorthStarCircle active={active === 3} />
                </div>
              </Reveal>
              {COPY.innovation.pillars.map((p, i) => {
                const corners = [
                  { top: 6, left: 6 },
                  { top: 6, right: 6 },
                  { bottom: 60, left: 6 },
                  { bottom: 60, right: 6 },
                ];
                return (
                  <Reveal key={i} active={active === 3} delay={0.4 + i * 0.08} style={{ position: "absolute", ...corners[i], width: 290, zIndex: 2 }}>
                    <div style={{
                      background: `linear-gradient(180deg, ${p.c}26, rgba(20,8,38,0.85))`,
                      border: `1px solid ${p.c}66`, borderRadius: 14, padding: "12px 14px",
                      boxShadow: "0 10px 28px rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                      <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 15, color: P.white, marginBottom: 4, lineHeight: 1.2 }}>{p.title}</div>
                      <div style={{ fontSize: 11.5, color: P.dim, lineHeight: 1.5 }}>{p.desc}</div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>

        {/* ════════════ 4. ASTAZERO LATENCY DEMO ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1180, width: "100%" }}>
            <Reveal active={active === 4}><Kicker color={P.cyan}>{COPY.demo.kicker}</Kicker></Reveal>
            <Reveal active={active === 4} delay={0.08}><Heading parts={COPY.demo.headline} size="clamp(26px, 5vw, 50px)" mb={12} /></Reveal>
            <Reveal active={active === 4} delay={0.16}><Lede size={14} mb={26} max={900}>{COPY.demo.body}</Lede></Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
              {COPY.demo.clips.map((clip, i) => (
                <Reveal key={i} active={active === 4} delay={0.26 + i * 0.12}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontFamily: FF_MONO, fontSize: 12, color: clip.c, letterSpacing: 1, textTransform: "uppercase" }}>{clip.tag}</div>
                    <video
                      src={DEMO_VIDEOS[i]} autoPlay muted loop playsInline controls preload="metadata"
                      style={{ width: "100%", borderRadius: 14, border: `1px solid ${clip.c}59`, boxShadow: "0 10px 34px rgba(0,0,0,0.45)", display: "block", background: "#000" }}
                    />
                    <div style={{ fontSize: 13, color: P.dim, lineHeight: 1.55 }}>{clip.outcome}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════ 5. INSIDE THE CORE — iframe ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1280, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <Reveal active={active === 5}><Kicker color={P.gold} mb={8}>{COPY.core.kicker}</Kicker></Reveal>
            <Reveal active={active === 5} delay={0.08}><Heading parts={COPY.core.headline} size="clamp(24px, 4vw, 42px)" mb={14} /></Reveal>
            <Reveal active={active === 5} delay={0.16}><Lede size={14} mb={16} max={760}>{COPY.core.body}</Lede></Reveal>
            <Reveal active={active === 5} delay={0.24} style={{ flex: 1, minHeight: 0 }}>
              <div style={{
                width: "100%", height: "100%", minHeight: 480, borderRadius: 18, overflow: "hidden",
                border: `1px solid ${P.purple}33`, boxShadow: `0 20px 60px rgba(0,0,0,0.45), 0 0 24px ${P.purple}33`, background: P.dark,
              }}>
                <iframe src="unified-5g-viz.html?teaser=1" title="Network slicing — animated preview" style={{ width: "100%", height: "100%", border: 0, display: "block", pointerEvents: "none" }} loading="lazy" />
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 6. LIVE SLICING — iframe ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1280, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <Reveal active={active === 6}><Kicker color={P.cyan} mb={8}>{COPY.slicing.kicker}</Kicker></Reveal>
            <Reveal active={active === 6} delay={0.08}><Heading parts={COPY.slicing.headline} size="clamp(24px, 4vw, 42px)" mb={14} /></Reveal>
            <Reveal active={active === 6} delay={0.16}><Lede size={14} mb={16} max={820}>{COPY.slicing.body}</Lede></Reveal>
            <Reveal active={active === 6} delay={0.24} style={{ flex: 1, minHeight: 0 }}>
              <div style={{
                width: "100%", height: "100%", minHeight: 480, borderRadius: 18, overflow: "hidden",
                border: `1px solid ${P.cyan}33`, boxShadow: `0 20px 60px rgba(0,0,0,0.45), 0 0 24px ${P.cyan}33`, background: P.dark,
              }}>
                <iframe src="5g-sa-architecture-diagram.html?teaser=1" title="Radio spectrum — animated preview" style={{ width: "100%", height: "100%", border: 0, display: "block", pointerEvents: "none" }} loading="lazy" />
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 7. AI-NATIVE NETWORKS ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 7}><Kicker color={P.magenta}>{COPY.ainative.kicker}</Kicker></Reveal>
            <Reveal active={active === 7} delay={0.08}><Heading parts={COPY.ainative.headline} mb={8} /></Reveal>
            <Reveal active={active === 7} delay={0.16}><Lede mb={24}>{COPY.ainative.body}</Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "center" }}>
              <Reveal active={active === 7} delay={0.24}>
                <div>
                  <ClosedLoopSVG active={active === 7} />
                  <p style={{ margin: "12px 6px 0", fontSize: 11.5, color: P.dim, lineHeight: 1.55 }}>
                    <Rich parts={COPY.ainative.note} />
                  </p>
                </div>
              </Reveal>
              <Reveal active={active === 7} delay={0.34}>
                <div>
                  {COPY.ainative.points.map((it, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ width: 6, borderRadius: 3, background: `linear-gradient(180deg, ${it.color}, transparent)` }} />
                        <div>
                          <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 18, color: P.white, marginBottom: 4 }}>{it.title}</div>
                          <div style={{ fontSize: 12.5, color: P.dim, lineHeight: 1.55 }}>{it.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ════════════ 8. AMBIENT — ISAC ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 8}><Kicker color={P.gold}>{COPY.ambient.kicker}</Kicker></Reveal>
            <Reveal active={active === 8} delay={0.08}><Heading parts={COPY.ambient.headline} mb={12} /></Reveal>
            <Reveal active={active === 8} delay={0.16}><Lede mb={32} max={800}><Rich parts={COPY.ambient.body} /></Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center" }}>
              <Reveal active={active === 8} delay={0.24}><ISACVisual active={active === 8} /></Reveal>
              <Reveal active={active === 8} delay={0.34}>
                <div>
                  {COPY.ambient.uses.map((u, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 22 }}>{u.icon}</div>
                      <div>
                        <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 16, color: P.white }}>{u.title}</div>
                        <div style={{ fontSize: 12, color: P.dim, lineHeight: 1.5 }}>{u.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ════════════ 9. POSITIONING ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 9}><Kicker color={P.green}>{COPY.positioning.kicker}</Kicker></Reveal>
            <Reveal active={active === 9} delay={0.08}><Heading parts={COPY.positioning.headline} mb={12} /></Reveal>
            <Reveal active={active === 9} delay={0.16}><Lede mb={30} max={760}>{COPY.positioning.body}</Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
              {COPY.positioning.ladder.map((p, i) => (
                <Reveal key={i} active={active === 9} delay={0.22 + i * 0.1}>
                  <div style={{
                    background: `linear-gradient(180deg, ${p.color}26, rgba(255,255,255,0.045))`,
                    border: `1px solid ${p.color}59`, borderRadius: 16, padding: "18px 16px", textAlign: "center", height: 200, position: "relative",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                  }}>
                    <div style={{ fontFamily: FF_MONO, fontSize: 11, color: p.color, letterSpacing: 1, marginBottom: 14 }}>{p.era}</div>
                    <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 36, color: P.white, marginBottom: 8, letterSpacing: -1 }}>{p.acc}</div>
                    <div style={{ fontSize: 11, color: P.dim, lineHeight: 1.5 }}>{p.detail}</div>
                    <div style={{
                      position: "absolute", left: "50%", bottom: 12, transform: "translateX(-50%)",
                      width: i < 3 ? `${50 - i * 12}%` : "8%", height: 6, borderRadius: 3,
                      background: p.color, boxShadow: `0 0 12px ${p.color}aa`, opacity: 0.7,
                    }} />
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal active={active === 9} delay={0.65}>
              <div style={{ marginTop: 30, borderTop: `1px solid ${P.faint}`, paddingTop: 18 }}>
                <div style={{ fontFamily: FF_MONO, fontSize: 11, color: P.dim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>{COPY.positioning.examplesTitle}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 12, color: P.dim }}>
                  {COPY.positioning.examples.map((it, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${P.faint}`, borderRadius: 12, padding: "14px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 22 }}>{it.icon}</span>
                      <span style={{ lineHeight: 1.5 }}>{it.what}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 10. NTN ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 10}><Kicker color={P.cyan}>{COPY.ntn.kicker}</Kicker></Reveal>
            <Reveal active={active === 10} delay={0.08}><Heading parts={COPY.ntn.headline} mb={12} /></Reveal>
            <Reveal active={active === 10} delay={0.16}><Lede mb={30} max={760}>{COPY.ntn.body}</Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 32, alignItems: "center" }}>
              <Reveal active={active === 10} delay={0.24}><OrbitalView active={active === 10} /></Reveal>
              <Reveal active={active === 10} delay={0.34}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {COPY.ntn.items.map((it, i) => (
                    <div key={i} style={{ background: `linear-gradient(180deg, ${it.c}10, transparent)`, border: `1px solid ${it.c}30`, borderRadius: 14, padding: "16px 14px" }}>
                      <div style={{ fontFamily: FF_MONO, fontSize: 10, color: it.c, letterSpacing: 1, marginBottom: 6 }}>{it.y}</div>
                      <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 16, color: P.white, marginBottom: 6, lineHeight: 1.2 }}>{it.title}</div>
                      <div style={{ fontSize: 11, color: P.dim, lineHeight: 1.5 }}>{it.desc}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal active={active === 10} delay={0.5}>
              <p style={{ margin: "20px auto 0", maxWidth: 860, fontSize: 11.5, color: P.dim, lineHeight: 1.55, textAlign: "center" }}>
                <Rich parts={COPY.ntn.note} />
              </p>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 11. VERTICAL TRANSFORMATIONS ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1140, width: "100%" }}>
            <Reveal active={active === 11}><Kicker color={P.magenta}>{COPY.verticals.kicker}</Kicker></Reveal>
            <Reveal active={active === 11} delay={0.08}><Heading parts={COPY.verticals.headline} size="clamp(26px, 5vw, 50px)" mb={10} /></Reveal>
            <Reveal active={active === 11} delay={0.16}><Lede size={14} mb={28} max={720}>{COPY.verticals.body}</Lede></Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "1fr", gap: 14 }}>
              {COPY.verticals.cards.map((c, i) => (
                <VerticalCard key={i} active={active === 11} delay={0.22 + i * 0.08}
                  icon={c.icon} year={c.year} title={c.title} color={c.color} body={c.body} tech={c.tech} />
              ))}
            </div>
          </div>
        </div>

        {/* ════════════ 12. THE BUSINESS MODEL SHIFT ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1100, width: "100%" }}>
            <Reveal active={active === 12}><Kicker color={P.gold}>{COPY.economy.kicker}</Kicker></Reveal>
            <Reveal active={active === 12} delay={0.08}><Heading parts={COPY.economy.headline} size="clamp(26px, 5vw, 50px)" mb={12} /></Reveal>
            <Reveal active={active === 12} delay={0.16}><Lede size={14} mb={24} max={760}>{COPY.economy.body}</Lede></Reveal>
            <Reveal active={active === 12} delay={0.24}><EconomyChart active={active === 12} /></Reveal>
            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {COPY.economy.stats.map((s, i) => (
                <Reveal key={i} active={active === 12} delay={0.4 + i * 0.08}>
                  <div style={{ border: `1px solid ${s.c}33`, borderRadius: 14, padding: "16px 14px", background: `linear-gradient(180deg, ${s.c}0e, transparent)`, textAlign: "center" }}>
                    <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: 26, color: s.c, letterSpacing: -0.5 }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: P.dim, marginTop: 4, lineHeight: 1.4 }}>{s.l}</div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal active={active === 12} delay={0.72}>
              <div style={{ marginTop: 16, fontSize: 12, color: P.dim, textAlign: "center", lineHeight: 1.5, maxWidth: 820, marginLeft: "auto", marginRight: "auto" }}>
                {COPY.economy.note}
              </div>
            </Reveal>
          </div>
        </div>

        {/* ════════════ 13. VISION / CTA ════════════ */}
        <div style={S}>
          <div style={{ maxWidth: 1000, textAlign: "center" }}>
            <Reveal active={active === 13}>
              <div style={{ fontFamily: FF_MONO, fontSize: 12, color: P.cyan, letterSpacing: 6, textTransform: "uppercase", marginBottom: 28 }}>{COPY.vision.kicker}</div>
            </Reveal>
            <Reveal active={active === 13} delay={0.1}>
              <div style={{ fontFamily: FF_HEAD, fontWeight: 300, fontSize: "clamp(36px, 6.5vw, 76px)", lineHeight: 1.05, letterSpacing: -2 }}>
                <Rich parts={COPY.vision.headline} />
              </div>
            </Reveal>
            <Reveal active={active === 13} delay={0.3}>
              <p style={{ fontSize: 17, color: P.dim, marginTop: 32, lineHeight: 1.7, maxWidth: 720, margin: "32px auto 0" }}>
                {COPY.vision.body}
              </p>
            </Reveal>
            <Reveal active={active === 13} delay={0.5}>
              <div style={{ marginTop: 44, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
                {COPY.vision.ctas.map((c, i) => (
                  <a key={i} href={c.href} style={c.primary ? ctaPrimary : ctaGhost}>{c.label}</a>
                ))}
              </div>
            </Reveal>
            <div style={{ marginTop: 60, fontFamily: FF_MONO, fontSize: 10, color: P.faint, letterSpacing: 3 }}>
              {COPY.ui.footer}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

const ctaPrimary = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px",
  background: `linear-gradient(135deg, ${P.purple}, ${P.magenta})`,
  color: P.white, borderRadius: 999, textDecoration: "none", fontWeight: 500, fontSize: 14,
  border: 0, transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
  boxShadow: `0 8px 22px ${P.purple}55`,
};
const ctaGhost = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px",
  background: "transparent", color: P.light, border: `1px solid ${P.light}55`,
  borderRadius: 999, textDecoration: "none", fontWeight: 500, fontSize: 14,
  transition: "background 0.2s, color 0.2s, border-color 0.2s",
};
