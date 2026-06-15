// ─────────────────────────────────────────────────────────────────────────
// The stage. SlideView is the read-only render of a slide (reused by the
// editor, the navigator thumbnails and present mode). SlideStage wraps it with
// the editing layer: a hit-box per element for select / drag, corner handles
// for resize, centre snap-guides and inline text editing.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { STAGE_W, STAGE_H, P, FONTS } from "./model";
import { Background } from "./backgrounds";
import Block from "./blocks";

// Which prop a double-click edits inline, per element type.
const PRIMARY = { heading: "text", text: "text", kicker: "text", quote: "text", button: "label", card: "title", counter: "label" };
export const isInlineEditable = (t) => t in PRIMARY;

export function SlideView({ slide, mode = "edit", active = true }) {
  return (
    <>
      <Background bg={slide.background} mode={mode === "thumb" ? "thumb" : "live"} />
      {slide.elements.map((el) => <Block key={el.id} element={el} mode={mode} active={active} />)}
    </>
  );
}

// Text styles roughly mirroring the matching block, so inline editing looks WYSIWYG.
function editorTextStyle(el) {
  const s = el.style; const center = { display: "flex", alignItems: "center" };
  const jc = s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center";
  if (el.type === "heading") return { ...center, justifyContent: jc, textAlign: s.align, fontFamily: s.fontFamily || FONTS.head, fontWeight: s.fontWeight, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, color: s.color };
  if (el.type === "kicker") return { ...center, justifyContent: jc, textAlign: s.align, fontFamily: FONTS.mono, fontSize: s.fontSize, letterSpacing: s.letterSpacing, textTransform: "uppercase", color: s.color };
  if (el.type === "quote") return { display: "flex", flexDirection: "column", justifyContent: "center", textAlign: s.align, fontFamily: FONTS.head, fontWeight: 300, fontSize: s.fontSize, lineHeight: 1.25, color: s.color };
  if (el.type === "button") return { display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.body, fontWeight: 500, fontSize: s.fontSize, color: s.color || P.white };
  if (el.type === "card") return { fontFamily: FONTS.head, fontWeight: 300, fontSize: 30, color: s.color || P.white, padding: "22px 20px", display: "flex", alignItems: "flex-start" };
  if (el.type === "counter") return { display: "flex", alignItems: "flex-end", justifyContent: "center", textAlign: "center", fontSize: Math.max(12, s.fontSize * 0.2), color: P.muted, paddingBottom: 8 };
  return { ...center, justifyContent: jc, textAlign: s.align, fontFamily: s.fontFamily || FONTS.body, fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color };
}

function InlineEditor({ el, onCommit, onCancel }) {
  const ref = useRef(null);
  const field = PRIMARY[el.type];
  useEffect(() => {
    const node = ref.current; if (!node) return;
    node.textContent = el.props[field] || "";
    node.focus();
    const r = document.createRange(); r.selectNodeContents(node);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }, []); // eslint-disable-line
  const commit = () => onCommit(el.id, { props: { ...el.props, [field]: ref.current.textContent } });
  return (
    <div
      ref={ref} contentEditable suppressContentEditableWarning
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ref.current.blur(); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      style={{
        position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, boxSizing: "border-box",
        outline: `2px solid ${P.cyan}`, background: "rgba(0,0,0,0.32)", borderRadius: 6, cursor: "text", zIndex: 60,
        overflow: "hidden", ...editorTextStyle(el),
      }}
    />
  );
}

const HANDLES = [
  { id: "nw", cx: 0, cy: 0, cur: "nwse-resize" },
  { id: "ne", cx: 1, cy: 0, cur: "nesw-resize" },
  { id: "sw", cx: 0, cy: 1, cur: "nesw-resize" },
  { id: "se", cx: 1, cy: 1, cur: "nwse-resize" },
];

