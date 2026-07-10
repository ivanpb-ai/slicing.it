// ─────────────────────────────────────────────────────────────────────────
// Slide backgrounds. Each slide picks one of these; they render behind the
// element layer and fill the fixed 1280×720 stage.
//   live  → full animation (used by the active editor slide + present mode)
//   thumb → a cheap static gradient (used by navigator thumbnails)
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { STAGE_W, STAGE_H, P } from "./model";

function hexToRgb(hex) {
  if (typeof hex !== "string") return [120, 30, 170];
  const m = hex.replace("#", "");
  if (m.length === 6) return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
  const rg = hex.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (rg) return [+rg[1], +rg[2], +rg[3]];
  return [120, 30, 170];
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ── Neural nebula — drifting constellation of linked nodes. ────────────────
function NebulaCanvas({ colors }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = STAGE_W * dpr; cvs.height = STAGE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const base = hexToRgb(colors?.[0] || P.purple);
    const deep = hexToRgb(colors?.[1] || P.deep);
    const pal = [base, hexToRgb(P.cyan), hexToRgb(P.magenta), hexToRgb(P.light)];
    const N = 64;
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random() * STAGE_W, y: Math.random() * STAGE_H,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      r: 0.8 + Math.random() * 1.7, hue: Math.random(),
    }));
    let t = 0, raf = 0;
    const draw = () => {
      t += 0.007;
      const g = ctx.createRadialGradient(STAGE_W * 0.7, STAGE_H * 0.3, 40, STAGE_W * 0.5, STAGE_H * 0.5, STAGE_W);
      g.addColorStop(0, rgba(base, 0.22));
      g.addColorStop(0.45, rgba(deep, 0.9));
      g.addColorStop(1, rgba(deep, 1));
      ctx.fillStyle = g; ctx.fillRect(0, 0, STAGE_W, STAGE_H);

      ctx.beginPath();
      const ax = STAGE_W * 0.7 + Math.sin(t * 0.3) * 40;
      const ay = STAGE_H * 0.3 + Math.cos(t * 0.2) * 28;
      ctx.arc(ax, ay, Math.min(STAGE_W, STAGE_H) * 0.5, -0.8, 1.6);
      ctx.strokeStyle = rgba(base, 0.10); ctx.lineWidth = 60; ctx.stroke();

      for (const n of nodes) {
        n.x += n.vx + Math.sin(t + n.hue * 12) * 0.05;
        n.y += n.vy + Math.cos(t * 0.8 + n.hue * 9) * 0.05;
        if (n.x < -30) n.x = STAGE_W + 20; if (n.x > STAGE_W + 30) n.x = -20;
        if (n.y < -30) n.y = STAGE_H + 20; if (n.y > STAGE_H + 30) n.y = -20;
      }
      const maxD2 = 170 * 170;
      ctx.lineWidth = 0.6;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < maxD2) {
            const k = 1 - d2 / maxD2;
            const c = pal[Math.floor((a.hue + b.hue) * 0.5 * pal.length) % pal.length];
            ctx.strokeStyle = rgba(c, k * 0.16);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 2 + n.hue * 6.28);
        const c = pal[Math.floor(n.hue * pal.length) % pal.length];
        ctx.fillStyle = rgba(c, 0.55 * pulse);
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (1 + pulse * 0.4), 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [colors]);
  return <canvas ref={ref} style={{ width: STAGE_W, height: STAGE_H, position: "absolute", inset: 0 }} />;
}

