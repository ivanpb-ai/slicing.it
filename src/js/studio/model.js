// ─────────────────────────────────────────────────────────────────────────
// Presentation Studio — data model, registries, factories & a starter deck.
//
// A "presentation" is plain JSON, so it serialises cleanly to localStorage and
// to an exported .json file:
//
//   Presentation = { id, title, theme, slides: [ Slide ] }
//   Slide        = { id, name, background: {type, colors[]}, transition, elements: [ Element ] }
//   Element      = { id, type, x, y, w, h, rotation, props{}, style{}, anim{} }
//
// Geometry is in pixels on a fixed 1280×720 virtual stage; the stage is scaled
// to fit its container, so a deck looks identical at any screen size.
// ─────────────────────────────────────────────────────────────────────────
import { P } from "../palette";

export { P };

export const STAGE_W = 1280;
export const STAGE_H = 720;

export const FONTS = {
  head: "'Telia Sans Heading', 'Telia Sans', system-ui, sans-serif",
  body: "'Telia Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace",
};
export const FONT_OPTIONS = [
  { label: "Display", value: FONTS.head },
  { label: "Body", value: FONTS.body },
  { label: "Mono", value: FONTS.mono },
];

export const SWATCHES = Object.entries(P).map(([name, value]) => ({ name, value }));

// Curated colour stops for quick gradients.
export const GRADIENT_PRESETS = [
  [P.white, P.light, P.cyan, P.magenta],
  [P.cyan, P.electric],
  [P.magenta, P.gold],
  [P.purple, P.magenta],
  [P.green, P.cyan],
  [P.gold, P.orange],
];

export const ENTRANCES = [
  "none", "fade", "fade-up", "fade-down", "fade-left", "fade-right",
  "zoom-in", "zoom-out", "blur-in", "flip-up", "rise", "pop",
];
export const IDLES = ["none", "float", "pulse", "glow", "spin", "sway", "breathe", "shimmer"];
export const EASE_OPTIONS = ["out", "inout", "back", "linear"];
export const TRANSITIONS = ["fade", "slide-left", "slide-up", "zoom", "flip", "none"];
export const SLIDE_STATUSES = ["draft", "review", "final"];
export const STATUS_COLORS = { draft: "rgba(244,224,255,0.35)", review: P.gold, final: P.green };
export const BACKGROUNDS = ["nebula", "aurora", "starfield", "grid", "mesh", "gradient", "solid"];
export const ALIGN = ["left", "center", "right"];

// Chart kinds — the standard PowerPoint chart family. `kind` is stored in
// props.kind; every kind renders on the canvas (chart-svg.js) and exports as
// a native PowerPoint chart (export-pptx.js).
export const CHART_KINDS = [
  { kind: "bar", label: "Column", icon: "▟" },
  { kind: "barh", label: "Bar (horizontal)", icon: "▙" },
  { kind: "line", label: "Line", icon: "⋰" },
  { kind: "area", label: "Area", icon: "◪" },
  { kind: "combo", label: "Column + line", icon: "▟⋰" },
  { kind: "pie", label: "Pie", icon: "◕" },
  { kind: "doughnut", label: "Doughnut", icon: "◎" },
  { kind: "radar", label: "Radar (spider)", icon: "✧" },
  { kind: "bubble", label: "Bubble", icon: "🞄" },
  { kind: "waterfall", label: "Waterfall", icon: "▜" },
];

