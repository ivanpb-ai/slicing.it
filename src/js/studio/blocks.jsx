// ─────────────────────────────────────────────────────────────────────────
// Block renderer — turns one element of the model into pixels. A <Block> is
// purely visual; selection / drag / resize live in stage.jsx. Every block is
// driven by element.props + element.style and animated via effects.js.
//
//   mode  "edit"    static, final state, no idle motion, pointer-transparent
//         "present" full entrance + idle motion, interactive (links/buttons)
//         "thumb"   static, for navigator previews
//   active in present mode, true once the slide is on screen (triggers entrance)
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { P, FONTS } from "./model";
import { entranceTransition, idleAnimation } from "./effects";
import { chartMarkup } from "./chart-svg";

const justify = (a) => (a === "left" ? "flex-start" : a === "right" ? "flex-end" : "center");

// Positioned, animated frame shared by every block.
function Frame({ el, active, mode, children }) {
  const shown = mode === "present" ? active : true;
  const ent = entranceTransition(el.anim, shown);
  const rot = el.rotation ? `rotate(${el.rotation}deg)` : "";
  const outer = {
    position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, boxSizing: "border-box",
    opacity: (el.style?.opacity ?? 1) * ent.opacity,
    filter: ent.filter,
    transform: `${rot} ${ent.transform}`.trim(),
    transition: ent.transition,
    pointerEvents: mode === "present" ? "auto" : "none",
  };
  const idle = mode === "present" ? idleAnimation(el.anim?.idle) : "none";
  return (
    <div style={outer}>
      <div style={{ width: "100%", height: "100%", animation: idle }}>{children}</div>
    </div>
  );
}

// ── count-up used by Counter + Ring ────────────────────────────────────────
function useCountUp(to, run, dur = 1.5) {
  const [v, setV] = useState(run ? 0 : to);
  useEffect(() => {
    if (!run) { setV(to); return; }
    let raf = 0; const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / (dur * 1000));
      setV((1 - Math.pow(1 - p, 3)) * to);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run, dur]);
  return v;
}

// ── text family ────────────────────────────────────────────────────────────
function Heading({ el, mode }) {
  const s = el.style; const text = el.props.text || (mode === "edit" ? "Heading" : "");
  const grad = el.props.gradient;
  const shimmer = el.anim?.idle === "shimmer" && grad;
  const span = grad
    ? {
        backgroundImage: `linear-gradient(120deg, ${grad.join(", ")})`,
        WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
        ...(shimmer ? { backgroundSize: "200% auto", animation: "stShimmer 6s linear infinite" } : {}),
      }
    : { color: s.color };
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: justify(s.align), textAlign: s.align, fontFamily: s.fontFamily || FONTS.head, fontWeight: s.fontWeight, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, fontStyle: s.italic ? "italic" : "normal", opacity: text ? 1 : 0.4 }}>
      <span style={span}>{text}</span>
    </div>
  );
}

function Text({ el }) {
  const s = el.style;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: justify(s.align), textAlign: s.align, color: s.color, fontFamily: s.fontFamily || FONTS.body, fontWeight: s.fontWeight, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, fontStyle: s.italic ? "italic" : "normal", whiteSpace: "pre-line" }}>
      <span>{el.props.text}</span>
    </div>
  );
}

function Kicker({ el }) {
  const s = el.style;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: justify(s.align), textAlign: s.align, color: s.color, fontFamily: FONTS.mono, fontSize: s.fontSize, letterSpacing: s.letterSpacing, textTransform: "uppercase" }}>
      {el.props.text}
    </div>
  );
}

function Quote({ el }) {
  const s = el.style;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: s.align }}>
      <div style={{ fontSize: s.fontSize * 1.6, lineHeight: 0, color: s.accent, fontFamily: FONTS.head, height: s.fontSize * 0.6 }}>“</div>
      <div style={{ color: s.color, fontFamily: FONTS.head, fontWeight: 300, fontSize: s.fontSize, lineHeight: 1.25 }}>{el.props.text}</div>
      {el.props.author ? <div style={{ marginTop: 14, color: s.accent, fontFamily: FONTS.mono, fontSize: Math.max(12, s.fontSize * 0.34), letterSpacing: 1 }}>{el.props.author}</div> : null}
    </div>
  );
}