export function SlideStage({ slide, selectedId, onSelect, onChange, onCheckpoint, editingId, onStartEdit, onEndEdit }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.6);
  const scaleRef = useRef(0.6);
  const [guides, setGuides] = useState({ v: false, h: false });

  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const s = wrap.clientWidth / STAGE_W;
      scaleRef.current = s; setScale(s);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const startDrag = (e, el) => {
    if (editingId) return;
    e.stopPropagation();
    onSelect(el.id);
    onCheckpoint();
    const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y;
    const move = (ev) => {
      const s = scaleRef.current;
      let nx = ox + (ev.clientX - sx) / s;
      let ny = oy + (ev.clientY - sy) / s;
      const cx = nx + el.w / 2, cy = ny + el.h / 2;
      const T = 8;
      let v = false, h = false;
      if (Math.abs(cx - STAGE_W / 2) < T) { nx = STAGE_W / 2 - el.w / 2; v = true; }
      if (Math.abs(cy - STAGE_H / 2) < T) { ny = STAGE_H / 2 - el.h / 2; h = true; }
      setGuides({ v, h });
      onChange(el.id, { x: Math.round(nx), y: Math.round(ny) }, false);
    };
    const up = () => { setGuides({ v: false, h: false }); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const startResize = (e, el, handle) => {
    e.stopPropagation();
    onSelect(el.id); onCheckpoint();
    const sx = e.clientX, sy = e.clientY; const o = { x: el.x, y: el.y, w: el.w, h: el.h };
    const move = (ev) => {
      const s = scaleRef.current; const dx = (ev.clientX - sx) / s, dy = (ev.clientY - sy) / s;
      let { x, y, w, h } = o;
      if (handle.cx === 1) w = Math.max(24, o.w + dx); else { w = Math.max(24, o.w - dx); x = o.x + (o.w - w); }
      if (handle.cy === 1) h = Math.max(24, o.h + dy); else { h = Math.max(24, o.h - dy); y = o.y + (o.h - h); }
      onChange(el.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, false);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const hs = 11 / scale; // constant on-screen handle size
  const ow = 1.5 / scale; // constant outline width
  const editingEl = editingId ? slide.elements.find((e) => e.id === editingId) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", aspectRatio: `${STAGE_W}/${STAGE_H}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", background: P.deep }}>
      <div
        style={{ position: "absolute", top: 0, left: 0, width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        onPointerDown={() => { if (!editingId) onSelect(null); }}
      >
        <SlideView slide={slide} mode="edit" />

        {/* snap guides */}
        {guides.v && <div style={{ position: "absolute", left: STAGE_W / 2, top: 0, width: 1 / scale, height: STAGE_H, background: P.cyan, opacity: 0.8 }} />}
        {guides.h && <div style={{ position: "absolute", top: STAGE_H / 2, left: 0, height: 1 / scale, width: STAGE_W, background: P.cyan, opacity: 0.8 }} />}

        {/* interaction hit-boxes */}
        {slide.elements.map((el) => {
          const sel = el.id === selectedId;
          if (editingId === el.id) return null;
          return (
            <div
              key={el.id}
              className={"st-hit" + (sel ? " sel" : "")} data-type={el.type}
              onPointerDown={(e) => startDrag(e, el)}
              onClick={(e) => { e.stopPropagation(); onSelect(el.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); if (isInlineEditable(el.type)) onStartEdit(el.id); }}
              style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, cursor: "move", outline: sel ? `${ow}px solid ${P.cyan}` : (`${ow}px solid transparent`), outlineOffset: 0, background: "transparent", zIndex: sel ? 40 : 10 }}
              title={isInlineEditable(el.type) ? "Double-click to edit text" : el.type}
            >
              {sel && HANDLES.map((hd) => (
                <div key={hd.id} className="st-handle" onPointerDown={(e) => startResize(e, el, hd)}
                  style={{ position: "absolute", left: `calc(${hd.cx * 100}% - ${hs / 2}px)`, top: `calc(${hd.cy * 100}% - ${hs / 2}px)`, width: hs, height: hs, background: P.white, border: `${1 / scale}px solid ${P.cyan}`, borderRadius: 2 / scale, cursor: hd.cur }} />
              ))}
            </div>
          );
        })}

        {editingEl && <InlineEditor el={editingEl} onCommit={(id, patch) => { onChange(id, patch, true); onEndEdit(); }} onCancel={onEndEdit} />}
      </div>
    </div>
  );
}
