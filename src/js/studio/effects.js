// ─────────────────────────────────────────────────────────────────────────
// Animation engine for the studio: a shared keyframe sheet, easing curves and
// two pure helpers — entranceTransition() (how an element flies in when its
// slide becomes active) and idleAnimation() (the continuous loop while it sits
// on screen). Both backgrounds and blocks read from this so editor, present
// mode and thumbnails stay perfectly in sync.
// ─────────────────────────────────────────────────────────────────────────

export const EASES = {
  out: "cubic-bezier(0.16,1,0.3,1)",
  inout: "cubic-bezier(0.65,0,0.35,1)",
  back: "cubic-bezier(0.34,1.56,0.64,1)",
  linear: "linear",
};

// Injected once at the root of the editor / player.
export const KEYFRAMES = `
@keyframes stFloat   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@keyframes stSway    { 0%,100% { transform: rotate(-2.2deg); } 50% { transform: rotate(2.2deg); } }
@keyframes stPulse   { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes stBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes stSpin    { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes stGlow    { 0%,100% { filter: drop-shadow(0 0 6px currentColor); } 50% { filter: drop-shadow(0 0 22px currentColor); } }
@keyframes stShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes stRadar   { 0% { transform: translate(-50%,-50%) scale(0.05); opacity: 0.75; } 100% { transform: translate(-50%,-50%) scale(1); opacity: 0; } }
@keyframes stBlink   { 0%,100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.25); } }
@keyframes stDash    { to { stroke-dashoffset: -200; } }
@keyframes stOrbit   { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes stOrbitR  { from { transform: rotate(360deg); } to { transform: rotate(0); } }
@keyframes stAurora  { 0% { transform: translate3d(-8%,-6%,0) rotate(0deg); } 50% { transform: translate3d(8%,6%,0) rotate(8deg); } 100% { transform: translate3d(-8%,-6%,0) rotate(0deg); } }
@keyframes stGridMove{ from { background-position: 0 0; } to { background-position: 0 60px; } }
@keyframes stDrift   { 0%,100% { transform: translate3d(-4%,4%,0) scale(1); } 50% { transform: translate3d(5%,-7%,0) scale(1.1); } }
@keyframes stChartIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes stSpinY   { from { transform: perspective(1200px) rotateY(0); } to { transform: perspective(1200px) rotateY(360deg); } }
@keyframes stHint    { 0%,100% { opacity: 0.4; transform: translateY(0); } 50% { opacity: 1; transform: translateY(5px); } }
`;

// How an element looks *before* it has entered (active=false) vs settled (true).
export function entranceTransition(anim, active) {
  const dur = anim?.duration ?? 0.6;
  const delay = active ? (anim?.delay ?? 0) : 0;
  const ease = EASES[anim?.ease] || EASES.out;
  const kind = anim?.in || "fade-up";

  const hiddenMap = {
    none: { opacity: 1, transform: "none", filter: "none" },
    fade: { opacity: 0, transform: "none", filter: "none" },
    "fade-up": { opacity: 0, transform: "translateY(42px)", filter: "none" },
    "fade-down": { opacity: 0, transform: "translateY(-42px)", filter: "none" },
    "fade-left": { opacity: 0, transform: "translateX(42px)", filter: "none" },
    "fade-right": { opacity: 0, transform: "translateX(-42px)", filter: "none" },
    "zoom-in": { opacity: 0, transform: "scale(0.82)", filter: "none" },
    "zoom-out": { opacity: 0, transform: "scale(1.16)", filter: "none" },
    "blur-in": { opacity: 0, transform: "none", filter: "blur(16px)" },
    "flip-up": { opacity: 0, transform: "perspective(900px) rotateX(38deg)", filter: "none" },
    rise: { opacity: 0, transform: "translateY(64px) scale(0.96)", filter: "none" },
    pop: { opacity: 0, transform: "scale(0.5)", filter: "none" },
  };
  const hidden = hiddenMap[kind] || hiddenMap["fade-up"];
  const shown = { opacity: 1, transform: "none", filter: "none" };
  const s = active ? shown : hidden;
  return {
    opacity: s.opacity,
    transform: s.transform,
    filter: s.filter,
    transition: `opacity ${dur}s ${ease} ${delay}s, transform ${dur}s ${ease} ${delay}s, filter ${dur}s ${ease} ${delay}s`,
  };
}

// Continuous idle loop. `shimmer` is handled by the heading block (it needs a
// moving gradient), so here it is a no-op.
export function idleAnimation(idle) {
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