function Counter({ el, mode, active }) {
  const run = mode === "present" && active;
  const v = useCountUp(el.props.value, run);
  const d = el.props.decimals || 0;
  const shown = d > 0 ? v.toFixed(d) : Math.round(v).toLocaleString();
  const s = el.style;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ fontFamily: FONTS.head, fontWeight: 300, fontSize: s.fontSize, color: s.color, letterSpacing: -1, lineHeight: 1 }}>
        {el.props.prefix}{shown}{el.props.suffix}
      </div>
      {el.props.label ? <div style={{ marginTop: 10, fontSize: Math.max(11, s.fontSize * 0.2), color: P.muted, letterSpacing: 1, lineHeight: 1.35 }}>{el.props.label}</div> : null}
    </div>
  );
}

function Button({ el, mode }) {
  const s = el.style; const primary = el.props.variant !== "ghost";
  const style = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: "100%",
    borderRadius: 999, textDecoration: "none", fontWeight: s.fontWeight || 500, fontSize: s.fontSize, fontFamily: FONTS.body,
    boxSizing: "border-box", cursor: mode === "present" ? "pointer" : "default",
    color: s.color || (primary ? P.white : P.light),
    background: primary ? `linear-gradient(135deg, ${s.bg || P.purple}, ${P.magenta})` : "transparent",
    border: primary ? 0 : `1px solid ${(s.color || P.light)}66`,
    boxShadow: primary ? `0 10px 26px ${(s.bg || P.purple)}55` : "none",
  };
  if (mode === "present") return <a href={el.props.href || "#"} style={style}>{el.props.label}</a>;
  return <div style={style}>{el.props.label}</div>;
}

function List({ el }) {
  const s = el.style;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: s.gap, color: s.color, fontFamily: FONTS.body, fontSize: s.fontSize, lineHeight: 1.45 }}>
      {(el.props.items || []).map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ color: s.accent, fontSize: s.fontSize * 0.6, marginTop: s.fontSize * 0.28, flexShrink: 0 }}>{s.marker || "◆"}</span>
          <span>{it}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ el }) {
  const c = el.style.accent; const p = el.props;
  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", background: `linear-gradient(180deg, ${c}1c, ${c}05)`, border: `1px solid ${c}45`, borderRadius: 18, padding: "22px 20px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 150, height: 150, borderRadius: "50%", background: `radial-gradient(circle, ${c}40, transparent 70%)`, filter: "blur(6px)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 28 }}>{p.icon}</span>
        {p.tag ? <span style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 2, color: c, textTransform: "uppercase" }}>{p.tag}</span> : null}
      </div>
      <div style={{ fontFamily: FONTS.head, fontWeight: 300, fontSize: 30, color: el.style.color || P.white, marginBottom: 10, letterSpacing: -0.5 }}>{p.title}</div>
      {p.body ? <div style={{ fontSize: 13.5, color: P.dim, lineHeight: 1.6, marginBottom: 12 }}>{p.body}</div> : null}
      <div style={{ marginTop: "auto" }}>
        {(p.bullets || []).map((b, i) => (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "rgba(244,224,255,0.8)", lineHeight: 1.5, marginBottom: 5 }}>
            <span style={{ color: c, fontSize: 8, marginTop: 6, flexShrink: 0 }}>◆</span><span>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Icon({ el }) {
  return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: el.style.fontSize, lineHeight: 1 }}>{el.props.glyph}</div>;
}

function Image({ el }) {
  const s = el.style;
  const border = s.borderWidth ? `${s.borderWidth}px solid ${s.borderColor || P.faint}` : "none";
  if (!el.props.src) {
    return <div style={{ width: "100%", height: "100%", borderRadius: s.borderRadius, border: `1px dashed ${P.faint}`, display: "flex", alignItems: "center", justifyContent: "center", color: P.muted, fontSize: 13, background: "rgba(255,255,255,0.03)" }}>Image URL in Inspector</div>;
  }
  return <img src={el.props.src} alt={el.props.alt || ""} style={{ width: "100%", height: "100%", objectFit: el.props.fit || "cover", borderRadius: s.borderRadius, border, display: "block" }} />;
}

