// ─────────────────────────────────────────────────────────────────────────
// StudioApp — the editor shell. Owns the presentation, selection, undo/redo
// history and autosave; wires the Navigator, Stage and Inspector together;
// and hosts the fullscreen Present overlay. All chrome styling is the STUDIO_CSS
// sheet injected below (KEYFRAMES drives every animation in effects.js).
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STAGE_W, STAGE_H, P, cloneDeep, uid, createElement, createSlide, createPresentation, starterDeck, loadManifest, listDecks, loadDeckById, saveDeckToLib, deleteDeckFromLib, setCurrentDeckId, duplicateDeckObj, validateDeck, downloadDeck } from "./model";
import { KEYFRAMES } from "./effects";
import { downloadDeckHtml } from "./export-html";
import { SlideStage, SlideView } from "./stage";
import { Navigator, Inspector, Toolbar } from "./panels";
import { mountCopyEditor } from "../copy-editor-core";
import { COPY } from "../copy";

const cloneSlide = (s) => ({ ...cloneDeep(s), id: uid("slide"), elements: s.elements.map((e) => ({ ...cloneDeep(e), id: uid("el") })) });

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

// ── Copy editor overlay ────────────────────────────────────────────────────
// Hosts the mountable copy editor (copy-editor-core.js) over the Studio.
// source "deck" edits the presentation open in the Studio; "site" edits the
// live NorthStar deck copy (copy.js) with the usual export-and-commit flow.
function CopyEditorHost({ source, deck, onApply }) {
  const ref = useRef(null);
  useEffect(() => {
    const inst = mountCopyEditor(ref.current, source === "deck"
      ? { mode: "deck", data: deck, onApply }
      : { mode: "copy", data: COPY });
    return () => inst.destroy();
    // Mount once per source (the host is keyed on it); `deck` is the snapshot
    // being edited — applying must not remount and wipe in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="st-copyed-scroll" ref={ref} />;
}

function CopyEditorOverlay({ source, onSource, deck, onApply, onClose }) {
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
        <span className="st-brand">✎ Copy editor</span>
        <div className="st-seg st-copyed-seg">
          <button className={source === "deck" ? "on" : ""} onClick={() => onSource("deck")} title="Edit the presentation open in the Studio">
            This presentation
          </button>
          <button className={source === "site" ? "on" : ""} onClick={() => onSource("site")} title="Edit the live NorthStar deck copy (copy.js)">
            Live NorthStar deck
          </button>
        </div>
        <span className="st-copyed-name">{source === "deck" ? deck.title || "Untitled" : "copy.js — export & commit"}</span>
        <button className="st-btn" onClick={onClose}>✕ Close</button>
      </div>
      <CopyEditorHost key={source} source={source} deck={deck} onApply={onApply} />
    </div>
  );
}

// Pick the deck to open on launch: last-edited, else first in the library, else
// seed the starter deck (and persist it so it joins the library).
function initialDeck() {
  const m = loadManifest();
  for (const id of [m.currentId, m.items[0]?.id].filter(Boolean)) {
    const d = loadDeckById(id);
    if (d) return d;
  }
  const starter = starterDeck();
  saveDeckToLib(starter);
  return starter;
}

// ── main editor ─────────────────────────────────────────────────────────────
export default function StudioApp() {
  const [deck, setDeck] = useState(initialDeck);
  const [library, setLibrary] = useState(() => listDecks());
  const [current, setCurrent] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [presenting, setPresenting] = useState(false);
  const [startAt, setStartAt] = useState(0);
  // Copy editor overlay: null (closed) | "deck" | "site". copy-editor.html
  // redirects here with #copy, which opens straight onto the live-site editor.
  const [copyEd, setCopyEd] = useState(() => (window.location.hash === "#copy" ? "site" : null));
  const [saved, setSaved] = useState(true);
  const [undo, setUndo] = useState([]);
  const [redo, setRedo] = useState([]);
  const fileRef = useRef(null);
  const saveTimer = useRef(0);
  const deckRef = useRef(deck);
  deckRef.current = deck;

  const slide = deck.slides[Math.min(current, deck.slides.length - 1)];
  const selected = useMemo(() => slide.elements.find((e) => e.id === selectedId) || null, [slide, selectedId]);

  // autosave (debounced)
  useEffect(() => {
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveDeckToLib(deckRef.current); setLibrary(listDecks()); setSaved(true); }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [deck]);

  const checkpoint = useCallback(() => {
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

  const insertElement = (type) => {
    checkpoint();
    const el = createElement(type);
    patchSlide(current, (s) => ({ ...s, elements: [...s.elements, el] }));
    setSelectedId(el.id);
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
  const persistCurrent = () => saveDeckToLib(deckRef.current);
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
    const m = deleteDeckFromLib(id);
    if (id === deck.id) {
      const next = m.currentId ? loadDeckById(m.currentId) : null;
      if (next) switchTo(next);
      else { const blank = createPresentation({ title: "Untitled presentation 1" }); saveDeckToLib(blank); switchTo(blank); }
    } else setLibrary(listDecks());
  };
  const importDeck = () => fileRef.current?.click();
  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = validateDeck(JSON.parse(reader.result));
        if (!parsed) throw new Error("bad");
        persistCurrent();
        const imported = { ...parsed, id: uid("deck") }; // distinct library entry
        saveDeckToLib(imported); switchTo(imported);
      } catch { window.alert("That file isn't a valid Studio presentation (.json)."); }
    };
    reader.readAsText(f);
    e.target.value = "";
  };
  const exportDeck = () => downloadDeck(deck);
  const exportHtml = () => downloadDeckHtml(deck);

  // copy editor overlay ------------------------------------------------------
  const closeCopyEd = useCallback(() => {
    setCopyEd(null);
    if (window.location.hash === "#copy") history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  // The editor hands back an edited clone; validate it, keep the deck's
  // identity, and go through checkpoint/setDeck so undo and autosave work.
  const applyCopyEdits = useCallback((edited) => {
    const valid = validateDeck(edited);
    if (!valid) return false;
    checkpoint();
    setDeck({ ...valid, id: deckRef.current.id });
    setSelectedId(null); setEditingId(null);
    return true;
  }, [checkpoint]);

  // keyboard shortcuts (editor only)
  useEffect(() => {
    const onKey = (e) => {
      if (presenting || copyEd) return;
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
  }, [presenting, copyEd, selectedId, slide, checkpoint, changeElement, doUndo, doRedo]);

  return (
    <div className="st-root">
      <style>{KEYFRAMES + STUDIO_CSS}</style>

      <Toolbar
        title={deck.title} onTitle={(v) => setDeck((d) => ({ ...d, title: v }))} onCheckpoint={checkpoint}
        onInsert={insertElement} onUndo={doUndo} onRedo={doRedo} canUndo={undo.length > 0} canRedo={redo.length > 0}
        onPresent={() => { setStartAt(current); setPresenting(true); }}
        library={library} currentId={deck.id} onOpenDeck={openDeck} onNewDeck={newPresentation} onDuplicateDeck={duplicateCurrentDeck} onDeleteDeck={deleteDeck}
        onImport={importDeck} onExport={exportDeck} onExportHtml={exportHtml} onCopyEditor={() => setCopyEd("deck")} saved={saved}
      />

      <div className="st-body">
        <Navigator slides={deck.slides} current={current} onSelect={(i) => { setCurrent(i); setSelectedId(null); setEditingId(null); }}
          onAdd={addSlide} onDuplicate={duplicateSlide} onDelete={deleteSlide} onMove={moveSlide} />

        <div className="st-stagecol">
          <div className="st-stagewrap">
            <SlideStage
              slide={slide} selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); if (id !== editingId) setEditingId(null); }}
              onChange={changeElement} onCheckpoint={checkpoint}
              editingId={editingId} onStartEdit={(id) => { setSelectedId(id); setEditingId(id); }} onEndEdit={() => setEditingId(null)}
            />
          </div>
          <div className="st-stagebar">
            <span><b>{slide.name}</b> · {slide.elements.length} element{slide.elements.length === 1 ? "" : "s"}</span>
            <span className="st-muted">Drag to move · corner to resize · double-click text to edit · arrows nudge</span>
          </div>
        </div>

        <Inspector element={selected} slide={slide} onChangeElement={changeElement} onChangeSlide={changeSlide}
          onCheckpoint={checkpoint} onLayer={layer} onDuplicate={duplicateElement} onDelete={deleteElement} />
      </div>

      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onFile} />
      {copyEd && <CopyEditorOverlay source={copyEd} onSource={setCopyEd} deck={deck} onApply={applyCopyEdits} onClose={closeCopyEd} />}
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
.st-brand{font-weight:700;letter-spacing:.5px;color:${P.cyan};}
.st-title{background:transparent;border:1px solid transparent;border-radius:7px;color:#fff;font:inherit;font-weight:600;font-size:14px;padding:5px 8px;min-width:180px;}
.st-title:hover{border-color:var(--line);}
.st-title:focus{outline:none;border-color:${P.cyan};background:var(--in);}
.st-saved{font-size:11px;color:${P.muted};min-width:54px;}
.st-saved.on{color:${P.green};}
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

/* export menu */
.st-export{position:relative;}
.st-export-menu{position:absolute;top:110%;right:0;z-index:20;width:280px;background:#22093b;border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;box-shadow:0 20px 50px rgba(0,0,0,.5);}
.st-export-item{display:flex;flex-direction:column;gap:3px;align-items:flex-start;text-align:left;background:var(--panel);border:1px solid var(--line);color:#F4E0FF;border-radius:8px;padding:9px 11px;}
.st-export-item:hover{border-color:${P.cyan};background:rgba(0,212,255,0.08);}
.st-export-item b{font-size:13px;}
.st-export-item span{font-size:11px;color:${P.muted};line-height:1.4;}

/* body */
.st-body{flex:1;display:grid;grid-template-columns:248px 1fr 332px;min-height:0;}
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
.st-stagewrap{flex:1;display:flex;align-items:center;justify-content:center;padding:26px;overflow:auto;min-height:0;}
.st-stagewrap>div{width:100%;max-width:1080px;}
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
.st-sel{appearance:none;cursor:pointer;}
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

/* copy editor overlay */
.st-copyed{position:fixed;inset:0;z-index:900;display:flex;flex-direction:column;background:#29003E;}
.st-copyed-head{flex:none;height:52px;display:flex;align-items:center;gap:12px;padding:0 14px;background:rgba(20,5,40,0.97);border-bottom:1px solid var(--line);}
.st-copyed-seg{flex:none;width:340px;}
.st-copyed-seg button{padding:7px 4px;}
.st-copyed-name{flex:1;min-width:0;font-size:12px;color:${P.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.st-copyed-scroll{flex:1;min-height:0;overflow-y:auto;}

/* present */
.st-present{position:fixed;inset:0;z-index:1000;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.st-present-bar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:rgba(20,5,40,0.8);backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:999px;padding:6px 10px;cursor:default;}
.st-present-count{font-family:ui-monospace,monospace;font-size:12px;color:${P.dim};min-width:54px;text-align:center;}
.st-present-dots{position:fixed;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:7px;cursor:default;}
.st-pdot{width:8px;height:8px;border-radius:50%;background:rgba(244,224,255,0.25);border:0;padding:0;}
.st-pdot.on{background:${P.cyan};box-shadow:0 0 10px ${P.cyan};}
`;
