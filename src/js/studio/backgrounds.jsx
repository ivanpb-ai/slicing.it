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

// CSS-only backgrounds share this absolute fill.
const fill = { position: "absolute", inset: 0, overflow: "hidden" };

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
      gradient: `linear-gradient(135deg, ${c0}, ${c1})`,
      solid: c0,
    };
    return <div style={{ ...fill, background: map[type] || c0 }} />;
  }

  if (type === "nebula") return <NebulaCanvas colors={colors} />;
  if (type === "starfield") return <StarfieldCanvas colors={colors} />;

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
