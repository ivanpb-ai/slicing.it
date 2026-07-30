// ─────────────────────────────────────────────────────────────────────────
// StudioApp — the editor shell. Owns the presentation, selection, undo/redo
// history and autosave; wires the Navigator, Stage and Inspector together;
// and hosts the fullscreen Present overlay. All chrome styling is the STUDIO_CSS
// sheet injected below (KEYFRAMES drives every animation in effects.js).
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { STAGE_W, STAGE_H, P, STATUS_COLORS, cloneDeep, uid, createElement, createSlide, createPresentation, starterDeck, chartDefaults, loadManifest, listDecks, loadDeckById, saveDeckToLib, deleteDeckFromLib, setCurrentDeckId, duplicateDeckObj, validateDeck, downloadDeck, currentUser } from "./model";
import { KEYFRAMES } from "./effects";
import { downloadDeckHtml } from "./export-html";
import { SlideStage, SlideView } from "./stage";
import { Navigator, Inspector, Toolbar } from "./panels";
import { mountCopyEditor } from "../copy-editor-core";
import { COPY } from "../copy";
import { canvasHtmlToSlide } from "./canvas-interop";
import { exportDeckPptx } from "./export-pptx";
import { API_MODES, generateDeckPages, downloadPage, downloadPagesZip } from "./generate-pages";
import { lintDeck } from "./lint";
import { arrangeElements } from "./auto-arrange";
import { ImageInsertDialog } from "./image-insert";
import { syncLibrary, cloudPut, cloudDelete, cloudGetTemplate, cloudPutTemplate } from "./cloud";

const cloneSlide = (s) => ({ ...cloneDeep(s), id: uid("slide"), elements: s.elements.map((e) => ({ ...cloneDeep(e), id: uid("el") })) });
const clampZoom = (z) => Math.min(4, Math.max(0.5, z));

// Resizable side panels (desktop): widths persist per device.
const PANELW_KEY = "northstar.studio.panelw";
const PANELW_DEFAULT = { nav: 248, insp: 332 };
const clampNavW = (w) => Math.min(460, Math.max(160, Math.round(Number(w) || PANELW_DEFAULT.nav)));
const clampInspW = (w) => Math.min(560, Math.max(240, Math.round(Number(w) || PANELW_DEFAULT.insp)));

// ── Present overlay ────────────────────────────────────────────────────────
const TRANS_DUR = 0.9; // seconds — slide transition speed
const TR_CSS = `opacity ${TRANS_DUR}s cubic-bezier(0.16,1,0.3,1), transform ${TRANS_DUR}s cubic-bezier(0.16,1,0.3,1)`;

// Paired enter/exit states for the incoming and outgoing slides. `dir` is +1 when
// advancing, -1 when going back, so pushes and flips reverse direction sensibly.
function transitionStates(type, dir) {
  switch (type) {
    case "none":
      return { enterFrom: { o: 1, t: "none" }, exitTo: { o: 1, t: "none" } };
    case "fade":
      return { enterFrom: { o: 0, t: "none" }, exitTo: { o: 0, t: "none" } };
    case "slide-left":
      return { enterFrom: { o: 1, t: `translateX(${STAGE_W * dir}px)` }, exitTo: { o: 1, t: `translateX(${-STAGE_W * dir}px)` } };
    case "slide-up":
      return { enterFrom: { o: 1, t: `translateY(${STAGE_H * dir}px)` }, exitTo: { o: 1, t: `translateY(${-STAGE_H * dir}px)` } };
    case "zoom":
      return { enterFrom: { o: 0, t: "scale(0.82)" }, exitTo: { o: 0, t: "scale(1.14)" } };
    case "flip":
      return { enterFrom: { o: 0, t: `perspective(1800px) rotateY(${35 * dir}deg)` }, exitTo: { o: 0, t: `perspective(1800px) rotateY(${-35 * dir}deg)` } };
    default:
      return { enterFrom: { o: 0, t: "none" }, exitTo: { o: 0, t: "none" } };
  }
}

function Present({ deck, startIndex = 0, onClose }) {
  const [i, setI] = useState(startIndex);
  const [prev, setPrev] = useState(null); // outgoing slide index during a transition
  const [dir, setDir] = useState(1);
  const [active, setActive] = useState(false);
  const [scale, setScale] = useState(1);
  const iRef = useRef(i); iRef.current = i;
  const navTimer = useRef(0);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => () => clearTimeout(navTimer.current), []);

  // Go to another slide: mount the outgoing slide alongside the incoming one in
  // their pre-transition states, then flip `active` on the next frames so both
  // animate together. The outgoing layer is unmounted once the motion finishes.
  const navigate = useCallback((d, target) => {
    const cur = iRef.current;
    const ni = Math.max(0, Math.min(deck.slides.length - 1, target != null ? target : cur + d));
    if (ni === cur) return;
    clearTimeout(navTimer.current);
    const animateOut = deck.slides[ni].transition !== "none";
    setPrev(animateOut ? cur : null);
    setDir(ni >= cur ? 1 : -1);
    setActive(false);
    setI(ni);
    if (animateOut) navTimer.current = setTimeout(() => setPrev(null), TRANS_DUR * 1000 + 90);
  }, [deck.slides]);

  // Trigger the transition a couple of frames after the new slide has painted.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setActive(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [i]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); navigate(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); navigate(-1); }
      else if (e.key === "Escape") onClose();
      else if (e.key === "Home") navigate(-1, 0);
      else if (e.key === "End") navigate(1, deck.slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, onClose, deck.slides.length]);

  const incoming = deck.slides[i];
  const outgoing = prev != null ? deck.slides[prev] : null;
  const tt = transitionStates(incoming.transition, dir); // the transition you're going *to* drives both layers

  const layer = { position: "absolute", inset: 0, transition: TR_CSS };

  return (
    <div className="st-present" onClick={(e) => { const mid = window.innerWidth / 2; navigate(e.clientX > mid ? 1 : -1); }}>
      <div style={{ width: STAGE_W * scale, height: STAGE_H * scale, position: "relative" }}>
        <div style={{
          position: "absolute", top: 0, left: 0, width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "top left",
          borderRadius: 4, overflow: "hidden",
        }}>
          {outgoing && (
            <div key={`out-${prev}`} className="st-slide-fx-out" style={{
              ...layer, zIndex: 1,
              opacity: active ? tt.exitTo.o : 1, transform: active ? tt.exitTo.t : "none",
            }}>
              <SlideView slide={outgoing} mode="present" active={true} />
            </div>
          )}
          <div key={`in-${i}`} className="st-slide-fx" style={{
            ...layer, zIndex: 2,
            opacity: active ? 1 : tt.enterFrom.o, transform: active ? "none" : tt.enterFrom.t,
          }}>
            <SlideView slide={incoming} mode="present" active={active} />
          </div>
        </div>
      </div>

      <div className="st-present-bar" onClick={(e) => e.stopPropagation()}>
        <button className="st-btn" onClick={() => navigate(-1)} disabled={i === 0}>‹</button>
        <span className="st-present-count">{i + 1} / {deck.slides.length}</span>
        <button className="st-btn" onClick={() => navigate(1)} disabled={i === deck.slides.length - 1}>›</button>
        <button className="st-btn" onClick={onClose}>✕ Exit</button>
      </div>
      <div className="st-present-dots" onClick={(e) => e.stopPropagation()}>
        {deck.slides.map((s, k) => <button key={s.id} className={"st-pdot" + (k === i ? " on" : "")} onClick={() => navigate(0, k)} title={s.name} />)}
      </div>
    </div>
  );
}