// Sensible seed data per chart kind, applied on insert.
export function chartDefaults(kind) {
  const cats = ["Category 1", "Category 2", "Category 3", "Category 4"];
  const three = (a, b, c) => [
    { label: "Series 1", color: P.cyan, values: a },
    { label: "Series 2", color: P.magenta, values: b },
    { label: "Series 3", color: P.gold, values: c },
  ];
  switch (kind) {
    case "pie":
    case "doughnut":
      return { w: 460, h: 360, props: { kind, xLabels: cats, axisMax: 0, series: [{ label: "Series 1", color: P.purple, values: [35, 25, 22, 18] }] } };
    case "radar":
      return { w: 480, h: 380, props: { kind, xLabels: ["Coverage", "Latency", "Energy", "Security", "Scale"], axisMax: 100,
        series: [{ label: "Series 1", color: P.cyan, values: [80, 65, 55, 70, 90] }, { label: "Series 2", color: P.magenta, values: [55, 85, 70, 45, 60] }] } };
    case "bubble":
      return { props: { kind, xLabels: ["1", "2", "3", "4"], axisMax: 6, series: three([4.3, 4.5, 3.4, 4.4], [2.4, 2.5, 1.8, 2.8], [2, 2, 3, 5]) } };
    case "waterfall":
      return { props: { kind, xLabels: ["Point 1", "Point 2", "Point 3"], axisMax: 0, series: [{ label: "Change", color: P.cyan, values: [500, 200, 100] }] } };
    case "combo":
      return { props: { kind, xLabels: cats, axisMax: 6, series: three([4.3, 2.5, 3.5, 4.5], [2.4, 4.4, 1.8, 2.8], [2, 2, 3, 5]) } };
    case "barh":
    case "line":
    case "bar":
      return { props: { kind, xLabels: cats, axisMax: 6, series: three([4.3, 2.5, 3.5, 4.5], [2.4, 4.4, 1.8, 2.8], [2, 2, 3, 5]) } };
    default: // area — the long-standing default seed
      return { props: { kind: "area", xLabels: ["2025", "2027", "2029", "2031", "2033", "2035"], axisMax: 200,
        series: [
          { label: "Slices", color: P.cyan, values: [4, 18, 36, 62, 90, 118] },
          { label: "APIs", color: P.magenta, values: [1, 6, 22, 56, 108, 168] },
          { label: "Sensing", color: P.gold, values: [0, 1, 5, 18, 44, 84] },
        ] } };
  }
}

// Element palette for the toolbar (label + glyph shown to the user).
export const ELEMENT_TYPES = [
  { type: "heading", label: "Heading", icon: "H" },
  { type: "text", label: "Text", icon: "¶" },
  { type: "kicker", label: "Kicker", icon: "⌁" },
  { type: "counter", label: "Counter", icon: "#" },
  { type: "button", label: "Button", icon: "▭" },
  { type: "list", label: "List", icon: "☰" },
  { type: "card", label: "Card", icon: "▢" },
  { type: "icon", label: "Icon", icon: "★" },
  { type: "image", label: "Image", icon: "▤" },
  { type: "shape", label: "Shape", icon: "◍" },
  { type: "quote", label: "Quote", icon: "“" },
  { type: "ring", label: "Progress", icon: "◔" },
  { type: "chart", label: "Chart", icon: "▦" },
  { type: "orbit", label: "Orbit", icon: "✸" },
  { type: "radar", label: "Radar", icon: "◎" },
  { type: "loop", label: "AI Loop", icon: "↻" },
];

export const cloneDeep = (v) => JSON.parse(JSON.stringify(v));

let _seq = 0;
export const uid = (p = "id") => `${p}_${Date.now().toString(36)}${(_seq++).toString(36)}`;

const baseAnim = (over = {}) => ({ in: "fade-up", delay: 0, duration: 0.7, ease: "out", idle: "none", ...over });