// ── Starfield — parallax stars + the odd shooting star. ────────────────────
function StarfieldCanvas({ colors }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = STAGE_W * dpr; cvs.height = STAGE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tint = hexToRgb(colors?.[0] || P.cyan);
    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * STAGE_W, y: Math.random() * STAGE_H,
      z: 0.2 + Math.random() * 1, r: Math.random() * 1.4 + 0.3, tw: Math.random() * 6.28,
    }));
    let shoot = null, t = 0, raf = 0;
    const draw = () => {
      t += 0.016;
      ctx.fillStyle = "#0a0518"; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      const g = ctx.createRadialGradient(STAGE_W * 0.5, STAGE_H * 0.9, 60, STAGE_W * 0.5, STAGE_H * 0.9, STAGE_W * 0.8);
      g.addColorStop(0, rgba(tint, 0.12)); g.addColorStop(1, "rgba(10,5,24,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      for (const s of stars) {
        s.x -= s.z * 0.25; if (s.x < 0) s.x = STAGE_W;
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t + s.tw));
        ctx.fillStyle = `rgba(244,236,255,${a * s.z})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!shoot && Math.random() < 0.012) shoot = { x: Math.random() * STAGE_W, y: Math.random() * STAGE_H * 0.5, life: 1 };
      if (shoot) {
        shoot.x += 9; shoot.y += 4; shoot.life -= 0.02;
        ctx.strokeStyle = rgba(tint, Math.max(0, shoot.life)); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - 60, shoot.y - 26); ctx.stroke();
        if (shoot.life <= 0) shoot = null;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [colors]);
  return <canvas ref={ref} style={{ width: STAGE_W, height: STAGE_H, position: "absolute", inset: 0 }} />;
}

// ── Signal waves — layered flowing sine ribbons. ────────────────────────────
function WavesCanvas({ colors }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = STAGE_W * dpr; cvs.height = STAGE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = [hexToRgb(colors?.[0] || P.cyan), hexToRgb(colors?.[1] || P.purple), hexToRgb(colors?.[2] || P.magenta)];
    const deep = hexToRgb(P.deep);
    let t = 0, raf = 0;
    const draw = () => {
      t += 0.008;
      const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
      g.addColorStop(0, "#12031f"); g.addColorStop(1, rgba(deep, 1));
      ctx.fillStyle = g; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      for (let k = 0; k < 3; k++) {
        const c = cols[k], base = STAGE_H * (0.3 + 0.22 * k), amp = 44 + 16 * k;
        const dir = k % 2 ? -1 : 1, freq = 0.0062 - k * 0.0012;
        const wave = (x) => base + Math.sin(x * freq + t * (1.4 - 0.3 * k) * dir + k * 2.1) * amp + Math.sin(x * 0.0021 + t * 0.7) * 16;
        for (const [w, a] of [[7, 0.10], [1.8, 0.75]]) {
          ctx.beginPath();
          for (let x = -10; x <= STAGE_W + 10; x += 8) { const y = wave(x); x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
          ctx.strokeStyle = rgba(c, a); ctx.lineWidth = w; ctx.stroke();
        }
        // sparks riding the wave
        for (let s = 0; s < 4; s++) {
          const x = ((t * (60 + 22 * k) * dir + s * STAGE_W / 4) % (STAGE_W + 40) + STAGE_W + 40) % (STAGE_W + 40) - 20;
          ctx.fillStyle = rgba(c, 0.9);
          ctx.beginPath(); ctx.arc(x, wave(x), 2.4, 0, Math.PI * 2); ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [colors]);
  return <canvas ref={ref} style={{ width: STAGE_W, height: STAGE_H, position: "absolute", inset: 0 }} />;
}

// ── Data rain — falling luminous streams. ───────────────────────────────────
function RainCanvas({ colors }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = STAGE_W * dpr; cvs.height = STAGE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tint = hexToRgb(colors?.[0] || P.cyan);
    const streams = Array.from({ length: Math.floor(STAGE_W / 26) }, (_, i) => ({
      x: i * 26 + 10, y: Math.random() * STAGE_H * 1.6 - STAGE_H * 0.6,
      v: 1.6 + Math.random() * 3.4, len: 70 + Math.random() * 150, w: Math.random() < 0.25 ? 2 : 1.2,
    }));
    let raf = 0;
    const draw = () => {
      const g = ctx.createLinearGradient(0, 0, 0, STAGE_H);
      g.addColorStop(0, "#0a0518"); g.addColorStop(1, "#1c0530");
      ctx.fillStyle = g; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      for (const s of streams) {
        s.y += s.v;
        if (s.y - s.len > STAGE_H) { s.y = -20 - Math.random() * 200; s.v = 1.6 + Math.random() * 3.4; s.len = 70 + Math.random() * 150; }
        const lg = ctx.createLinearGradient(0, s.y - s.len, 0, s.y);
        lg.addColorStop(0, rgba(tint, 0)); lg.addColorStop(1, rgba(tint, 0.45));
        ctx.strokeStyle = lg; ctx.lineWidth = s.w;
        ctx.beginPath(); ctx.moveTo(s.x, s.y - s.len); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.fillStyle = "rgba(244,240,255,0.85)";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.w, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [colors]);
  return <canvas ref={ref} style={{ width: STAGE_W, height: STAGE_H, position: "absolute", inset: 0 }} />;
}

// Manhattan-routed traces for the circuit background. (Duplicated inside
// export-html.js's PLAYER, which must stay self-contained.)
function makeCircuitPaths() {
  const paths = [];
  for (let i = 0; i < 14; i++) {
    const pts = [[-20, Math.random() * STAGE_H]];
    let [x, y] = pts[0];
    while (x < STAGE_W + 20) {
      x += 90 + Math.random() * 200; pts.push([x, y]);
      if (Math.random() < 0.75 && x < STAGE_W) { y = Math.max(20, Math.min(STAGE_H - 20, y + (Math.random() - 0.5) * 260)); pts.push([x, y]); }
    }
    let len = 0; const seg = [0];
    for (let k = 1; k < pts.length; k++) { len += Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]); seg.push(len); }
    paths.push({ pts, seg, len, speed: 0.05 + Math.random() * 0.12, off: Math.random() });
  }
  return paths;
}
function circuitPointAt(path, frac) {
  const d = frac * path.len;
  let k = 1;
  while (k < path.seg.length - 1 && path.seg[k] < d) k++;
  const t0 = path.seg[k - 1], t1 = path.seg[k], f = t1 > t0 ? (d - t0) / (t1 - t0) : 0;
  const [ax, ay] = path.pts[k - 1], [bx, by] = path.pts[k];
  return [ax + (bx - ax) * f, ay + (by - ay) * f];
}

// ── Circuit — board traces with light pulses travelling along them. ─────────
function CircuitCanvas({ colors }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = STAGE_W * dpr; cvs.height = STAGE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const trace = hexToRgb(colors?.[0] || P.purple);
    const pulse = hexToRgb(colors?.[1] || P.cyan);
    const paths = makeCircuitPaths();
    let t = 0, raf = 0;
    const draw = () => {
      t += 0.016;
      const g = ctx.createLinearGradient(0, 0, STAGE_W, STAGE_H);
      g.addColorStop(0, "#0d0420"); g.addColorStop(1, rgba(hexToRgb(P.deep), 1));
      ctx.fillStyle = g; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      for (const p of paths) {
        ctx.strokeStyle = rgba(trace, 0.20); ctx.lineWidth = 1.1;
        ctx.beginPath();
        p.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.fillStyle = rgba(trace, 0.4);
        for (let k = 1; k < p.pts.length - 1; k++) { ctx.beginPath(); ctx.arc(p.pts[k][0], p.pts[k][1], 1.8, 0, Math.PI * 2); ctx.fill(); }
        const frac = (t * p.speed + p.off) % 1;
        const [px, py] = circuitPointAt(p, frac);
        const [qx, qy] = circuitPointAt(p, Math.max(0, frac - 0.03));
        ctx.strokeStyle = rgba(pulse, 0.5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = rgba(pulse, 0.95);
        ctx.beginPath(); ctx.arc(px, py, 2.8, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [colors]);
  return <canvas ref={ref} style={{ width: STAGE_W, height: STAGE_H, position: "absolute", inset: 0 }} />;
}

// CSS-only backgrounds share this absolute fill.
const fill = { position: "absolute", inset: 0, overflow: "hidden" };

// Bokeh dot layout: [x%, y%, size, colour-index]. (Also duplicated in the
// self-contained export-html player.)
const BOKEH_DOTS = [
  [12, 78, 190, 0], [28, 30, 120, 1], [45, 85, 150, 2], [62, 22, 230, 0], [74, 66, 110, 1],
  [88, 38, 170, 2], [52, 52, 90, 0], [92, 82, 140, 1], [18, 48, 80, 2], [38, 62, 60, 1],
];

function blob(color, x, y, size, anim, dur) {
  return {
    position: "absolute", left: `${x}%`, top: `${y}%`, width: size, height: size,
    borderRadius: "50%", background: `radial-gradient(circle, ${color}, transparent 65%)`,
    filter: "blur(40px)", transform: "translate(-50%,-50%)", animation: anim ? `${anim} ${dur}s ease-in-out infinite` : "none",
  };
}

export function Background({ bg, mode = "live" }) {
  const colors = (bg?.colors && bg.colors.length ? bg.colors : [P.deep]);
  const type = bg?.type || "solid";

  // Cheap static snapshots for thumbnails — never spin up a canvas/RAF per slide.
  if (mode === "thumb") {
    const c0 = colors[0], c1 = colors[1] || P.deep, c2 = colors[2] || c0;
    const map = {
      nebula: `radial-gradient(circle at 70% 30%, ${c0}55, ${P.deep} 70%)`,
      aurora: `linear-gradient(135deg, ${c0}, ${c1}, ${c2 || c0})`,
      starfield: `radial-gradient(circle at 50% 90%, ${c0}33, #0a0518 70%)`,
      grid: `linear-gradient(180deg, ${P.deep}, ${c0}22)`,
      mesh: `radial-gradient(circle at 25% 30%, ${c0}66, transparent 50%), radial-gradient(circle at 80% 70%, ${c1}66, ${P.deep} 70%)`,
      waves: `linear-gradient(180deg, #12031f 20%, ${c0}44 55%, ${P.deep} 90%)`,
      rain: `linear-gradient(180deg, #0a0518, ${c0}26)`,
      circuit: `radial-gradient(circle at 30% 40%, ${c0}2a, #0d0420 75%)`,
      rings: `radial-gradient(circle at 62% 42%, ${c1}55, ${P.deep} 68%)`,
      beams: `conic-gradient(from 320deg at 50% 110%, ${P.deep}, ${c0}55, ${P.deep} 30%, ${c1}44 45%, ${P.deep} 60%)`,
      bokeh: `radial-gradient(circle at 25% 70%, ${c0}55, transparent 42%), radial-gradient(circle at 72% 30%, ${c1}44, ${P.deep} 68%)`,
      gradient: `linear-gradient(135deg, ${c0}, ${c1})`,
      solid: c0,
    };
    return <div style={{ ...fill, background: map[type] || c0 }} />;
  }

  if (type === "nebula") return <NebulaCanvas colors={colors} />;
  if (type === "starfield") return <StarfieldCanvas colors={colors} />;
  if (type === "waves") return <WavesCanvas colors={colors} />;
  if (type === "rain") return <RainCanvas colors={colors} />;
  if (type === "circuit") return <CircuitCanvas colors={colors} />;

  if (type === "rings") {
    const c0 = colors[0] || P.cyan, c1 = colors[1] || P.purple;
    return (
      <div style={{ ...fill, background: `radial-gradient(circle at 62% 42%, ${c1}2e, ${P.deep} 62%)` }}>
        {[420, 640, 880, 1140].map((d, i) => (
          <div key={i} style={{
            position: "absolute", left: "62%", top: "42%", width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2,
            borderRadius: "50%", border: `1px ${i % 2 ? "dashed" : "solid"} ${c0}${i % 2 ? "3a" : "20"}`,
            animation: `${i % 2 ? "stOrbitR" : "stOrbit"} ${36 + i * 16}s linear infinite`,
          }}>
            <div style={{ position: "absolute", top: -4, left: "50%", width: 8, height: 8, marginLeft: -4, borderRadius: "50%", background: c0, boxShadow: `0 0 14px ${c0}` }} />
          </div>
        ))}
        <div style={{ position: "absolute", left: "62%", top: "42%", width: 200, height: 200, margin: -100, borderRadius: "50%", background: `radial-gradient(circle, ${c1}5c, transparent 70%)`, filter: "blur(12px)", animation: "stBreathe 7s ease-in-out infinite" }} />
      </div>
    );
  }
  if (type === "beams") {
    const c0 = colors[0] || P.purple, c1 = colors[1] || P.cyan;
    return (
      <div style={{ ...fill, background: `linear-gradient(160deg, #12031f, ${P.deep})` }}>
        <div style={{
          position: "absolute", left: "50%", top: "112%", width: 2800, height: 2800, marginLeft: -1400, marginTop: -1400, borderRadius: "50%",
          background: `conic-gradient(from 0deg, transparent 0deg, ${c0}33 10deg, transparent 24deg, transparent 70deg, ${c1}26 84deg, transparent 100deg, transparent 160deg, ${c0}2b 174deg, transparent 190deg, transparent 260deg, ${c1}20 274deg, transparent 290deg)`,
          filter: "blur(16px)", animation: "stOrbit 70s linear infinite",
        }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 105%, ${c0}2e, transparent 55%)` }} />
      </div>
    );
  }
  if (type === "bokeh") {
    const cs = [colors[0] || P.purple, colors[1] || P.cyan, colors[2] || P.magenta];
    return (
      <div style={{ ...fill, background: `linear-gradient(180deg, #14032a, ${P.deep})` }}>
        {BOKEH_DOTS.map(([x, y, size, ci], i) => (
          <div key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: "50%",
            background: `radial-gradient(circle, ${cs[ci]}55, transparent 66%)`, filter: "blur(14px)",
            animation: `stDrift ${14 + i * 3}s ease-in-out ${-i * 2.2}s infinite`,
          }} />
        ))}
      </div>
    );
  }

  if (type === "aurora") {
    return (
      <div style={{ ...fill, background: P.deep }}>
        <div style={blob(colors[0], 25, 30, 620, "stAurora", 18)} />
        <div style={blob(colors[1] || P.magenta, 78, 64, 560, "stAurora", 22)} />
        <div style={blob(colors[2] || P.cyan, 60, 20, 480, "stAurora", 26)} />
      </div>
    );
  }
  if (type === "mesh") {
    return (
      <div style={{ ...fill, background: P.deep }}>
        <div style={blob(colors[0], 20, 28, 540, "stBreathe", 9)} />
        <div style={blob(colors[1] || P.magenta, 82, 36, 500, "stBreathe", 11)} />
        <div style={blob(colors[2] || P.cyan, 50, 84, 560, "stBreathe", 13)} />
      </div>
    );
  }
  if (type === "grid") {
    const line = `${colors[0]}33`;
    return (
      <div style={{ ...fill, background: `linear-gradient(180deg, ${P.deep}, #15052b)` }}>
        <div style={{
          position: "absolute", inset: "-20%", backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
          backgroundSize: "60px 60px", transform: "perspective(420px) rotateX(58deg)", transformOrigin: "50% 100%",
          animation: "stGridMove 3s linear infinite", maskImage: "linear-gradient(to top, #000 10%, transparent 75%)", WebkitMaskImage: "linear-gradient(to top, #000 10%, transparent 75%)",
        }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 75%, ${colors[0]}22, transparent 60%)` }} />
      </div>
    );
  }
  if (type === "gradient") {
    return <div style={{ ...fill, background: `linear-gradient(135deg, ${colors[0]}, ${colors[1] || P.deep})` }} />;
  }
  return <div style={{ ...fill, background: colors[0] || P.deep }} />;
}