function Shape({ el }) {
  const s = el.style; const shape = el.props.shape || "rect";
  const fill = s.gradient ? `linear-gradient(135deg, ${s.gradient.join(", ")})` : (s.bg || P.purple);
  const common = { width: "100%", height: "100%", background: fill, boxShadow: s.glow ? `0 0 40px ${(s.gradient ? s.gradient[0] : s.bg) || P.purple}66` : "none", border: s.borderWidth ? `${s.borderWidth}px solid ${s.borderColor}` : "none", boxSizing: "border-box" };
  if (shape === "ellipse") return <div style={{ ...common, borderRadius: "50%" }} />;
  if (shape === "pill") return <div style={{ ...common, borderRadius: 999 }} />;
  if (shape === "line") return <div style={{ width: "100%", height: Math.max(2, s.borderWidth || 3), background: fill, marginTop: "calc(50% - 1px)" }} />;
  if (shape === "triangle") {
    const col = s.gradient ? s.gradient[0] : (s.bg || P.purple);
    return <div style={{ width: 0, height: 0, margin: "0 auto", borderLeft: `${el.w / 2}px solid transparent`, borderRight: `${el.w / 2}px solid transparent`, borderBottom: `${el.h}px solid ${col}` }} />;
  }
  return <div style={{ ...common, borderRadius: s.borderRadius ?? 12 }} />;
}

function Ring({ el, mode, active }) {
  const run = mode === "present" && active;
  const v = useCountUp(el.props.value, run);
  const s = el.style; const R = 70; const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, v)) / 100;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 180 180" style={{ width: "78%", height: "78%" }}>
        <circle cx="90" cy="90" r={R} fill="none" stroke={s.track || P.faint} strokeWidth="12" />
        <circle cx="90" cy="90" r={R} fill="none" stroke={s.accent} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 90 90)" style={{ filter: `drop-shadow(0 0 8px ${s.accent}aa)` }} />
        <text x="90" y="96" textAnchor="middle" fontFamily={FONTS.head} fontWeight="300" fontSize={s.fontSize} fill={P.white}>{Math.round(v)}{el.props.suffix}</text>
      </svg>
      {el.props.label ? <div style={{ marginTop: 4, fontSize: 12, color: P.muted, letterSpacing: 1 }}>{el.props.label}</div> : null}
    </div>
  );
}