// ── Per-type factory. Returns a fully-formed element. ──────────────────────
export function createElement(type, over = {}) {
  const id = uid("el");
  const common = { id, type, x: 440, y: 300, w: 400, h: 120, rotation: 0 };
  let spec;
  switch (type) {
    case "heading":
      spec = {
        x: 140, y: 250, w: 1000, h: 170,
        props: { text: "Add your headline", gradient: null },
        style: { color: P.white, fontFamily: FONTS.head, fontSize: 86, fontWeight: 300, lineHeight: 1.02, letterSpacing: -2, align: "center", italic: false, opacity: 1 },
        anim: baseAnim({ in: "fade-up" }),
      };
      break;
    case "text":
      spec = {
        x: 290, y: 320, w: 700, h: 110,
        props: { text: "Supporting copy goes here — double-click to edit." },
        style: { color: P.dim, fontFamily: FONTS.body, fontSize: 22, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0, align: "center", italic: false, opacity: 1 },
        anim: baseAnim(),
      };
      break;
    case "kicker":
      spec = {
        x: 290, y: 200, w: 700, h: 30,
        props: { text: "SECTION LABEL" },
        style: { color: P.cyan, fontFamily: FONTS.mono, fontSize: 13, fontWeight: 400, letterSpacing: 5, align: "center", opacity: 1 },
        anim: baseAnim({ in: "fade" }),
      };
      break;
    case "counter":
      spec = {
        x: 500, y: 300, w: 280, h: 140,
        props: { value: 100, prefix: "", suffix: "+", decimals: 0, label: "Metric label" },
        style: { color: P.light, fontFamily: FONTS.head, fontSize: 64, align: "center", opacity: 1 },
        anim: baseAnim({ in: "rise" }),
      };
      break;
    case "button":
      spec = {
        x: 540, y: 340, w: 200, h: 56,
        props: { label: "Call to action", href: "#", variant: "primary" },
        style: { color: P.white, bg: P.purple, fontSize: 15, fontWeight: 500, opacity: 1 },
        anim: baseAnim({ in: "pop", ease: "back" }),
      };
      break;
    case "list":
      spec = {
        x: 440, y: 250, w: 460, h: 260,
        props: { items: ["First point worth making", "A second supporting point", "And a third to round it out"] },
        style: { color: "rgba(244,224,255,0.82)", fontFamily: FONTS.body, fontSize: 17, accent: P.cyan, gap: 14, marker: "◆", opacity: 1 },
        anim: baseAnim(),
      };
      break;
    case "card":
      spec = {
        x: 460, y: 200, w: 360, h: 340,
        props: { icon: "✦", tag: "CATEGORY", title: "Card title", body: "A short description of what this card is about.", bullets: ["Highlight one", "Highlight two"] },
        style: { accent: P.cyan, color: P.white, opacity: 1 },
        anim: baseAnim({ in: "rise" }),
      };
      break;
    case "icon":
      spec = {
        x: 580, y: 280, w: 120, h: 120,
        props: { glyph: "✨" },
        style: { fontSize: 90, opacity: 1 },
        anim: baseAnim({ in: "pop", idle: "float", ease: "back" }),
      };
      break;
    case "image":
      spec = {
        x: 440, y: 200, w: 400, h: 280,
        props: { src: "", fit: "cover", alt: "" },
        style: { borderRadius: 16, borderColor: P.faint, borderWidth: 1, opacity: 1 },
        anim: baseAnim({ in: "zoom-in" }),
      };
      break;
    case "shape":
      spec = {
        x: 520, y: 290, w: 240, h: 140,
        props: { shape: "pill" },
        style: { bg: P.purple, gradient: [P.purple, P.magenta], borderRadius: 22, borderColor: null, borderWidth: 0, glow: true, opacity: 0.9 },
        anim: baseAnim({ in: "zoom-in", idle: "breathe" }),
      };
      break;
    case "quote":
      spec = {
        x: 240, y: 250, w: 800, h: 220,
        props: { text: "A bold statement that sets the tone for the whole story.", author: "— Attribution" },
        style: { color: P.white, fontFamily: FONTS.head, fontSize: 40, accent: P.cyan, align: "center", opacity: 1 },
        anim: baseAnim({ in: "blur-in" }),
      };
      break;
    case "ring":
      spec = {
        x: 540, y: 250, w: 200, h: 220,
        props: { value: 72, label: "Coverage", suffix: "%" },
        style: { accent: P.cyan, track: P.faint, fontSize: 44, opacity: 1 },
        anim: baseAnim({ in: "zoom-in" }),
      };
      break;
    case "chart":
      spec = {
        x: 290, y: 200, w: 700, h: 340,
        props: {
          kind: "area",
          xLabels: ["2025", "2027", "2029", "2031", "2033", "2035"],
          axisMax: 200,
          series: [
            { label: "Slices", color: P.cyan, values: [4, 18, 36, 62, 90, 118] },
            { label: "APIs", color: P.magenta, values: [1, 6, 22, 56, 108, 168] },
            { label: "Sensing", color: P.gold, values: [0, 1, 5, 18, 44, 84] },
          ],
        },
        style: { axis: P.muted, grid: P.faint, legend: P.dim, opacity: 1 },
        anim: baseAnim({ in: "fade" }),
      };
      break;
    case "orbit":
      spec = {
        x: 470, y: 170, w: 380, h: 380,
        props: { rings: 3, label: "NTN" },
        style: { planet: P.teal, accent: P.cyan, opacity: 1 },
        anim: baseAnim({ in: "zoom-in" }),
      };
      break;
    case "radar":
      spec = {
        x: 420, y: 180, w: 480, h: 360,
        props: {
          label: "gNB · ISAC",
          targets: [
            { x: 30, y: 28, label: "Drone", color: P.cyan },
            { x: 72, y: 24, label: "Vehicle", color: P.gold },
            { x: 80, y: 62, label: "Person", color: P.green },
            { x: 24, y: 70, label: "Weather", color: P.magenta },
          ],
        },
        style: { accent: P.cyan, opacity: 1 },
        anim: baseAnim({ in: "fade" }),
      };
      break;
    case "loop":
      spec = {
        x: 360, y: 170, w: 560, h: 400,
        props: {
          title: "AI Brain", sub: "NWDAF · TWIN",
          stages: [
            { label: "OBSERVE", color: P.cyan },
            { label: "PREDICT", color: P.magenta },
            { label: "DECIDE", color: P.gold },
            { label: "APPLY", color: P.green },
            { label: "VERIFY", color: P.orange },
            { label: "LEARN", color: P.light },
          ],
        },
        style: { opacity: 1 },
        anim: baseAnim({ in: "fade" }),
      };
      break;
    default:
      spec = { props: { text: "" }, style: { opacity: 1 }, anim: baseAnim() };
  }
  return { ...common, ...spec, ...over, style: { ...spec.style, ...(over.style || {}) }, props: { ...spec.props, ...(over.props || {}) } };
}