// ── Site copy editor overlay ───────────────────────────────────────────────
// Hosts the mountable copy.js editor (copy-editor-core.js) over the Studio.
// Studio presentations are edited on the canvas itself; this overlay exists
// only for the live NorthStar deck's copy, which the canvas can't reach —
// it exports an updated copy.js to commit.
function SiteCopyOverlay({ onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const inst = mountCopyEditor(ref.current, { data: COPY });
    return () => inst.destroy();
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      const ae = document.activeElement;
      const editable = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || ae.isContentEditable);
      if (e.key === "Escape" && !editable) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="st-copyed">
      <div className="st-copyed-head">
        <span className="st-brand">🌐 NorthStar site copy</span>
        <span className="st-copyed-name">the live deck's text & colours (copy.js) — export & commit to deploy</span>
        <button className="st-btn" onClick={onClose}>✕ Close</button>
      </div>
      <div className="st-copyed-scroll" ref={ref} />
    </div>
  );
}

// ── Review (slide lint) dialog ──────────────────────────────────────────────
// Scores every slide against the consistency checklist: text fit, projector-
// size fonts, contrast, text density, image alt text and off-brand colours.
function ReviewDialog({ deck, onClose, onGoto }) {
  const [results, setResults] = useState(null);
  useEffect(() => { setResults(lintDeck(deck)); }, [deck]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const total = results ? results.reduce((a, r) => a + r.issues.length, 0) : 0;
  return (
    <div className="st-gen-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="st-gen st-review">
        <div className="st-gen-head">
          <b>✓ Review — {deck.title || "Untitled"}</b>
          <button className="st-icon" onClick={onClose}>✕</button>
        </div>
        <p className="st-gen-sub">
          Every slide is checked for text that won't fit, fonts too small for a projector, low contrast,
          text density, missing image alt text and off-brand (non-Telia-palette) colours. Click an issue to jump to it.
        </p>
        {results && results.map((r) => (
          <div key={r.slideIndex} className="st-review-slide">
            <div className="st-review-head" onClick={() => onGoto(r.slideIndex, null)}>
              <span className="st-status-dot" style={{ background: STATUS_COLORS[r.status] }} title={r.status} />
              <b>{r.slideIndex + 1} · {r.name}</b>
              <span className={"st-review-score" + (r.issues.length ? "" : " ok")}>
                {r.issues.length ? `${r.score} checks clean` : "all clear ✓"}
              </span>
            </div>
            {r.issues.map((iss, k) => (
              <button key={k} className="st-review-issue" onClick={() => onGoto(r.slideIndex, iss.elementId)}>
                {iss.level === "warn" ? "⚠" : "ⓘ"} {iss.msg}
              </button>
            ))}
          </div>
        ))}
        {results && (
          <p className="st-gen-sub">
            {total === 0
              ? "No issues — the deck passes every check."
              : `${total} issue${total === 1 ? "" : "s"} across ${results.filter((r) => r.issues.length).length} slide(s).`}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Generate interactive pages (the Slide Converter's step 3, on this deck) ─
function GeneratePagesDialog({ deck, onClose }) {
  const [mode, setMode] = useState("northstar");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState([]);
  const [pages, setPages] = useState(null);
  const log = (m) => setLines((l) => [...l, m]);

  const run = async () => {
    setBusy(true); setPages(null); setLines([]);
    try {
      setPages(await generateDeckPages(deck, mode, log));
    } catch (err) { log("Error: " + (err?.message || err)); }
    setBusy(false);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="st-gen-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="st-gen">
        <div className="st-gen-head">
          <b>Generate interactive pages</b>
          <button className="st-icon" onClick={onClose}>✕</button>
        </div>
        <p className="st-gen-sub">
          Turns every slide of “{deck.title || "Untitled"}” into a standalone click-to-explain HTML page —
          the Slide Converter's Generate step, applied to this deck. Text labels can be enriched with
          one-sentence descriptions:
        </p>
        {API_MODES.map((m) => (
          <label key={m.value} className={"st-gen-opt" + (mode === m.value ? " on" : "")}>
            <input type="radio" name="st-gen-mode" checked={mode === m.value} disabled={busy} onChange={() => setMode(m.value)} />
            <span><b>{m.label}</b> — {m.desc}</span>
          </label>
        ))}
        <div className="st-gen-actions">
          <button className="st-btn primary" disabled={busy} onClick={run}>{busy ? "Generating…" : "Generate"}</button>
          {pages && pages.map((p, i) => (
            <button key={i} className="st-btn" onClick={() => downloadPage(p)}>Download: {p.slug}.html</button>
          ))}
          {pages && pages.length > 1 && (
            <button className="st-btn" onClick={() => downloadPagesZip(pages, deck.title)}>Download all as .zip</button>
          )}
        </div>
        {lines.length > 0 && <div className="st-gen-log">{lines.map((l, i) => <div key={i}>{l}</div>)}</div>}
        {pages && <p className="st-gen-sub">Each page carries its own explanation-source switch (built-in / NorthStar / Perplexity). The pages re-import into the Studio, and the Slide Converter's Reverse step turns them into PowerPoint with the descriptions as speaker notes.</p>}
      </div>
    </div>
  );
}

// ── Help dialog ─────────────────────────────────────────────────────────────
// A quick tour of the editor's tools, opened from the toolbar's "?" button.
const Kbd = ({ k }) => <span className="st-kbd">{k}</span>;

const HELP_SECTIONS = [
  {
    title: "🖼 Canvas (centre)",
    body: <>Click an element to select it, drag to move (snap guides appear against other elements and the stage centre), drag a corner handle to resize. Double-click headings, text, kickers, quotes, buttons, card titles or counter labels to edit them in place. Nudge the selection with the arrow keys (<Kbd k="Shift" /> = 10&nbsp;px steps); <Kbd k="Esc" /> deselects. Zoom with the −/＋ controls, <Kbd k="Ctrl" />+scroll, or a two-finger pinch on touch screens — when zoomed in, scroll to pan. On desktop, drag the thin dividers either side of the canvas to resize the slide list and the inspector (double-click a divider to reset).</>,
  },
  {
    title: "✚ Insert",
    body: <>Adds a block to the current slide: headings, text, kickers, counters, buttons, lists, cards, icons, images, shapes, quotes, progress rings, orbit/radar/loop visuals — and charts. “Chart” opens a picker with the full PowerPoint chart family (column, bar, line, area, combo, pie, doughnut, radar, bubble, waterfall); the data is edited in a mini-table in the Inspector and the chart redraws live. “Image” opens a picker with three sources: upload a file from your device, search free openly-licensed photos (Openverse), or generate one from a short text description with AI (flux-1.1-pro).</>,
  },
  {
    title: "✦ Arrange",
    body: <>One click tidies the current slide: kickers, headings and the intro text are stacked and centred at the top, buttons drop into a row at the bottom, and everything else — cards, counters, images, lists, visuals — is re-sized and laid out on a balanced grid with even spacing. Charts, quotes and AI loops get a full-width row of their own. It's a starting point, not a straitjacket: drag anything afterwards, or press <Kbd k="Ctrl/⌘+Z" /> to undo the whole arrangement in one step.</>,
  },
  {
    title: "🎛 Inspector (right)",
    body: <>Shows the selected element's content, style, <b>Motion</b> (entrance effect, delay, duration, easing, idle loop) and <b>Layout</b> (position, size, rotation, opacity). Text blocks have a <b>Font</b> picker: the Telia theme roles, a catalogue of web-safe families, and — in Chrome/Edge — every font installed on your device. With nothing selected it edits the slide itself: name, transition, review status, and one of 14 live animated backgrounds with its colours.</>,
  },
  {
    title: "🗂 Slides (left)",
    body: <>Thumbnails of every slide. <b>+ Slide</b> adds one after the current; hovering a thumbnail reveals move / duplicate / delete. The coloured dot cycles the slide's status (draft → review → final) and the chips above filter by status.</>,
  },
  {
    title: "▤ Decks",
    body: <>Your presentation library — every deck autosaves as you edit. Create, duplicate, delete and switch decks, or <b>Import</b> a PowerPoint <code>.pptx</code> (each slide is converted into editable Studio blocks — text, images, shapes, even charts with their data — with layout and colours preserved), a Studio <code>.json</code> file, or converted <code>.html</code> slide pages. The <b>NorthStar site copy</b> entry at the bottom opens the live deck's copy.js editor — edit, export and commit to deploy. The admin account can publish the deck it is editing as the <b>welcome deck</b> every new user starts with (only admin can change it).</>,
  },
  {
    title: "✓ Review",
    body: <>Lints every slide: text that overflows its box, fonts too small to project, low contrast, too much copy, images without alt text, and colours outside the Telia palette. Click an issue to jump straight to it.</>,
  },
  {
    title: "⬇ Export",
    body: <><b>HTML presentation</b> — one self-contained file with the full animated player. <b>PowerPoint (.pptx)</b> — native slides with editable charts, via the Slide Converter's HTML→PPT engine. <b>Interactive pages</b> — one click-to-explain page per slide, enriched via the NorthStar or generic Perplexity API. <b>Studio JSON</b> — the editable source, for backup or sharing.</>,
  },
  {
    title: "▶ Present",
    body: <>Fullscreen playback with entrance animations and slide transitions. Navigate with <Kbd k="→" /> <Kbd k="←" /> <Kbd k="Space" />, click left/right half of the screen, or the dots on top; <Kbd k="Home" />/<Kbd k="End" /> jump to the first/last slide and <Kbd k="Esc" /> exits.</>,
  },
  {
    title: "⌨ Shortcuts",
    body: <><Kbd k="Ctrl/⌘+Z" /> undo · <Kbd k="Ctrl/⌘+Shift+Z" /> / <Kbd k="Ctrl/⌘+Y" /> redo · <Kbd k="Ctrl/⌘+D" /> duplicate element · <Kbd k="Del" /> delete element · arrows nudge · <Kbd k="Esc" /> deselect.</>,
  },
  {
    title: "💾 Saving",
    body: <>Everything autosaves to this browser's local storage a moment after each change (“Saved ✓”). “☁ synced” means the library is also mirrored across devices via the editor sign-in; “this device” means it lives only here — use Export → Studio JSON for backups. Sign out from the bottom of the Decks menu (with per-user accounts, each user sees only their own presentations).</>,
  },
];

function HelpDialog({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="st-gen-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="st-gen st-help">
        <div className="st-gen-head">
          <b>? Help — how the editor works</b>
          <button className="st-icon" onClick={onClose}>✕</button>
        </div>
        <p className="st-gen-sub">Slides are composed on a fixed 1280×720 stage that scales to any screen. Everything on a slide is a block you can drag, style and animate.</p>
        {HELP_SECTIONS.map((s) => (
          <div key={s.title} className="st-help-sec">
            <b>{s.title}</b>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pick the deck to open on launch: last-edited, else first in the library,
// else seed the starter deck.
function initialDeck() {
  const m = loadManifest();
  for (const id of [m.currentId, m.items[0]?.id].filter(Boolean)) {
    const d = loadDeckById(id);
    if (d) return d;
  }
  const starter = starterDeck();
  saveDeckToLib(starter);
  seededStarter = true; // launch effect may swap it for the published welcome deck
  return starter;
}
let seededStarter = false;

// ── main editor ─────────────────────────────────────────────────────────────
export default function StudioApp() {
  const [deck, setDeck] = useState(initialDeck);
  const [library, setLibrary] = useState(() => listDecks());
  const [current, setCurrent] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [presenting, setPresenting] = useState(false);
  const [startAt, setStartAt] = useState(0);
  // Site copy (copy.js) editor overlay. The old /copy-editor URL redirects
  // here (netlify.toml) with #copy, which opens it directly.
  const [siteCopy, setSiteCopy] = useState(() => window.location.hash === "#copy");
  const [genPages, setGenPages] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [helping, setHelping] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  // Mobile: the side panels become slide-in drawers toggled by the FABs.
  const [navOpen, setNavOpen] = useState(false);
  const [inspOpen, setInspOpen] = useState(false);
  // Stage zoom: 1 = fit-to-width. Buttons, Ctrl+wheel and pinch all set it.
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1); zoomRef.current = zoom;
  const prevZoomRef = useRef(1);
  const stageWrapRef = useRef(null);
  // Desktop: the slide list and inspector are resizable via drag splitters.
  const [panelW, setPanelW] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(PANELW_KEY) || "");
      return { nav: clampNavW(v.nav), insp: clampInspW(v.insp) };
    } catch { return { nav: PANELW_DEFAULT.nav, insp: PANELW_DEFAULT.insp }; }
  });
  useEffect(() => {
    try { localStorage.setItem(PANELW_KEY, JSON.stringify(panelW)); } catch { /* private mode */ }
  }, [panelW]);
  const dragSplitter = (side) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = panelW[side];
    const clamp = side === "nav" ? clampNavW : clampInspW;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      const d = ev.clientX - startX;
      setPanelW((p) => ({ ...p, [side]: clamp(side === "nav" ? start + d : start - d) }));
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  useEffect(() => {
    const onHash = () => { if (window.location.hash === "#copy") setSiteCopy(true); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [saved, setSaved] = useState(true);
  // Cross-device sync state: "sync" | "ok" | "off" (API unreachable) | "unauth"
  const [cloud, setCloud] = useState("sync");
  const [undo, setUndo] = useState([]);
  const [redo, setRedo] = useState([]);
  const fileRef = useRef(null);
  const saveTimer = useRef(0);
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const touchedRef = useRef(false); // has the user edited anything this session?

  const pushCloud = useCallback((d, updatedAt) => {
    setCloud((c) => (c === "off" || c === "unauth" ? c : "sync"));
    cloudPut(d, updatedAt)
      .then(() => setCloud("ok"))
      .catch((e) => setCloud(e?.status === 401 ? "unauth" : "off"));
  }, []);

  // Pull/merge the shared library on launch; push anything newer local-side.
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const { pulled } = await syncLibrary(deckRef.current.id);
        if (!on) return;
        setLibrary(listDecks());
        // The open deck was updated on another device and nothing has been
        // edited here yet — swap in the fresh copy.
        if (pulled.includes(deckRef.current.id) && !touchedRef.current) {
          const fresh = loadDeckById(deckRef.current.id);
          if (fresh) setDeck(fresh);
        }
        setCloud("ok");
        // A brand-new library was seeded with the built-in starter — replace
        // it with the admin-published welcome deck when one exists. Users get
        // their own copy; only admin can change the template itself.
        if (seededStarter && !touchedRef.current) {
          const raw = await cloudGetTemplate();
          const tpl = raw ? validateDeck(raw) : null;
          if (on && tpl && !touchedRef.current) {
            const seededId = deckRef.current.id;
            const copy = duplicateDeckObj(tpl, tpl.title || "Welcome to Presentation Studio");
            saveDeckToLib(copy);
            deleteDeckFromLib(seededId);
            cloudDelete(seededId); // the starter may already have autosynced
            setDeck(copy); setCurrent(0); setSelectedId(null); setEditingId(null);
            setCurrentDeckId(copy.id); setLibrary(listDecks());
          }
        }
      } catch (e) {
        if (on) setCloud(e?.status === 401 ? "unauth" : "off");
      }
    })();
    return () => { on = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const slide = deck.slides[Math.min(current, deck.slides.length - 1)];
  const selected = useMemo(() => slide.elements.find((e) => e.id === selectedId) || null, [slide, selectedId]);

  // autosave (debounced) — local first, then mirrored to the shared library
  useEffect(() => {
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const now = Date.now();
      saveDeckToLib(deckRef.current, { updatedAt: now });
      setLibrary(listDecks());
      setSaved(true);
      pushCloud(deckRef.current, now);
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [deck, pushCloud]);

  const checkpoint = useCallback(() => {
    touchedRef.current = true;
    const cur = JSON.stringify(deckRef.current);
    setUndo((u) => (u[u.length - 1] === cur ? u : [...u.slice(-79), cur]));
    setRedo([]);
  }, []);

  const doUndo = useCallback(() => {
    setUndo((u) => {
      if (!u.length) return u;
      setRedo((r) => [...r, JSON.stringify(deckRef.current)]);
      const prev = JSON.parse(u[u.length - 1]);
      setDeck(prev); setEditingId(null); setSelectedId(null);
      return u.slice(0, -1);
    });
  }, []);
  const doRedo = useCallback(() => {
    setRedo((r) => {
      if (!r.length) return r;
      setUndo((u) => [...u, JSON.stringify(deckRef.current)]);
      setDeck(JSON.parse(r[r.length - 1])); setEditingId(null);
      return r.slice(0, -1);
    });
  }, []);

  // mutators ----------------------------------------------------------------
  const patchSlide = (idx, fn) => setDeck((d) => ({ ...d, slides: d.slides.map((s, i) => (i === idx ? fn(s) : s)) }));

  const changeElement = useCallback((id, patch, cp = false) => {
    if (cp) checkpoint();
    setDeck((d) => ({ ...d, slides: d.slides.map((s, i) => (i !== current ? s : { ...s, elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) })) }));
  }, [checkpoint, current]);

  const changeSlide = useCallback((patch, cp = false) => { if (cp) checkpoint(); patchSlide(current, (s) => ({ ...s, ...patch })); }, [checkpoint, current]);

  const insertElement = (type, chartKind) => {
    // Images go through the source picker (upload / Openverse / AI generate).
    if (type === "image") { setImgOpen(true); return; }
    checkpoint();
    const el = createElement(type, type === "chart" && chartKind ? chartDefaults(chartKind) : {});
    patchSlide(current, (s) => ({ ...s, elements: [...s.elements, el] }));
    setSelectedId(el.id);
  };
  const insertImage = (over) => {
    checkpoint();
    const el = createElement("image", over);
    patchSlide(current, (s) => ({ ...s, elements: [...s.elements, el] }));
    setSelectedId(el.id);
    setImgOpen(false);
  };
  const duplicateElement = (id) => {
    checkpoint();
    const src = slide.elements.find((e) => e.id === id); if (!src) return;
    const copy = { ...cloneDeep(src), id: uid("el"), x: src.x + 24, y: src.y + 24 };
    patchSlide(current, (s) => ({ ...s, elements: [...s.elements, copy] }));
    setSelectedId(copy.id);
  };
  const deleteElement = (id) => {
    checkpoint();
    patchSlide(current, (s) => ({ ...s, elements: s.elements.filter((e) => e.id !== id) }));
    setSelectedId(null);
  };
  const layer = (id, action) => {
    checkpoint();
    patchSlide(current, (s) => {
      const arr = [...s.elements]; const i = arr.findIndex((e) => e.id === id); if (i < 0) return s;
      const [it] = arr.splice(i, 1);
      if (action === "front") arr.push(it);
      else if (action === "back") arr.unshift(it);
      else if (action === "up") arr.splice(Math.min(arr.length, i + 1), 0, it);
      else arr.splice(Math.max(0, i - 1), 0, it);
      return { ...s, elements: arr };
    });
  };
  const autoArrange = () => {
    if (!slide.elements.length) return;
    checkpoint();
    patchSlide(current, (s) => ({ ...s, elements: arrangeElements(s.elements) }));
    setEditingId(null);
  };

  // slide ops
  const addSlide = () => {
    checkpoint();
    const s = createSlide({ name: `Slide ${deck.slides.length + 1}`, background: cloneDeep(slide.background), transition: slide.transition });
    setDeck((d) => ({ ...d, slides: [...d.slides.slice(0, current + 1), s, ...d.slides.slice(current + 1)] }));
    setCurrent(current + 1); setSelectedId(null);
  };
  const duplicateSlide = (i) => {
    checkpoint();
    const copy = cloneSlide(deck.slides[i]);
    setDeck((d) => ({ ...d, slides: [...d.slides.slice(0, i + 1), copy, ...d.slides.slice(i + 1)] }));
    setCurrent(i + 1); setSelectedId(null);
  };
  const deleteSlide = (i) => {
    if (deck.slides.length <= 1) return;
    checkpoint();
    setDeck((d) => ({ ...d, slides: d.slides.filter((_, k) => k !== i) }));
    setCurrent((c) => Math.max(0, Math.min(c, deck.slides.length - 2)));
    setSelectedId(null);
  };
  const moveSlide = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= deck.slides.length) return;
    checkpoint();
    setDeck((d) => { const arr = [...d.slides]; [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...d, slides: arr }; });
    setCurrent(j);
  };

  // library / deck ops — each presentation is stored separately
  const untitledName = () => `Untitled presentation ${library.length + 1}`;
  const persistCurrent = () => {
    const now = Date.now();
    saveDeckToLib(deckRef.current, { updatedAt: now });
    pushCloud(deckRef.current, now);
  };
  const switchTo = (d) => {
    setDeck(d); setCurrent(0); setSelectedId(null); setEditingId(null);
    setUndo([]); setRedo([]); setCurrentDeckId(d.id); setLibrary(listDecks());
  };
  const openDeck = (id) => { if (id === deck.id) return; persistCurrent(); const d = loadDeckById(id); if (d) switchTo(d); };
  const newPresentation = () => { persistCurrent(); const blank = createPresentation({ title: untitledName() }); saveDeckToLib(blank); switchTo(blank); };
  const duplicateCurrentDeck = () => { persistCurrent(); const copy = duplicateDeckObj(deck); saveDeckToLib(copy); switchTo(copy); };
  const deleteDeck = (id) => {
    const item = library.find((x) => x.id === id);
    if (!window.confirm(`Delete “${item?.title || "this presentation"}”? This can't be undone.`)) return;
    cloudDelete(id); // tombstone server-side so the deletion reaches other devices
    const m = deleteDeckFromLib(id);
    if (id === deck.id) {
      const next = m.currentId ? loadDeckById(m.currentId) : null;
      if (next) switchTo(next);
      else { const blank = createPresentation({ title: "Untitled presentation 1" }); saveDeckToLib(blank); switchTo(blank); }
    } else setLibrary(listDecks());
  };
  const importDeck = () => fileRef.current?.click();

  // Slide Converter pages (.html, one slide each) become a new editable deck.
  const importConverterPages = async (files) => {
    const slides = [];
    for (const f of files) {
      try {
        const s = canvasHtmlToSlide(await f.text());
        if (s) slides.push(s);
      } catch { /* skip unreadable file */ }
    }
    if (!slides.length) {
      window.alert("No slide canvas found in those files — import .html pages generated by the Slide Converter.");
      return;
    }
    persistCurrent();
    const imported = createPresentation({ title: slides[0].name || "Imported slides", slides });
    saveDeckToLib(imported);
    switchTo(imported);
  };

  // PowerPoint upload → editable deck. The converter's PPTX engine lives in
  // the Studio now (js/studio/import-pptx.js, loaded on demand).
  const importPptxFile = async (file) => {
    try {
      const { pptxFileToDeck } = await import("./import-pptx");
      const { title, slides } = await pptxFileToDeck(file);
      persistCurrent();
      const imported = createPresentation({ title, slides });
      saveDeckToLib(imported);
      switchTo(imported);
    } catch (err) {
      window.alert("PowerPoint import failed: " + (err?.message || err));
    }
  };

  const onFile = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    const pptxFile = files.find((f) => /\.pptx$/i.test(f.name));
    if (pptxFile) { importPptxFile(pptxFile); return; }
    const htmlFiles = files.filter((f) => /\.html?$/i.test(f.name));
    if (htmlFiles.length) { importConverterPages(htmlFiles); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = validateDeck(JSON.parse(reader.result));
        if (!parsed) throw new Error("bad");
        persistCurrent();
        const imported = { ...parsed, id: uid("deck") }; // distinct library entry
        saveDeckToLib(imported); switchTo(imported);
      } catch { window.alert("That file isn't a valid Studio presentation (.json), PowerPoint (.pptx), or converted slide page (.html)."); }
    };
    reader.readAsText(files[0]);
  };
  const exportDeck = () => downloadDeck(deck);
  const exportHtml = () => downloadDeckHtml(deck);
  const exportPptx = () => exportDeckPptx(deckRef.current)
    .catch((err) => window.alert("PowerPoint export failed: " + (err?.message || err)));

  // Admin only: publish the deck being edited as the site-wide welcome deck.
  const publishTemplate = () => {
    if (!window.confirm(`Make “${deckRef.current.title || "Untitled"}” the welcome deck that every NEW user starts with? Existing users keep their decks.`)) return;
    cloudPutTemplate(deckRef.current)
      .then(() => window.alert("Published — new users will now start with this deck."))
      .catch((e) => window.alert("Could not publish the welcome deck: " + (e?.message || e)));
  };


  // site copy editor overlay -------------------------------------------------
  const closeSiteCopy = useCallback(() => {
    setSiteCopy(false);
    if (window.location.hash === "#copy") history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  // keyboard shortcuts (editor only)
  useEffect(() => {
    const onKey = (e) => {
      if (presenting || siteCopy || genPages || reviewing || helping) return;
      const ae = document.activeElement;
      const editable = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
      if (meta && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); return; }
      if (editable) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteElement(selectedId); return; }
      if (meta && e.key.toLowerCase() === "d" && selectedId) { e.preventDefault(); duplicateElement(selectedId); return; }
      if (e.key === "Escape") { setEditingId(null); setSelectedId(null); return; }
      if (selectedId && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const el = slide.elements.find((x) => x.id === selectedId); if (!el) return;
        checkpoint();
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        changeElement(selectedId, { x: el.x + dx, y: el.y + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, siteCopy, genPages, reviewing, helping, selectedId, slide, checkpoint, changeElement, doUndo, doRedo]);

  // Stage zoom via Ctrl+wheel (desktop) and two-finger pinch (touch).
  useEffect(() => {
    const el = stageWrapRef.current; if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY > 0 ? 0.9 : 1.1)));
    };
    let pinch = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e) => { if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoomRef.current }; };
    const onTouchMove = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault(); // keep the browser from zooming the whole page
      setZoom(clampZoom(pinch.z * (dist(e.touches) / pinch.d)));
    };
    const onTouchEnd = () => { pinch = null; };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  // Keep the viewport centred on the same stage point across zoom changes.
  useLayoutEffect(() => {
    const el = stageWrapRef.current; if (!el) return;
    const r = zoom / prevZoomRef.current;
    if (r !== 1) {
      el.scrollLeft = (el.scrollLeft + el.clientWidth / 2) * r - el.clientWidth / 2;
      el.scrollTop = (el.scrollTop + el.clientHeight / 2) * r - el.clientHeight / 2;
    }
    prevZoomRef.current = zoom;
  }, [zoom]);

  return (
    <div className="st-root">
      <style>{KEYFRAMES + STUDIO_CSS}</style>

      <Toolbar
        title={deck.title} onTitle={(v) => setDeck((d) => ({ ...d, title: v }))} onCheckpoint={checkpoint}
        onInsert={insertElement} onUndo={doUndo} onRedo={doRedo} canUndo={undo.length > 0} canRedo={redo.length > 0} onAutoArrange={autoArrange}
        onPresent={() => { setStartAt(current); setPresenting(true); }}
        library={library} currentId={deck.id} onOpenDeck={openDeck} onNewDeck={newPresentation} onDuplicateDeck={duplicateCurrentDeck} onDeleteDeck={deleteDeck}
        onImport={importDeck} onExport={exportDeck} onExportHtml={exportHtml} onExportPptx={exportPptx} onGeneratePages={() => setGenPages(true)} onSiteCopy={() => setSiteCopy(true)} onReview={() => setReviewing(true)} onHelp={() => setHelping(true)} onPublishTemplate={currentUser === "admin" ? publishTemplate : null} saved={saved} cloud={cloud}
      />

      <div className={"st-body" + (navOpen ? " nav-open" : "") + (inspOpen ? " insp-open" : "")}
        style={{ "--navw": `${panelW.nav}px`, "--inspw": `${panelW.insp}px` }}>
        <Navigator slides={deck.slides} current={current} onSelect={(i) => { setCurrent(i); setSelectedId(null); setEditingId(null); setNavOpen(false); }}
          onAdd={addSlide} onDuplicate={duplicateSlide} onDelete={deleteSlide} onMove={moveSlide}
          onStatus={(i, status) => { checkpoint(); patchSlide(i, (s) => ({ ...s, status })); }} />
        <div className="st-split" title="Drag to resize the slide list — double-click to reset"
          onPointerDown={dragSplitter("nav")} onDoubleClick={() => setPanelW((p) => ({ ...p, nav: PANELW_DEFAULT.nav }))} />

        <div className="st-stagecol">
          <div className="st-stagewrap" ref={stageWrapRef}>
            <div className="st-stagesizer" style={{ width: `${zoom * 100}%`, maxWidth: 1080 * zoom }}>
            <SlideStage
              slide={slide} selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); if (id !== editingId) setEditingId(null); }}
              onChange={changeElement} onCheckpoint={checkpoint}
              editingId={editingId} onStartEdit={(id) => { setSelectedId(id); setEditingId(id); }} onEndEdit={() => setEditingId(null)}
            />
            </div>
          </div>
          <div className="st-stagebar">
            <span><b>{slide.name}</b> · {slide.elements.length} element{slide.elements.length === 1 ? "" : "s"}</span>
            <span className="st-muted">Drag to move · corner to resize · double-click text to edit · arrows nudge</span>
            <div className="st-zoomctl">
              <button className="st-icon" title="Zoom out (Ctrl+scroll)" onClick={() => setZoom((z) => clampZoom(z / 1.25))}>−</button>
              <button className="st-zoom-val" title="Reset zoom to fit" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
              <button className="st-icon" title="Zoom in (Ctrl+scroll)" onClick={() => setZoom((z) => clampZoom(z * 1.25))}>＋</button>
            </div>
          </div>
        </div>

        <div className="st-split" title="Drag to resize the inspector — double-click to reset"
          onPointerDown={dragSplitter("insp")} onDoubleClick={() => setPanelW((p) => ({ ...p, insp: PANELW_DEFAULT.insp }))} />
        <Inspector element={selected} slide={slide} onChangeElement={changeElement} onChangeSlide={changeSlide}
          onCheckpoint={checkpoint} onLayer={layer} onDuplicate={duplicateElement} onDelete={deleteElement} />
      </div>

      {/* Mobile: drawer backdrop + toggles (hidden on desktop via CSS) */}
      {(navOpen || inspOpen) && <div className="st-drawer-backdrop" onClick={() => { setNavOpen(false); setInspOpen(false); }} />}
      <button className="st-fab left" onClick={() => { setNavOpen((v) => !v); setInspOpen(false); }}>▤ Slides</button>
      <button className="st-fab right" onClick={() => { setInspOpen((v) => !v); setNavOpen(false); }}>🎛 Edit</button>
      <div className="st-fab zoom">
        <button title="Zoom out" onClick={() => setZoom((z) => clampZoom(z / 1.25))}>−</button>
        <button className="st-zoom-val" title="Reset zoom to fit" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button title="Zoom in" onClick={() => setZoom((z) => clampZoom(z * 1.25))}>＋</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json,.pptx,.html,.htm" multiple style={{ display: "none" }} onChange={onFile} />
      {reviewing && <ReviewDialog deck={deck} onClose={() => setReviewing(false)}
        onGoto={(i, elId) => { setReviewing(false); setCurrent(i); setSelectedId(elId); setEditingId(null); }} />}
      {genPages && <GeneratePagesDialog deck={deck} onClose={() => setGenPages(false)} />}
      {imgOpen && <ImageInsertDialog onInsert={insertImage} onClose={() => setImgOpen(false)} />}
      {helping && <HelpDialog onClose={() => setHelping(false)} />}
      {siteCopy && <SiteCopyOverlay onClose={closeSiteCopy} />}
      {presenting && <Present deck={deck} startIndex={startAt} onClose={() => setPresenting(false)} />}
    </div>
  );
}