function Chart({ el }) {
  // All chart kinds share one SVG renderer (chart-svg.js) — the same drawing
  // used by the HTML export and the generated converter pages.
  const { legend, svg } = chartMarkup(el);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "4px 16px", marginBottom: 6, fontFamily: FONTS.mono, fontSize: 11 }}>
        {legend.map((it, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: P.dim }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color }} />{it.label}
          </span>
        ))}
      </div>
      <div style={{ width: "100%", flex: 1, minHeight: 0, display: "flex" }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

function Orbit({ el, mode, active }) {
  const run = mode !== "present" || active;
  const s = el.style; const sats = ["🛰️", "🛰️", "📡"];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{ position: "absolute", inset: "32%", borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${s.planet}, ${P.deep} 72%)`, boxShadow: `0 0 60px ${s.planet}55, inset -18px -18px 50px ${P.deep}` }} />
      {Array.from({ length: el.props.rings || 3 }).map((_, i) => {
        const inset = 6 + i * 13; const dur = 22 - i * 5; const c = [s.accent, P.magenta, P.gold][i % 3];
        return (
          <div key={i} style={{ position: "absolute", inset: `${inset}%`, borderRadius: "50%", border: `1px dashed ${c}55`, animation: run ? `${i % 2 ? "stOrbitR" : "stOrbit"} ${dur}s linear infinite` : "none" }}>
            <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", fontSize: 18 }}>{sats[i % sats.length]}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)", fontFamily: FONTS.mono, fontSize: 11, color: s.accent, letterSpacing: 2 }}>{el.props.label}</div>
    </div>
  );
}

function Radar({ el, mode, active }) {
  const run = mode !== "present" || active;
  const s = el.style;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 16, overflow: "hidden", background: `radial-gradient(circle at 30% 50%, ${s.accent}1f, transparent 70%)`, border: `1px solid ${s.accent}33` }}>
      <div style={{ position: "absolute", left: 30, top: "50%", transform: "translateY(-50%)", textAlign: "center", zIndex: 3 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: `radial-gradient(circle, ${s.accent}, ${P.purple}aa)`, boxShadow: `0 0 26px ${s.accent}88`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📡</div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: P.light, marginTop: 6, letterSpacing: 1 }}>{el.props.label}</div>
      </div>
      {run && [0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: 52, top: "50%", width: "118%", aspectRatio: "1/1", borderRadius: "50%", border: `1px solid ${s.accent}55`, transformOrigin: "center", animation: `stRadar 3.6s ease-out ${i * 1.2}s infinite` }} />
      ))}
      {(el.props.targets || []).map((t, i) => (
        <div key={i} style={{ position: "absolute", left: `${t.x}%`, top: `${t.y}%` }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: t.color, boxShadow: `0 0 16px ${t.color}cc`, animation: run ? `stBlink 2.4s ease-in-out ${i * 0.4}s infinite` : "none" }} />
          <div style={{ fontFamily: FONTS.mono, fontSize: 9, color: t.color, marginTop: 4, letterSpacing: 1, whiteSpace: "nowrap" }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

function Loop({ el, mode, active }) {
  const run = mode !== "present" || active;
  const stages = el.props.stages || []; const cx = 410, cy = 230, R = 165;
  const pts = stages.map((s, i) => {
    const a = (i / stages.length) * 2 * Math.PI - Math.PI / 2;
    return { ...s, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  });
  return (
    <svg viewBox="0 0 820 460" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", opacity: run ? 1 : 0, transition: "opacity 0.8s" }}>
      <defs>
        <radialGradient id={`stbrain_${el.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={P.purple} stopOpacity="0.55" /><stop offset="60%" stopColor={P.magenta} stopOpacity="0.16" /><stop offset="100%" stopColor={P.purple} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r="118" fill={`url(#stbrain_${el.id})`} />
      <circle cx={cx} cy={cy} r="60" fill="none" stroke={P.light} strokeOpacity="0.18" strokeDasharray="3 5" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily={FONTS.head} fontWeight="300" fontSize="22" fill={P.white}>{el.props.title}</text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontFamily={FONTS.mono} fontSize="10" letterSpacing="2" fill={P.light} opacity="0.6">{el.props.sub}</text>
      {pts.map((s, i) => {
        const next = pts[(i + 1) % pts.length];
        const d = `M ${s.x} ${s.y} Q ${(s.x + next.x) / 2} ${(s.y + next.y) / 2 + (i % 2 ? -36 : 36)} ${next.x} ${next.y}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={s.color} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 6">{run && <animate attributeName="stroke-dashoffset" from="0" to="-200" dur="3s" repeatCount="indefinite" />}</path>
            {run && <circle r="4" fill={s.color}><animateMotion dur={`${3 + i * 0.2}s`} repeatCount="indefinite" path={d} /></circle>}
          </g>
        );
      })}
      {pts.map((s, i) => (
        <g key={`n${i}`} transform={`translate(${s.x},${s.y})`}>
          <circle r="33" fill={`${s.color}22`} stroke={s.color} strokeWidth="1.5" />
          <text textAnchor="middle" y="4" fontFamily={FONTS.mono} fontSize="11" fontWeight="700" letterSpacing="1.2" fill={s.color}>{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

const RENDERERS = { heading: Heading, text: Text, kicker: Kicker, quote: Quote, counter: Counter, button: Button, list: List, card: Card, icon: Icon, image: Image, shape: Shape, ring: Ring, chart: Chart, orbit: Orbit, radar: Radar, loop: Loop };

export default function Block({ element, mode = "edit", active = true }) {
  const R = RENDERERS[element.type];
  return <Frame el={element} active={active} mode={mode}>{R ? <R el={element} mode={mode} active={active} /> : null}</Frame>;
}