export function createSlide(over = {}) {
  return {
    id: uid("slide"),
    name: "Untitled slide",
    background: { type: "nebula", colors: [P.purple, P.deep], variant: 0 },
    transition: "fade",
    status: "draft",
    elements: [],
    ...over,
  };
}

export function createPresentation(over = {}) {
  return {
    id: uid("deck"),
    title: "Untitled presentation",
    theme: { font: FONTS.body, bg: P.deep },
    slides: [createSlide({ name: "Slide 1" })],
    ...over,
  };
}

// ── A rich starter deck that shows off the studio out of the box. ──────────
export function starterDeck() {
  const el = (type, over) => createElement(type, over);
  return {
    id: uid("deck"),
    title: "Welcome to Presentation Studio",
    theme: { font: FONTS.body, bg: P.deep },
    slides: [
      // 1 · Hero
      createSlide({
        name: "Hero",
        background: { type: "nebula", colors: [P.purple, P.deep], variant: 0 },
        transition: "fade",
        elements: [
          el("kicker", { x: 240, y: 150, w: 800, props: { text: "PRESENTATION STUDIO · BUILD ANYTHING" }, style: { color: P.cyan, letterSpacing: 6 }, anim: baseAnim({ in: "fade" }) }),
          el("heading", { x: 120, y: 222, w: 1040, h: 170, props: { text: "The Next Decade", gradient: [P.white, P.light, P.cyan, P.magenta] }, style: { fontSize: 120, letterSpacing: -3 }, anim: baseAnim({ in: "fade-up", delay: 0.1, idle: "shimmer" }) }),
          el("text", { x: 290, y: 408, w: 700, h: 70, props: { text: "Compose interactive, animated decks — drag, style, animate, present." }, style: { fontSize: 24, color: P.dim }, anim: baseAnim({ delay: 0.25 }) }),
          el("counter", { x: 210, y: 506, w: 240, props: { value: 16, suffix: "+", label: "Animated block types" }, style: { fontSize: 58 }, anim: baseAnim({ in: "rise", delay: 0.4 }) }),
          el("counter", { x: 520, y: 506, w: 240, props: { value: 7, suffix: "", label: "Live backgrounds" }, style: { fontSize: 58, color: P.cyan }, anim: baseAnim({ in: "rise", delay: 0.5 }) }),
          el("counter", { x: 830, y: 506, w: 240, props: { value: 12, suffix: "", label: "Entrance effects" }, style: { fontSize: 58, color: P.magenta }, anim: baseAnim({ in: "rise", delay: 0.6 }) }),
        ],
      }),
      // 2 · Three Waves
      createSlide({
        name: "Three Waves",
        background: { type: "mesh", colors: [P.purple, P.magenta, P.cyan], variant: 0 },
        transition: "slide-left",
        elements: [
          el("kicker", { x: 240, y: 96, w: 800, props: { text: "HOW THE DECADE UNFOLDS" } }),
          el("heading", { x: 240, y: 134, w: 800, h: 90, props: { text: "Three Waves" }, style: { fontSize: 64 }, anim: baseAnim({ in: "fade-up", delay: 0.08 }) }),
          el("card", { x: 90, y: 252, w: 348, h: 360, props: { icon: "⚙️", tag: "WAVE 1 · 2025–27", title: "Programmable", body: "Network as software — slices, APIs, edge breakout, on-demand QoS.", bullets: ["Slicing at scale", "CAMARA APIs", "L4S end-to-end"] }, style: { accent: P.cyan }, anim: baseAnim({ in: "rise", delay: 0.2 }) }),
          el("card", { x: 466, y: 252, w: 348, h: 360, props: { icon: "🧠", tag: "WAVE 2 · 2027–30", title: "Cognitive", body: "Network as intelligence — AI inside RAN, core and the orchestration loop.", bullets: ["Closed-loop assurance", "Intent-based slicing", "Digital twin ops"] }, style: { accent: P.magenta }, anim: baseAnim({ in: "rise", delay: 0.32 }) }),
          el("card", { x: 842, y: 252, w: 348, h: 360, props: { icon: "🌌", tag: "WAVE 3 · 2030–35+", title: "Ambient", body: "Network as nervous system — the air becomes a sensor, the sky a cell.", bullets: ["ISAC as a service", "Direct-to-device sat", "Ambient IoT"] }, style: { accent: P.gold }, anim: baseAnim({ in: "rise", delay: 0.44 }) }),
        ],
      }),
      // 3 · Cognitive loop
      createSlide({
        name: "AI-Native",
        background: { type: "aurora", colors: [P.magenta, P.purple, P.cyan], variant: 0 },
        transition: "slide-up",
        elements: [
          el("kicker", { x: 90, y: 96, w: 700, props: { text: "WAVE 2 · 2027–2030" }, style: { color: P.magenta, align: "left" } }),
          el("heading", { x: 88, y: 132, w: 1000, h: 100, props: { text: "The network becomes cognitive", gradient: [P.light, P.magenta] }, style: { fontSize: 56, align: "left", letterSpacing: -1 }, anim: baseAnim({ in: "fade-right", delay: 0.08 }) }),
          el("loop", { x: 70, y: 232, w: 600, h: 420, anim: baseAnim({ in: "fade", delay: 0.2 }) }),
          el("list", { x: 740, y: 268, w: 460, h: 340, props: { items: ["Proactive SLA — predict degradation before users feel it", "Intent-based slicing — describe outcomes, not config", "Energy as a metric — 40% less power per Gbit", "Digital-twin ops — test against a live model first"] }, style: { accent: P.magenta, fontSize: 18, gap: 18 }, anim: baseAnim({ in: "fade-left", delay: 0.3 }) }),
        ],
      }),
      // 4 · Vision / CTA
      createSlide({
        name: "Vision",
        background: { type: "starfield", colors: [P.cyan, P.light], variant: 0 },
        transition: "zoom",
        elements: [
          el("kicker", { x: 240, y: 188, w: 800, props: { text: "2036" } }),
          el("heading", { x: 120, y: 232, w: 1040, h: 200, props: { text: "It will be everywhere you are.", gradient: [P.cyan, P.light, P.magenta, P.gold] }, style: { fontSize: 78, letterSpacing: -2 }, anim: baseAnim({ in: "blur-in", delay: 0.1, idle: "shimmer" }) }),
          el("text", { x: 320, y: 450, w: 640, h: 70, props: { text: "Sensing the world. Healing itself. Carrying intent, not just packets." }, style: { fontSize: 19 }, anim: baseAnim({ delay: 0.3 }) }),
          el("button", { x: 430, y: 548, w: 220, h: 56, props: { label: "Back to start →", href: "index.html", variant: "primary" }, anim: baseAnim({ in: "pop", delay: 0.45, ease: "back" }) }),
          el("button", { x: 668, y: 548, w: 180, h: 56, props: { label: "Talk to us", href: "#", variant: "ghost" }, style: { color: P.light, bg: null }, anim: baseAnim({ in: "pop", delay: 0.55, ease: "back" }) }),
        ],
      }),
    ],
  };
}