// ── chrome stylesheet ────────────────────────────────────────────────────────
const STUDIO_CSS = `
.st-root{--line:rgba(244,224,255,0.14);--line2:rgba(244,224,255,0.08);--bg:#160427;--panel:rgba(255,255,255,0.03);--in:rgba(0,0,0,0.3);
  position:fixed;inset:0;display:flex;flex-direction:column;background:var(--bg);color:#F4E0FF;
  font-family:'Telia Sans',system-ui,-apple-system,sans-serif;font-size:13px;overflow:hidden;}
.st-root *{box-sizing:border-box;}
.st-root button{font:inherit;cursor:pointer;}
.st-btn{background:rgba(255,255,255,0.06);color:#F4E0FF;border:1px solid var(--line);border-radius:8px;padding:7px 12px;transition:border-color .15s,background .15s;text-decoration:none;display:inline-flex;align-items:center;gap:6px;}
.st-btn:hover{border-color:${P.cyan};}
.st-btn:disabled{opacity:.35;cursor:default;}
.st-btn.primary{background:${P.purple};border-color:${P.purple};color:#fff;font-weight:600;}
.st-btn.primary:hover{background:#b01ff5;}
.st-btn.sm{padding:4px 9px;border-radius:7px;font-size:12px;}
.st-icon{background:rgba(255,255,255,0.05);border:1px solid var(--line);color:#F4E0FF;border-radius:6px;padding:2px 7px;font-size:12px;line-height:1.4;}
.st-icon:hover{border-color:${P.cyan};}
.st-icon.danger:hover{border-color:${P.red};color:${P.red};}

/* toolbar */
.st-toolbar{height:52px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;background:rgba(20,5,40,0.97);border-bottom:1px solid var(--line);z-index:5;}
.st-tb-left,.st-tb-center,.st-tb-right{display:flex;align-items:center;gap:8px;}
.st-tb-left{flex:1 1 auto;min-width:0;}
.st-tb-center,.st-tb-right{flex:none;}
.st-brand{font-weight:700;letter-spacing:.5px;color:${P.cyan};white-space:nowrap;}
.st-title{flex:1 1 auto;min-width:140px;max-width:480px;background:transparent;border:1px solid transparent;border-radius:7px;color:#fff;font:inherit;font-weight:600;font-size:14px;padding:5px 8px;text-overflow:ellipsis;}
.st-title:hover{border-color:var(--line);}
.st-title:focus{outline:none;border-color:${P.cyan};background:var(--in);}
.st-saved{font-size:11px;color:${P.muted};min-width:54px;white-space:nowrap;}
.st-saved.on{color:${P.green};}
.st-cloud{color:${P.muted};}
.st-cloud.ok{color:${P.cyan};}
.st-cloud.unauth{color:${P.gold};}
.st-insert{position:relative;}
.st-insert-menu{position:absolute;top:110%;left:0;z-index:20;background:#22093b;border:1px solid var(--line);border-radius:12px;padding:8px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px;width:280px;box-shadow:0 20px 50px rgba(0,0,0,.5);}
.st-insert-item{display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);color:#F4E0FF;border-radius:8px;padding:8px 10px;text-align:left;}
.st-insert-item:hover{border-color:${P.cyan};background:rgba(0,212,255,0.08);}
.st-insert-ic{display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;color:${P.cyan};font-weight:700;}

/* decks menu */
.st-decks{position:relative;}
.st-decks-menu{position:absolute;top:120%;left:0;z-index:30;width:300px;background:#22093b;border:1px solid var(--line);border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.5);overflow:hidden;}
.st-decks-list{max-height:320px;overflow-y:auto;padding:6px;display:flex;flex-direction:column;gap:4px;}
.st-deckrow{display:flex;align-items:stretch;gap:4px;border-radius:8px;border:1px solid transparent;}
.st-deckrow.on{background:rgba(0,212,255,0.08);border-color:${P.cyan}55;}
.st-deckrow:hover{background:rgba(255,255,255,0.04);}
.st-deckopen{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;align-items:flex-start;background:transparent;border:0;color:#F4E0FF;padding:8px 10px;text-align:left;}
.st-deckname{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.st-deckdate{font-size:10.5px;color:${P.muted};font-family:ui-monospace,monospace;}
.st-deckrow.on .st-deckname{color:${P.cyan};}
.st-deck-del{align-self:center;margin-right:6px;opacity:0;}
.st-deckrow:hover .st-deck-del,.st-deckrow.on .st-deck-del{opacity:1;}
.st-decks-foot{display:flex;gap:6px;padding:8px;border-top:1px solid var(--line);background:rgba(0,0,0,0.2);}
.st-decks-foot .st-btn{flex:1;justify-content:center;}
.st-decks-user{display:flex;align-items:center;gap:8px;padding:7px 10px;border-top:1px solid var(--line);font-size:11.5px;color:${P.dim};}
.st-decks-user span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.st-sitecopy{display:flex;flex-direction:column;gap:2px;align-items:flex-start;width:100%;background:rgba(0,212,255,0.05);border:0;border-top:1px solid var(--line);color:#F4E0FF;padding:9px 12px;text-align:left;}
.st-sitecopy:hover{background:rgba(0,212,255,0.12);}
.st-sitecopy .st-deckname{color:${P.cyan};}

/* export menu */
.st-export{position:relative;}
.st-export-menu{position:absolute;top:110%;right:0;z-index:20;width:280px;background:#22093b;border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;box-shadow:0 20px 50px rgba(0,0,0,.5);}
.st-export-item{display:flex;flex-direction:column;gap:3px;align-items:flex-start;text-align:left;background:var(--panel);border:1px solid var(--line);color:#F4E0FF;border-radius:8px;padding:9px 11px;}
.st-export-item:hover{border-color:${P.cyan};background:rgba(0,212,255,0.08);}
.st-export-item b{font-size:13px;}
.st-export-item span{font-size:11px;color:${P.muted};line-height:1.4;}

/* body */
.st-body{flex:1;display:grid;grid-template-columns:var(--navw,248px) 6px minmax(0,1fr) 6px var(--inspw,332px);min-height:0;}
.st-split{cursor:col-resize;position:relative;z-index:6;touch-action:none;}
.st-split::after{content:"";position:absolute;inset:0 1px;border-radius:2px;background:transparent;transition:background .15s;}
.st-split:hover::after,.st-split:active::after{background:rgba(153,10,227,0.5);}
.st-nav{border-right:1px solid var(--line);overflow-y:auto;padding:10px;}
.st-nav-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-weight:600;}
.st-nav-list{display:flex;flex-direction:column;gap:10px;}
.st-slide{border:1px solid var(--line);border-radius:10px;padding:7px;background:var(--panel);cursor:pointer;transition:border-color .15s;}
.st-slide:hover{border-color:rgba(0,212,255,0.5);}
.st-slide.on{border-color:${P.cyan};box-shadow:0 0 0 1px ${P.cyan};}
.st-slide-top{display:flex;align-items:center;gap:7px;margin-bottom:6px;}
.st-slide-no{font-family:ui-monospace,monospace;font-size:11px;color:${P.muted};background:rgba(0,0,0,.3);border-radius:5px;padding:1px 6px;}
.st-slide-name{font-size:12px;color:#F4E0FF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.st-thumb{position:relative;width:100%;aspect-ratio:${STAGE_W}/${STAGE_H};border-radius:6px;overflow:hidden;background:${P.deep};border:1px solid var(--line2);}
.st-slide-ctrls{display:flex;gap:4px;margin-top:6px;opacity:0;transition:opacity .15s;}
.st-slide:hover .st-slide-ctrls,.st-slide.on .st-slide-ctrls{opacity:1;}

/* stage column */
.st-stagecol{display:flex;flex-direction:column;min-width:0;background:radial-gradient(circle at 50% -10%,#22093e,#0e0420);}
.st-stagewrap{flex:1;display:flex;padding:26px;overflow:auto;min-height:0;touch-action:pan-x pan-y;}
.st-stagewrap>div{flex:none;width:100%;max-width:1080px;margin:auto;}
.st-zoomctl{display:flex;align-items:center;gap:4px;flex:none;}
.st-zoom-val{background:transparent;border:1px solid transparent;border-radius:6px;color:inherit;font-family:ui-monospace,monospace;font-size:11px;min-width:46px;text-align:center;padding:2px 4px;cursor:pointer;}
.st-zoom-val:hover{border-color:var(--line);}
.st-stagebar{flex:none;height:34px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-top:1px solid var(--line);font-size:12px;background:rgba(20,5,40,0.6);}
.st-muted{color:${P.muted};}

/* inspector */
.st-inspector{border-left:1px solid var(--line);overflow-y:auto;padding:0 0 40px;}
.st-insp-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(20,5,40,0.96);border-bottom:1px solid var(--line);}
.st-insp-type{font-weight:700;text-transform:capitalize;letter-spacing:.3px;}
.st-insp-actions{display:flex;gap:4px;}
.st-group{padding:12px;border-bottom:1px solid var(--line2);}
.st-group-hd{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${P.cyan};margin-bottom:10px;font-weight:600;}
.st-field{display:flex;align-items:center;gap:8px;margin-bottom:9px;}
.st-field.wide{flex-direction:column;align-items:stretch;gap:4px;}
.st-label{font-size:11.5px;color:${P.dim};min-width:78px;flex:none;}
.st-field.wide .st-label{min-width:0;}
.st-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;}
.st-grid2 .st-field{margin-bottom:2px;}
.st-grid2 .st-label{min-width:52px;}
.st-in,.st-area,.st-sel,.st-hex{width:100%;font:inherit;padding:6px 8px;border-radius:7px;border:1px solid var(--line);background:var(--in);color:#F4E0FF;}
.st-in:focus,.st-area:focus,.st-sel:focus,.st-hex:focus{outline:none;border-color:${P.cyan};}
.st-area{resize:vertical;line-height:1.45;}
.st-sel{appearance:none;cursor:pointer;padding-right:24px;background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="9" height="6"><path d="M0 0l4.5 6L9 0z" fill="%23F4E0FF" opacity="0.55"/></svg>');background-repeat:no-repeat;background-position:right 9px center;}
.st-seg{display:flex;border:1px solid var(--line);border-radius:7px;overflow:hidden;flex:1;}
.st-seg button{flex:1;background:transparent;color:${P.dim};border:0;padding:6px 4px;border-left:1px solid var(--line);text-transform:capitalize;}
.st-seg button:first-child{border-left:0;}
.st-seg button.on{background:${P.purple};color:#fff;}
.st-toggle{background:var(--in);border:1px solid var(--line);color:${P.dim};border-radius:7px;padding:6px 14px;}
.st-toggle.on{background:${P.green}2e;border-color:${P.green};color:${P.green};}
.st-swatches{display:flex;flex-wrap:wrap;gap:4px;align-items:center;}
.st-sw{width:18px;height:18px;border-radius:5px;border:1px solid rgba(255,255,255,.25);padding:0;}
.st-sw.on{outline:2px solid #fff;outline-offset:1px;}
.st-sw.none{background:repeating-conic-gradient(#555 0% 25%,#222 0% 50%) 50%/8px 8px;}
.st-hex{width:74px;flex:none;font-family:ui-monospace,monospace;font-size:11px;padding:4px 6px;}
.st-arr{display:flex;flex-direction:column;gap:6px;}
.st-arr-row{display:flex;gap:5px;align-items:center;}
.st-arr-row .st-in{flex:1;}
.st-subcard{border:1px solid var(--line);border-radius:9px;padding:8px;display:flex;flex-direction:column;gap:7px;background:rgba(0,0,0,.14);}
.st-grad{display:flex;flex-direction:column;gap:8px;}
.st-grad-presets{display:flex;gap:6px;flex-wrap:wrap;}
.st-grad-preset{width:46px;height:18px;border-radius:5px;border:1px solid var(--line);padding:0;}
.st-grad-stops{display:flex;flex-direction:column;gap:6px;}
.st-hint{padding:14px 14px;color:${P.muted};font-size:12px;line-height:1.6;}

/* chart data mini-table */
.st-chart-table-wrap{overflow-x:auto;margin:2px 0 8px;border:1px solid var(--line);border-radius:8px;background:rgba(0,0,0,0.15);}
.st-chart-table{border-collapse:collapse;font-size:11px;}
.st-chart-table th,.st-chart-table td{border:1px solid var(--line2);padding:2px;text-align:center;vertical-align:middle;}
.st-chart-table input{width:52px;font:inherit;font-size:11px;background:var(--in);border:1px solid transparent;border-radius:4px;color:#F4E0FF;padding:3px 4px;text-align:center;}
.st-chart-table input:focus{outline:none;border-color:${P.cyan};}
.st-series-cell{display:flex;align-items:center;gap:4px;padding:0 2px;}
.st-series-cell input{width:62px;text-align:left;}
.st-series-dot{width:14px;height:14px;border-radius:4px;border:1px solid rgba(255,255,255,.35);flex:none;cursor:pointer;padding:0;}
.st-cell-del{display:block;margin:1px auto 0;background:transparent;border:0;color:${P.muted};font-size:9px;line-height:1;padding:0;cursor:pointer;}
.st-cell-del:hover{color:${P.red};}

/* brand deviation flag on hex inputs */
.st-hex.offbrand{border-color:${P.gold};color:${P.gold};}
.st-offbrand-flag{color:${P.gold};font-size:12px;flex:none;}

/* truncation warning */
.st-fit-warn{margin:10px 12px;padding:9px 11px;border-radius:9px;border:1px solid ${P.gold}66;background:${P.gold}14;color:${P.gold};font-size:11.5px;line-height:1.5;}

/* slide status tags + filter */
.st-status-dot{display:inline-block;width:9px;height:9px;border-radius:50%;border:0;padding:0;flex:none;}
.st-status-dot.big{width:11px;height:11px;cursor:pointer;margin-left:auto;border:1px solid rgba(0,0,0,0.4);}
.st-nav-filter{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;}
.st-filter-chip{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:${P.dim};background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:3px 9px;text-transform:capitalize;cursor:pointer;}
.st-filter-chip.on{border-color:${P.cyan};color:#fff;}

/* review (lint) dialog */
.st-review{width:min(680px,94vw);}
.st-review-slide{border:1px solid var(--line);border-radius:10px;overflow:hidden;}
.st-review-head{display:flex;align-items:center;gap:8px;padding:8px 11px;background:rgba(255,255,255,0.03);cursor:pointer;font-size:12.5px;}
.st-review-head:hover{background:rgba(0,212,255,0.07);}
.st-review-score{margin-left:auto;font-family:ui-monospace,monospace;font-size:10.5px;color:${P.gold};}
.st-review-score.ok{color:${P.green};}
.st-review-issue{display:block;width:100%;text-align:left;background:transparent;border:0;border-top:1px solid var(--line2);color:${P.dim};font-size:11.5px;padding:6px 11px 6px 24px;cursor:pointer;line-height:1.45;}
.st-review-issue:hover{background:rgba(0,212,255,0.07);color:#fff;}

/* font picker */
.st-fontsel{position:relative;flex:1;min-width:0;}
.st-fontsel-btn{width:100%;text-align:left;font-size:13px;padding:6px 8px;border-radius:7px;border:1px solid var(--line);background:var(--in);color:#F4E0FF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.st-fontsel-btn:hover{border-color:${P.cyan};}
.st-fontsel-menu{position:absolute;top:105%;left:0;right:0;z-index:45;background:#22093b;border:1px solid var(--line);border-radius:10px;box-shadow:0 20px 50px rgba(0,0,0,.55);max-height:340px;overflow-y:auto;padding:6px;}
.st-fontsel-search{margin-bottom:4px;font-size:12px;}
.st-fontsel-group{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${P.cyan};margin:8px 4px 3px;font-weight:600;}
.st-fontsel-item{display:block;width:100%;text-align:left;background:transparent;border:0;color:#F4E0FF;border-radius:6px;padding:5px 8px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.st-fontsel-item:hover{background:rgba(0,212,255,0.08);}
.st-fontsel-item.on{color:${P.cyan};}
.st-fontsel-note{font-size:11px;color:${P.muted};padding:4px 8px;line-height:1.5;}

/* help dialog */
.st-help{width:min(720px,94vw);}
.st-help-sec{border:1px solid var(--line2);border-radius:10px;padding:10px 12px;background:var(--panel);}
.st-help-sec>b{font-size:13px;}
.st-help-sec p{margin:5px 0 0;font-size:12.5px;color:${P.dim};line-height:1.6;}
.st-help-sec code{font-family:ui-monospace,monospace;font-size:11.5px;background:rgba(0,0,0,0.3);border-radius:4px;padding:1px 5px;}
.st-kbd{display:inline-block;font-family:ui-monospace,monospace;font-size:10.5px;line-height:1.5;color:#fff;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:0 6px;background:rgba(0,0,0,0.35);white-space:nowrap;}

/* generate interactive pages dialog */
.st-gen-backdrop{position:fixed;inset:0;z-index:950;background:rgba(10,2,20,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;}
.st-imgdlg{width:min(680px,94vw);}
.st-imgtabs{display:flex;gap:6px;border-bottom:1px solid var(--line);padding-bottom:8px;}
.st-imgtab{background:none;border:1px solid transparent;border-radius:8px;color:rgba(244,224,255,0.75);padding:6px 12px;font:inherit;font-size:13px;cursor:pointer;}
.st-imgtab:hover{background:rgba(244,224,255,0.07);color:#fff;}
.st-imgtab.on{background:rgba(153,10,227,0.22);border-color:rgba(153,10,227,0.5);color:#fff;}
.st-dropzone{display:flex;flex-direction:column;align-items:center;gap:6px;border:1.5px dashed rgba(244,224,255,0.3);border-radius:12px;padding:34px 16px;cursor:pointer;text-align:center;transition:border-color .15s,background .15s;}
.st-dropzone:hover{border-color:rgba(153,10,227,0.7);background:rgba(153,10,227,0.08);}
.st-dropzone-icon{font-size:34px;}
.st-dropzone span{color:rgba(244,224,255,0.55);font-size:12.5px;}
.st-imgrow{display:flex;gap:8px;align-items:center;}
.st-imginput,.st-imgprompt,.st-imgselect{flex:1;background:rgba(20,5,40,0.6);border:1px solid var(--line);border-radius:8px;color:inherit;font:inherit;font-size:13.5px;padding:8px 10px;}
.st-imgprompt{resize:vertical;width:100%;}
.st-imgselect{flex:none;width:auto;margin-left:4px;}
.st-ovgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-height:320px;overflow-y:auto;}
.st-ovitem{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;padding:0;background:rgba(20,5,40,0.5);cursor:pointer;aspect-ratio:4/3;}
.st-ovitem img{width:100%;height:100%;object-fit:cover;display:block;}
.st-ovitem span{position:absolute;left:4px;bottom:4px;background:rgba(10,2,20,0.75);border-radius:4px;padding:1px 5px;font-size:9.5px;letter-spacing:.5px;color:rgba(244,224,255,0.85);}
.st-ovitem:hover{border-color:rgba(153,10,227,0.8);}
.st-genprev{width:100%;max-height:320px;object-fit:contain;border-radius:10px;border:1px solid var(--line);background:rgba(20,5,40,0.5);}
.st-imgbusy{color:#00D4FF;}
.st-imgerr{color:#ff7a7a;}
.st-gen{width:min(600px,92vw);max-height:86vh;overflow-y:auto;background:#22093b;border:1px solid var(--line);border-radius:14px;padding:16px 18px 18px;box-shadow:0 24px 70px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:10px;}
.st-gen-head{display:flex;align-items:center;justify-content:space-between;font-size:15px;}
.st-gen-sub{margin:0;font-size:12.5px;color:${P.dim};line-height:1.5;}
.st-gen-opt{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-radius:9px;border:1px solid var(--line);background:rgba(153,10,227,0.06);font-size:13px;line-height:1.4;cursor:pointer;}
.st-gen-opt:hover{border-color:rgba(153,10,227,0.6);}
.st-gen-opt.on{border-color:${P.purple};background:rgba(153,10,227,0.16);}
.st-gen-opt input{accent-color:${P.purple};width:15px;height:15px;margin-top:2px;flex:none;}
.st-gen-actions{display:flex;gap:8px;flex-wrap:wrap;}
.st-gen-log{font-family:ui-monospace,monospace;font-size:11.5px;color:${P.dim};background:rgba(0,0,0,0.3);border-radius:8px;padding:8px 10px;max-height:140px;overflow-y:auto;}

/* site copy (copy.js) editor overlay */
.st-copyed{position:fixed;inset:0;z-index:900;display:flex;flex-direction:column;background:#29003E;}
.st-copyed-head{flex:none;height:52px;display:flex;align-items:center;gap:12px;padding:0 14px;background:rgba(20,5,40,0.97);border-bottom:1px solid var(--line);}
.st-copyed-name{flex:1;min-width:0;font-size:12px;color:${P.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.st-copyed-scroll{flex:1;min-height:0;overflow-y:auto;}

/* touch: dragging an element must not scroll the page */
.st-hit,.st-handle{touch-action:none;}

/* phones & small tablets: single-column stage, panels as slide-in drawers */
.st-fab{display:none;}
@media (max-width: 900px){
  .st-toolbar{height:auto;min-height:52px;flex-wrap:wrap;row-gap:6px;padding:6px 10px;}
  .st-tb-left,.st-tb-center,.st-tb-right{flex-wrap:wrap;row-gap:6px;}
  .st-title{min-width:80px;}
  .st-body{grid-template-columns:1fr;}
  .st-split{display:none;}
  .st-nav,.st-inspector{position:fixed;top:0;bottom:0;z-index:120;background:var(--bg);width:min(85vw,320px);transition:transform .22s ease;box-shadow:0 0 40px rgba(0,0,0,.5);}
  .st-nav{left:0;border-right:1px solid var(--line);transform:translateX(-105%);}
  .st-inspector{right:0;border-left:1px solid var(--line);transform:translateX(105%);}
  .st-body.nav-open .st-nav{transform:none;}
  .st-body.insp-open .st-inspector{transform:none;}
  .st-drawer-backdrop{position:fixed;inset:0;z-index:110;background:rgba(0,0,0,0.45);}
  .st-fab{display:inline-flex;position:fixed;bottom:14px;z-index:130;align-items:center;gap:6px;padding:9px 14px;border-radius:999px;border:1px solid var(--line);background:#22093b;color:inherit;font:inherit;font-size:12.5px;box-shadow:0 8px 24px rgba(0,0,0,.45);}
  .st-fab.left{left:12px;}
  .st-fab.right{right:12px;}
  .st-fab.zoom{left:50%;right:auto;transform:translateX(-50%);padding:2px 4px;gap:0;}
  .st-fab.zoom button{background:transparent;border:0;color:inherit;font:inherit;padding:6px 8px;cursor:pointer;}
  .st-fab.zoom .st-zoom-val{min-width:44px;}
  .st-stagewrap{padding:10px;}
  .st-stagebar{display:none;}
}

/* present */
.st-present{position:fixed;inset:0;z-index:1000;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.st-present-bar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:rgba(20,5,40,0.8);backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:999px;padding:6px 10px;cursor:default;}
.st-present-count{font-family:ui-monospace,monospace;font-size:12px;color:${P.dim};min-width:54px;text-align:center;}
.st-present-dots{position:fixed;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:7px;cursor:default;}
.st-pdot{width:8px;height:8px;border-radius:50%;background:rgba(244,224,255,0.25);border:0;padding:0;}
.st-pdot.on{background:${P.cyan};box-shadow:0 0 10px ${P.cyan};}
`;