// ── Persistence + import/export ────────────────────────────────────────────
const STORE_KEY = "northstar.studio.deck.v1";

export function loadDeck() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const deck = JSON.parse(raw);
    return validateDeck(deck);
  } catch {
    return null;
  }
}

export function saveDeck(deck) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(deck));
    return true;
  } catch {
    return false;
  }
}

export function clearDeck() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}

// Defensive normaliser so a malformed import can't crash the editor.
export function validateDeck(deck) {
  if (!deck || typeof deck !== "object" || !Array.isArray(deck.slides) || !deck.slides.length) return null;
  const slides = deck.slides.map((s) => ({
    id: s.id || uid("slide"),
    name: typeof s.name === "string" ? s.name : "Slide",
    background: s.background && typeof s.background === "object"
      ? { type: BACKGROUNDS.includes(s.background.type) ? s.background.type : "solid", colors: Array.isArray(s.background.colors) ? s.background.colors : [P.deep], variant: s.background.variant || 0 }
      : { type: "solid", colors: [P.deep], variant: 0 },
    transition: TRANSITIONS.includes(s.transition) ? s.transition : "fade",
    status: SLIDE_STATUSES.includes(s.status) ? s.status : "draft",
    elements: Array.isArray(s.elements) ? s.elements.filter((e) => e && e.type).map(normalizeEl) : [],
  }));
  return {
    id: deck.id || uid("deck"),
    title: typeof deck.title === "string" ? deck.title : "Imported presentation",
    theme: deck.theme && typeof deck.theme === "object" ? deck.theme : { font: FONTS.body, bg: P.deep },
    slides,
  };
}

function normalizeEl(e) {
  return {
    id: e.id || uid("el"),
    type: e.type,
    x: num(e.x, 100), y: num(e.y, 100), w: num(e.w, 300), h: num(e.h, 120),
    rotation: num(e.rotation, 0),
    props: e.props && typeof e.props === "object" ? e.props : {},
    style: e.style && typeof e.style === "object" ? e.style : {},
    anim: e.anim && typeof e.anim === "object" ? baseAnim(e.anim) : baseAnim(),
  };
}
const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);

export function downloadDeck(deck) {
  const safe = (deck.title || "presentation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "presentation";
  const blob = new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${safe}.studio.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ── Library: many separate presentations ───────────────────────────────────
// A manifest lists every deck ({id,title,updatedAt}); each deck is stored under
// its own key so autosave only rewrites the one being edited. A pre-existing
// single deck (v1) is migrated into the library on first load.
const MANIFEST_KEY = "northstar.studio.library.v1";
const deckKey = (id) => "northstar.studio.deck." + id;

const readJSON = (key) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } };
const writeJSON = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } };

export function loadManifest() {
  let m = readJSON(MANIFEST_KEY);
  if (!m || !Array.isArray(m.items)) m = { currentId: null, items: [] };
  if (!m.items.length) {
    const legacy = readJSON(STORE_KEY);
    const valid = legacy && validateDeck(legacy);
    if (valid) {
      writeJSON(deckKey(valid.id), valid);
      m = { currentId: valid.id, items: [{ id: valid.id, title: valid.title, updatedAt: Date.now() }] };
      writeJSON(MANIFEST_KEY, m);
      clearDeck();
    }
  }
  return m;
}

export function listDecks() {
  return loadManifest().items.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function loadDeckById(id) {
  const d = readJSON(deckKey(id));
  return d ? validateDeck(d) : null;
}

// Persist a deck and upsert its manifest entry; marks it as the current deck.
export function saveDeckToLib(deck) {
  writeJSON(deckKey(deck.id), deck);
  const m = loadManifest();
  const entry = { id: deck.id, title: deck.title || "Untitled", updatedAt: Date.now() };
  const i = m.items.findIndex((x) => x.id === deck.id);
  if (i >= 0) m.items[i] = entry; else m.items.push(entry);
  m.currentId = deck.id;
  writeJSON(MANIFEST_KEY, m);
  return listDecks();
}

export function deleteDeckFromLib(id) {
  try { localStorage.removeItem(deckKey(id)); } catch { /* ignore */ }
  const m = loadManifest();
  m.items = m.items.filter((x) => x.id !== id);
  if (m.currentId === id) m.currentId = m.items[0]?.id || null;
  writeJSON(MANIFEST_KEY, m);
  return m;
}

export function setCurrentDeckId(id) {
  const m = loadManifest(); m.currentId = id; writeJSON(MANIFEST_KEY, m);
}

// Deep clone a deck with brand-new ids (deck + every slide + every element).
export function duplicateDeckObj(deck, title) {
  return {
    ...cloneDeep(deck), id: uid("deck"),
    title: title ?? `${deck.title || "Untitled"} copy`,
    slides: deck.slides.map((s) => ({ ...cloneDeep(s), id: uid("slide"), elements: s.elements.map((e) => ({ ...cloneDeep(e), id: uid("el") })) })),
  };
}

export { baseAnim };
