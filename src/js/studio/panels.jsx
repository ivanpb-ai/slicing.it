// ─────────────────────────────────────────────────────────────────────────
// Editor chrome: reusable form controls, the slide Navigator (left), the
// context-sensitive Inspector (right) and the Toolbar (top). All styling comes
// from the .st-* classes injected in app.jsx.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { STAGE_W, STAGE_H, P, SWATCHES, GRADIENT_PRESETS, ELEMENT_TYPES, CHART_KINDS, ENTRANCES, IDLES, EASE_OPTIONS, TRANSITIONS, BACKGROUNDS, ALIGN, FONT_OPTIONS, SLIDE_STATUSES, STATUS_COLORS } from "./model";
import { SlideView } from "./stage";
import { measureOverflow, isBrandColor } from "./lint";

// Truncation warning: shown under the property editor whenever the selected
// element's text won't fit its box at true stage size.
function FitWarning({ el }) {
  const [fit, setFit] = useState(null);
  useEffect(() => { setFit(measureOverflow(el)); }, [el]);
  if (!fit || fit.fits) return null;
  return (
    <div className="st-fit-warn">
      ⚠ This text won't fit — it needs ≈{fit.neededH}px of height but the box is {fit.boxH}px.
      Shorten the copy, reduce the font size, or enlarge the box; clipped text is unreadable when presented.
    </div>
  );
}

/* ── control primitives ─────────────────────────────────────────────────── */
function Field({ label, children, wide }) {
  return <div className={"st-field" + (wide ? " wide" : "")}><span className="st-label">{label}</span>{children}</div>;
}
function Num({ value, onChange, onCheckpoint, step = 1, min, max }) {
  return <input className="st-in" type="number" step={step} min={min} max={max} value={value ?? 0} onFocus={onCheckpoint}
    onChange={(e) => { if (e.target.value === "") return; const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); }} />;
}
function TextLine({ value, onChange, onCheckpoint, placeholder }) {
  return <input className="st-in" type="text" value={value ?? ""} placeholder={placeholder} onFocus={onCheckpoint} onChange={(e) => onChange(e.target.value)} />;
}
function Area({ value, onChange, onCheckpoint, rows = 3 }) {
  return <textarea className="st-area" rows={rows} value={value ?? ""} onFocus={onCheckpoint} onChange={(e) => onChange(e.target.value)} />;
}
function Select({ value, onChange, onCheckpoint, options }) {
  return (
    <select className="st-sel" value={value} onChange={(e) => { onCheckpoint && onCheckpoint(); onChange(e.target.value); }}>
      {options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; return <option key={v} value={v}>{l}</option>; })}
    </select>
  );
}
function Seg({ value, onChange, onCheckpoint, options }) {
  return (
    <div className="st-seg">
      {options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; return <button key={v} className={value === v ? "on" : ""} onClick={() => { onCheckpoint && onCheckpoint(); onChange(v); }}>{l}</button>; })}
    </div>
  );
}
function Toggle({ value, onChange, onCheckpoint }) {
  return <button className={"st-toggle" + (value ? " on" : "")} onClick={() => { onCheckpoint && onCheckpoint(); onChange(!value); }}>{value ? "On" : "Off"}</button>;
}
function Swatches({ value, onChange, onCheckpoint, allowNone }) {
  // Brand-token guard: a free hex value that isn't (a tint of) the Telia
  // palette gets flagged inline — the ✓ Review panel lists all of them.
  const offBrand = typeof value === "string" && !isBrandColor(value);
  return (
    <div className="st-swatches">
      {allowNone && <button className={"st-sw none" + (value == null ? " on" : "")} title="None" onClick={() => { onCheckpoint && onCheckpoint(); onChange(null); }} />}
      {SWATCHES.map((s) => <button key={s.name} title={s.name} className={"st-sw" + (value === s.value ? " on" : "")} style={{ background: s.value }} onClick={() => { onCheckpoint && onCheckpoint(); onChange(s.value); }} />)}
      <input className={"st-hex" + (offBrand ? " offbrand" : "")} type="text" value={typeof value === "string" ? value : ""} placeholder="#hex"
        title={offBrand ? "Off-brand colour — not in the Telia palette" : undefined}
        onFocus={onCheckpoint} onChange={(e) => onChange(e.target.value)} />
      {offBrand && <span className="st-offbrand-flag" title="Off-brand colour — not in the Telia palette">⚠</span>}
    </div>
  );
}
function StringList({ items, onChange, onCheckpoint }) {
  const arr = items || [];
  const set = (i, v) => { const n = [...arr]; n[i] = v; onChange(n); };
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; onCheckpoint(); const n = [...arr]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="st-arr">
      {arr.map((it, i) => (
        <div className="st-arr-row" key={i}>
          <input className="st-in" value={it} onFocus={onCheckpoint} onChange={(e) => set(i, e.target.value)} />
          <button className="st-icon" onClick={() => move(i, -1)} title="Up">↑</button>
          <button className="st-icon" onClick={() => move(i, 1)} title="Down">↓</button>
          <button className="st-icon" onClick={() => { onCheckpoint(); onChange(arr.filter((_, j) => j !== i)); }} title="Remove">✕</button>
        </div>
      ))}
      <button className="st-btn sm" onClick={() => { onCheckpoint(); onChange([...arr, "New item"]); }}>+ Add</button>
    </div>
  );
}

/* ── Inspector ──────────────────────────────────────────────────────────── */
export function Inspector({ element, slide, onChangeElement, onChangeSlide, onCheckpoint, onLayer, onDuplicate, onDelete }) {
  if (!element) return <SlideInspector slide={slide} onChangeSlide={onChangeSlide} onCheckpoint={onCheckpoint} />;
  const el = element;
  const cp = onCheckpoint;
  const setEl = (patch) => onChangeElement(el.id, patch, false);
  const setProp = (k, v) => setEl({ props: { ...el.props, [k]: v } });
  const setProps = (patch) => setEl({ props: { ...el.props, ...patch } }); // atomic multi-key update
  const setStyle = (k, v) => setEl({ style: { ...el.style, [k]: v } });
  const setAnim = (k, v) => setEl({ anim: { ...el.anim, [k]: v } });
  const s = el.style, p = el.props;

  return (
    <div className="st-inspector">
      <div className="st-insp-head">
        <span className="st-insp-type">{el.type}</span>
        <div className="st-insp-actions">
          <button className="st-icon" title="Bring to front" onClick={() => onLayer(el.id, "front")}>⤒</button>
          <button className="st-icon" title="Send to back" onClick={() => onLayer(el.id, "back")}>⤓</button>
          <button className="st-icon" title="Duplicate" onClick={() => onDuplicate(el.id)}>⧉</button>
          <button className="st-icon danger" title="Delete" onClick={() => onDelete(el.id)}>✕</button>
        </div>
      </div>

      <Content type={el.type} {...{ p, s, setProp, setProps, setStyle, cp }} />
      <FitWarning el={el} />

      <Group title="Motion">
        <Field label="Entrance"><Select value={el.anim.in} onCheckpoint={cp} onChange={(v) => setAnim("in", v)} options={ENTRANCES} /></Field>
        <div className="st-grid2">
          <Field label="Delay (s)"><Num value={el.anim.delay} step={0.05} min={0} onCheckpoint={cp} onChange={(v) => setAnim("delay", v)} /></Field>
          <Field label="Duration (s)"><Num value={el.anim.duration} step={0.05} min={0.05} onCheckpoint={cp} onChange={(v) => setAnim("duration", v)} /></Field>
        </div>
        <div className="st-grid2">
          <Field label="Easing"><Select value={el.anim.ease} onCheckpoint={cp} onChange={(v) => setAnim("ease", v)} options={EASE_OPTIONS} /></Field>
          <Field label="Idle loop"><Select value={el.anim.idle} onCheckpoint={cp} onChange={(v) => setAnim("idle", v)} options={IDLES} /></Field>
        </div>
      </Group>

      <Group title="Layout">
        <div className="st-grid2">
          <Field label="X"><Num value={el.x} onCheckpoint={cp} onChange={(v) => setEl({ x: v })} /></Field>
          <Field label="Y"><Num value={el.y} onCheckpoint={cp} onChange={(v) => setEl({ y: v })} /></Field>
          <Field label="Width"><Num value={el.w} min={20} onCheckpoint={cp} onChange={(v) => setEl({ w: v })} /></Field>
          <Field label="Height"><Num value={el.h} min={20} onCheckpoint={cp} onChange={(v) => setEl({ h: v })} /></Field>
          <Field label="Rotation°"><Num value={el.rotation} onCheckpoint={cp} onChange={(v) => setEl({ rotation: v })} /></Field>
          <Field label="Opacity"><Num value={s.opacity ?? 1} step={0.05} min={0} max={1} onCheckpoint={cp} onChange={(v) => setStyle("opacity", v)} /></Field>
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }) {
  return <div className="st-group"><div className="st-group-hd">{title}</div>{children}</div>;
}

/* Per-type property editors. */
function Content({ type, p, s, setProp, setProps, setStyle, cp }) {
  const colorField = (label, key, allowNone) => <Field label={label}><Swatches value={s[key]} allowNone={allowNone} onCheckpoint={cp} onChange={(v) => setStyle(key, v)} /></Field>;

  if (type === "heading" || type === "text") {
    return (
      <Group title="Text">
        <Field label="Content" wide><Area value={p.text} rows={3} onCheckpoint={cp} onChange={(v) => setProp("text", v)} /></Field>
        <div className="st-grid2">
          <Field label="Size"><Num value={s.fontSize} onCheckpoint={cp} onChange={(v) => setStyle("fontSize", v)} /></Field>
          <Field label="Weight"><Select value={String(s.fontWeight)} onCheckpoint={cp} onChange={(v) => setStyle("fontWeight", Number(v))} options={["300", "400", "500", "700"]} /></Field>
          <Field label="Line height"><Num value={s.lineHeight} step={0.05} onCheckpoint={cp} onChange={(v) => setStyle("lineHeight", v)} /></Field>
          <Field label="Letter sp."><Num value={s.letterSpacing} step={0.5} onCheckpoint={cp} onChange={(v) => setStyle("letterSpacing", v)} /></Field>
        </div>
        <Field label="Align"><Seg value={s.align} onCheckpoint={cp} onChange={(v) => setStyle("align", v)} options={ALIGN} /></Field>
        <Field label="Font"><Select value={s.fontFamily} onCheckpoint={cp} onChange={(v) => setStyle("fontFamily", v)} options={FONT_OPTIONS} /></Field>
        {colorField("Colour", "color")}
        {type === "heading" && <GradientCtl p={p} setProp={setProp} cp={cp} />}
      </Group>
    );
  }
  if (type === "kicker") {
    return (
      <Group title="Kicker">
        <Field label="Text" wide><TextLine value={p.text} onCheckpoint={cp} onChange={(v) => setProp("text", v)} /></Field>
        <div className="st-grid2">
          <Field label="Size"><Num value={s.fontSize} onCheckpoint={cp} onChange={(v) => setStyle("fontSize", v)} /></Field>
          <Field label="Letter sp."><Num value={s.letterSpacing} step={0.5} onCheckpoint={cp} onChange={(v) => setStyle("letterSpacing", v)} /></Field>
        </div>
        <Field label="Align"><Seg value={s.align} onCheckpoint={cp} onChange={(v) => setStyle("align", v)} options={ALIGN} /></Field>
        {colorField("Colour", "color")}
      </Group>
    );
  }
  if (type === "counter") {
    return (
      <Group title="Counter">
        <div className="st-grid2">
          <Field label="Value"><Num value={p.value} step={0.1} onCheckpoint={cp} onChange={(v) => setProp("value", v)} /></Field>
          <Field label="Decimals"><Num value={p.decimals} min={0} max={4} onCheckpoint={cp} onChange={(v) => setProp("decimals", v)} /></Field>
          <Field label="Prefix"><TextLine value={p.prefix} onCheckpoint={cp} onChange={(v) => setProp("prefix", v)} /></Field>
          <Field label="Suffix"><TextLine value={p.suffix} onCheckpoint={cp} onChange={(v) => setProp("suffix", v)} /></Field>
        </div>
        <Field label="Label" wide><TextLine value={p.label} onCheckpoint={cp} onChange={(v) => setProp("label", v)} /></Field>
        <div className="st-grid2"><Field label="Size"><Num value={s.fontSize} onCheckpoint={cp} onChange={(v) => setStyle("fontSize", v)} /></Field>{colorField("Colour", "color")}</div>
      </Group>
    );
  }
  if (type === "button") {
    return (
      <Group title="Button">
        <Field label="Label" wide><TextLine value={p.label} onCheckpoint={cp} onChange={(v) => setProp("label", v)} /></Field>
        <Field label="Link (href)" wide><TextLine value={p.href} onCheckpoint={cp} onChange={(v) => setProp("href", v)} /></Field>
        <Field label="Style"><Seg value={p.variant} onCheckpoint={cp} onChange={(v) => setProp("variant", v)} options={[{ value: "primary", label: "Solid" }, { value: "ghost", label: "Ghost" }]} /></Field>
        {colorField("Fill", "bg", true)}
        {colorField("Text", "color")}
      </Group>
    );
  }
  if (type === "list") {
    return (
      <Group title="List">
        <Field label="Items" wide><StringList items={p.items} onCheckpoint={cp} onChange={(v) => setProp("items", v)} /></Field>
        <div className="st-grid2">
          <Field label="Size"><Num value={s.fontSize} onCheckpoint={cp} onChange={(v) => setStyle("fontSize", v)} /></Field>
          <Field label="Gap"><Num value={s.gap} onCheckpoint={cp} onChange={(v) => setStyle("gap", v)} /></Field>
        </div>
        <Field label="Marker"><TextLine value={s.marker} onCheckpoint={cp} onChange={(v) => setStyle("marker", v)} /></Field>
        {colorField("Accent", "accent")}
      </Group>
    );
  }
  if (type === "card") {
    return (
      <Group title="Card">
        <div className="st-grid2">
          <Field label="Icon"><TextLine value={p.icon} onCheckpoint={cp} onChange={(v) => setProp("icon", v)} /></Field>
          <Field label="Tag"><TextLine value={p.tag} onCheckpoint={cp} onChange={(v) => setProp("tag", v)} /></Field>
        </div>
        <Field label="Title" wide><TextLine value={p.title} onCheckpoint={cp} onChange={(v) => setProp("title", v)} /></Field>
        <Field label="Body" wide><Area value={p.body} rows={3} onCheckpoint={cp} onChange={(v) => setProp("body", v)} /></Field>
        <Field label="Bullets" wide><StringList items={p.bullets} onCheckpoint={cp} onChange={(v) => setProp("bullets", v)} /></Field>
        {colorField("Accent", "accent")}
      </Group>
    );
  }
  if (type === "icon") {
    return (
      <Group title="Icon">
        <Field label="Emoji / glyph" wide><TextLine value={p.glyph} onCheckpoint={cp} onChange={(v) => setProp("glyph", v)} /></Field>
        <Field label="Size"><Num value={s.fontSize} onCheckpoint={cp} onChange={(v) => setStyle("fontSize", v)} /></Field>
      </Group>
    );
  }
  if (type === "image") {
    return (
      <Group title="Image">
        <Field label="Image URL" wide><TextLine value={p.src} placeholder="https://…" onCheckpoint={cp} onChange={(v) => setProp("src", v)} /></Field>
        <Field label="Alt text" wide><TextLine value={p.alt} onCheckpoint={cp} onChange={(v) => setProp("alt", v)} /></Field>
        <Field label="Fit"><Seg value={p.fit} onCheckpoint={cp} onChange={(v) => setProp("fit", v)} options={["cover", "contain"]} /></Field>
        <div className="st-grid2">
          <Field label="Radius"><Num value={s.borderRadius} onCheckpoint={cp} onChange={(v) => setStyle("borderRadius", v)} /></Field>
          <Field label="Border w."><Num value={s.borderWidth} min={0} onCheckpoint={cp} onChange={(v) => setStyle("borderWidth", v)} /></Field>
        </div>
        {colorField("Border", "borderColor", true)}
      </Group>
    );
  }
  if (type === "shape") {
    return (
      <Group title="Shape">
        <Field label="Kind"><Select value={p.shape} onCheckpoint={cp} onChange={(v) => setProp("shape", v)} options={["rect", "pill", "ellipse", "line", "triangle"]} /></Field>
        {colorField("Fill", "bg")}
        <GradientCtl p={s} setProp={setStyle} cp={cp} label="Gradient fill" />
        <div className="st-grid2">
          <Field label="Radius"><Num value={s.borderRadius} onCheckpoint={cp} onChange={(v) => setStyle("borderRadius", v)} /></Field>
          <Field label="Glow"><Toggle value={s.glow} onCheckpoint={cp} onChange={(v) => setStyle("glow", v)} /></Field>
        </div>
      </Group>
    );
  }
  if (type === "quote") {
    return (
      <Group title="Quote">
        <Field label="Quote" wide><Area value={p.text} rows={3} onCheckpoint={cp} onChange={(v) => setProp("text", v)} /></Field>
        <Field label="Attribution" wide><TextLine value={p.author} onCheckpoint={cp} onChange={(v) => setProp("author", v)} /></Field>
        <div className="st-grid2"><Field label="Size"><Num value={s.fontSize} onCheckpoint={cp} onChange={(v) => setStyle("fontSize", v)} /></Field><Field label="Align"><Seg value={s.align} onCheckpoint={cp} onChange={(v) => setStyle("align", v)} options={ALIGN} /></Field></div>
        {colorField("Colour", "color")}
        {colorField("Accent", "accent")}
      </Group>
    );
  }
  if (type === "ring") {
    return (
      <Group title="Progress ring">
        <div className="st-grid2">
          <Field label="Value %"><Num value={p.value} min={0} max={100} onCheckpoint={cp} onChange={(v) => setProp("value", v)} /></Field>
          <Field label="Suffix"><TextLine value={p.suffix} onCheckpoint={cp} onChange={(v) => setProp("suffix", v)} /></Field>
        </div>
        <Field label="Label" wide><TextLine value={p.label} onCheckpoint={cp} onChange={(v) => setProp("label", v)} /></Field>
        {colorField("Accent", "accent")}
        {colorField("Track", "track")}
      </Group>
    );
  }
  if (type === "chart") return <ChartEditor p={p} s={s} setProp={setProp} setProps={setProps} setStyle={setStyle} cp={cp} />;
  if (type === "radar") return <RadarEditor p={p} s={s} setProp={setProp} setStyle={setStyle} cp={cp} colorField={colorField} />;
  if (type === "orbit") {
    return (
      <Group title="Orbit">
        <div className="st-grid2"><Field label="Rings"><Num value={p.rings} min={1} max={5} onCheckpoint={cp} onChange={(v) => setProp("rings", v)} /></Field><Field label="Label"><TextLine value={p.label} onCheckpoint={cp} onChange={(v) => setProp("label", v)} /></Field></div>
        {colorField("Planet", "planet")}
        {colorField("Accent", "accent")}
      </Group>
    );
  }
  if (type === "loop") return <LoopEditor p={p} setProp={setProp} cp={cp} />;
  return null;
}

function GradientCtl({ p, setProp, cp, label = "Gradient" }) {
  const grad = p.gradient;
  return (
    <Field label={label} wide>
      <div className="st-grad">
        <Toggle value={!!grad} onCheckpoint={cp} onChange={(on) => setProp("gradient", on ? (GRADIENT_PRESETS[0]) : null)} />
        {grad && (
          <>
            <div className="st-grad-presets">
              {GRADIENT_PRESETS.map((g, i) => (
                <button key={i} className="st-grad-preset" title="Preset" style={{ background: `linear-gradient(120deg, ${g.join(", ")})` }} onClick={() => { cp(); setProp("gradient", [...g]); }} />
              ))}
            </div>
            <div className="st-grad-stops">
              {grad.map((c, i) => (
                <Swatches key={i} value={c} onCheckpoint={cp} onChange={(v) => { const n = [...grad]; n[i] = v; setProp("gradient", n); }} />
              ))}
              <div className="st-arr-row">
                {grad.length < 5 && <button className="st-btn sm" onClick={() => { cp(); setProp("gradient", [...grad, P.cyan]); }}>+ Stop</button>}
                {grad.length > 2 && <button className="st-btn sm" onClick={() => { cp(); setProp("gradient", grad.slice(0, -1)); }}>– Stop</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </Field>
  );
}

// Chart data lives in an editable mini-table: X labels across the top, one
// row per series (colour dot cycles the brand palette), numbers in the cells.
// Every edit redraws the chart — no chart is ever "drawn" by hand.
function ChartEditor({ p, s, setProp, setProps, setStyle, cp }) {
  const setSeries = (i, patch) => { const n = p.series.map((s, j) => (j === i ? { ...s, ...patch } : s)); setProp("series", n); };
  const setCell = (i, j, v) => setSeries(i, { values: p.xLabels.map((_, k) => (k === j ? v : p.series[i].values[k] ?? 0)) });
  const nextColor = (c) => { const i = SWATCHES.findIndex((s) => s.value === c); return SWATCHES[(i + 1) % SWATCHES.length].value; };
  const addColumn = () => { cp(); setProps({ xLabels: [...p.xLabels, `Cat ${p.xLabels.length + 1}`], series: p.series.map((s) => ({ ...s, values: [...p.xLabels.map((_, k) => s.values[k] ?? 0), 0] })) }); };
  const delColumn = (j) => { cp(); setProps({ xLabels: p.xLabels.filter((_, k) => k !== j), series: p.series.map((s) => ({ ...s, values: p.xLabels.map((_, k) => s.values[k] ?? 0).filter((_, k) => k !== j) })) }); };
  const hint = {
    combo: "The last series draws as the line; the others as columns.",
    pie: "Slices come from the first series' values, one per X label.",
    doughnut: "Slices come from the first series' values, one per X label.",
    waterfall: "Values are per-step changes (negatives dip); a Total bar is added automatically.",
    bubble: "Bubble size follows the value.",
  }[p.kind];
  return (
    <Group title="Chart">
      <div className="st-grid2">
        <Field label="Kind"><Select value={p.kind} onCheckpoint={cp} onChange={(v) => setProp("kind", v)} options={CHART_KINDS.map((k) => k.kind)} /></Field>
        <Field label="Axis max"><Num value={p.axisMax} onCheckpoint={cp} onChange={(v) => setProp("axisMax", v)} /></Field>
      </div>
      {hint && <div className="st-muted" style={{ fontSize: 11.5, margin: "2px 0 8px", lineHeight: 1.4 }}>{hint}</div>}
      <Field label="Legend text"><Swatches value={s.legend} onCheckpoint={cp} onChange={(v) => setStyle("legend", v)} /></Field>
      <Field label="Axis labels"><Swatches value={s.axis} onCheckpoint={cp} onChange={(v) => setStyle("axis", v)} /></Field>
      <Field label="Grid lines"><Swatches value={s.grid} onCheckpoint={cp} onChange={(v) => setStyle("grid", v)} /></Field>
      <div className="st-chart-table-wrap">
        <table className="st-chart-table">
          <thead>
            <tr>
              <th></th>
              {p.xLabels.map((l, j) => (
                <th key={j}>
                  <input value={l} onFocus={cp} onChange={(e) => setProp("xLabels", p.xLabels.map((x, k) => (k === j ? e.target.value : x)))} />
                  {p.xLabels.length > 1 && <button className="st-cell-del" title="Remove column" onClick={() => delColumn(j)}>✕</button>}
                </th>
              ))}
              <th><button className="st-icon" title="Add column" onClick={addColumn}>＋</button></th>
            </tr>
          </thead>
          <tbody>
            {p.series.map((sr, i) => (
              <tr key={i}>
                <td>
                  <div className="st-series-cell">
                    <button className="st-series-dot" style={{ background: sr.color }} title="Series colour — click to cycle the brand palette"
                      onClick={() => { cp(); setSeries(i, { color: nextColor(sr.color) }); }} />
                    <input value={sr.label} onFocus={cp} onChange={(e) => setSeries(i, { label: e.target.value })} />
                  </div>
                </td>
                {p.xLabels.map((_, j) => (
                  <td key={j}>
                    <input type="number" step="any" value={sr.values[j] ?? 0} onFocus={cp}
                      onChange={(e) => { if (e.target.value === "") return; const n = Number(e.target.value); if (!Number.isNaN(n)) setCell(i, j, n); }} />
                  </td>
                ))}
                <td>{p.series.length > 1 && <button className="st-icon danger" title="Remove series" onClick={() => { cp(); setProp("series", p.series.filter((_, k) => k !== i)); }}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="st-btn sm" onClick={() => { cp(); setProp("series", [...p.series, { label: `Series ${p.series.length + 1}`, color: SWATCHES[(p.series.length + 3) % SWATCHES.length].value, values: p.xLabels.map(() => 0) }]); }}>+ Series</button>
    </Group>
  );
}

function RadarEditor({ p, setProp, cp }) {
  const setT = (i, patch) => setProp("targets", p.targets.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <Group title="Radar">
      <Field label="Centre label" wide><TextLine value={p.label} onCheckpoint={cp} onChange={(v) => setProp("label", v)} /></Field>
      {p.targets.map((t, i) => (
        <div className="st-subcard" key={i}>
          <div className="st-arr-row">
            <input className="st-in" value={t.label} onFocus={cp} onChange={(e) => setT(i, { label: e.target.value })} />
            <button className="st-icon danger" onClick={() => { cp(); setProp("targets", p.targets.filter((_, j) => j !== i)); }}>✕</button>
          </div>
          <div className="st-grid2">
            <Field label="X %"><Num value={t.x} min={0} max={100} onCheckpoint={cp} onChange={(v) => setT(i, { x: v })} /></Field>
            <Field label="Y %"><Num value={t.y} min={0} max={100} onCheckpoint={cp} onChange={(v) => setT(i, { y: v })} /></Field>
          </div>
          <Swatches value={t.color} onCheckpoint={cp} onChange={(v) => setT(i, { color: v })} />
        </div>
      ))}
      <button className="st-btn sm" onClick={() => { cp(); setProp("targets", [...p.targets, { x: 50, y: 50, label: "Target", color: P.cyan }]); }}>+ Target</button>
    </Group>
  );
}

function LoopEditor({ p, setProp, cp }) {
  const setS = (i, patch) => setProp("stages", p.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <Group title="AI loop">
      <div className="st-grid2"><Field label="Centre title"><TextLine value={p.title} onCheckpoint={cp} onChange={(v) => setProp("title", v)} /></Field><Field label="Subtitle"><TextLine value={p.sub} onCheckpoint={cp} onChange={(v) => setProp("sub", v)} /></Field></div>
      {p.stages.map((st, i) => (
        <div className="st-subcard" key={i}>
          <div className="st-arr-row">
            <input className="st-in" value={st.label} onFocus={cp} onChange={(e) => setS(i, { label: e.target.value })} />
            <button className="st-icon danger" onClick={() => { cp(); setProp("stages", p.stages.filter((_, j) => j !== i)); }}>✕</button>
          </div>
          <Swatches value={st.color} onCheckpoint={cp} onChange={(v) => setS(i, { color: v })} />
        </div>
      ))}
      {p.stages.length < 8 && <button className="st-btn sm" onClick={() => { cp(); setProp("stages", [...p.stages, { label: "STAGE", color: P.cyan }]); }}>+ Stage</button>}
    </Group>
  );
}

// Sensible colour seeds per background type — used when the current colours
// don't suit the type being switched to (e.g. a slide imported from the
// Slide Converter carries a solid white; a white-based nebula just looks
// washed out, which reads as "the animated backgrounds are broken").
const BG_SEED_COLORS = {
  nebula: [P.purple, P.deep], aurora: [P.purple, P.magenta, P.cyan], starfield: [P.cyan, P.light],
  grid: [P.cyan], mesh: [P.purple, P.magenta, P.cyan], gradient: [P.purple, P.deep],
};
const isNearWhite = (c) => {
  if (typeof c !== "string") return true;
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) > 216;
};

function SlideInspector({ slide, onChangeSlide, onCheckpoint }) {
  const cp = onCheckpoint;
  const setBg = (patch) => onChangeSlide({ background: { ...slide.background, ...patch } }, false);
  const colors = slide.background.colors || [];
  const setColor = (i, v) => { const n = [...colors]; n[i] = v; setBg({ colors: n }); };
  const setType = (v) => {
    const seed = BG_SEED_COLORS[v];
    if (!seed) { setBg({ type: v }); return; } // solid keeps whatever is there
    // A near-white base means the colours came from a solid/imported slide —
    // reseed entirely; otherwise keep the user's colours and pad missing slots.
    const next = isNearWhite(colors[0]) ? seed : seed.map((d, i) => colors[i] || d);
    setBg({ type: v, colors: next });
  };
  const slots = slide.background.type === "solid" || slide.background.type === "gradient" ? 2 : (slide.background.type === "nebula" || slide.background.type === "starfield" || slide.background.type === "grid") ? 1 : 3;
  return (
    <div className="st-inspector">
      <div className="st-insp-head"><span className="st-insp-type">Slide</span></div>
      <Group title="Slide">
        <Field label="Name" wide><TextLine value={slide.name} onCheckpoint={cp} onChange={(v) => onChangeSlide({ name: v }, false)} /></Field>
        <Field label="Transition in"><Select value={slide.transition} onCheckpoint={cp} onChange={(v) => onChangeSlide({ transition: v }, false)} options={TRANSITIONS} /></Field>
        <Field label="Status"><Seg value={slide.status || "draft"} onCheckpoint={cp} onChange={(v) => onChangeSlide({ status: v }, true)} options={SLIDE_STATUSES} /></Field>
      </Group>
      <Group title="Background">
        <Field label="Type"><Select value={slide.background.type} onCheckpoint={cp} onChange={setType} options={BACKGROUNDS} /></Field>
        {Array.from({ length: slots }).map((_, i) => (
          <Field key={i} label={i === 0 ? "Colour" : `Colour ${i + 1}`}><Swatches value={colors[i]} onCheckpoint={cp} onChange={(v) => setColor(i, v)} /></Field>
        ))}
      </Group>
      <div className="st-hint">Click an element to edit it. Drag on the canvas to move, drag a corner to resize, double-click text to edit inline.</div>
    </div>
  );
}

/* ── Navigator ──────────────────────────────────────────────────────────── */
function Thumb({ slide }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.16);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / STAGE_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="st-thumb">
      <div style={{ position: "absolute", top: 0, left: 0, width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
        <SlideView slide={slide} mode="thumb" />
      </div>
    </div>
  );
}

export function Navigator({ slides, current, onSelect, onAdd, onDuplicate, onDelete, onMove, onStatus }) {
  // Review-cycle filter: show all slides or only those at one status.
  const [filter, setFilter] = useState("all");
  const cycle = (s) => SLIDE_STATUSES[(SLIDE_STATUSES.indexOf(s || "draft") + 1) % SLIDE_STATUSES.length];
  const shown = slides.filter((s) => filter === "all" || (s.status || "draft") === filter).length;
  return (
    <div className="st-nav">
      <div className="st-nav-hd"><span>Slides</span><button className="st-btn sm primary" onClick={onAdd}>+ Slide</button></div>
      <div className="st-nav-filter">
        {["all", ...SLIDE_STATUSES].map((f) => (
          <button key={f} className={"st-filter-chip" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>
            {f !== "all" && <span className="st-status-dot" style={{ background: STATUS_COLORS[f] }} />}{f}
          </button>
        ))}
      </div>
      {shown === 0 && <div className="st-hint">No “{filter}” slides.</div>}
      <div className="st-nav-list">
        {slides.map((s, i) => {
          if (filter !== "all" && (s.status || "draft") !== filter) return null;
          return (
            <div key={s.id} className={"st-slide" + (i === current ? " on" : "")} onClick={() => onSelect(i)}>
              <div className="st-slide-top">
                <span className="st-slide-no">{i + 1}</span><span className="st-slide-name">{s.name}</span>
                <button className="st-status-dot big" style={{ background: STATUS_COLORS[s.status || "draft"] }}
                  title={`Status: ${s.status || "draft"} — click to cycle`}
                  onClick={(e) => { e.stopPropagation(); onStatus(i, cycle(s.status)); }} />
              </div>
              <Thumb slide={s} />
              <div className="st-slide-ctrls" onClick={(e) => e.stopPropagation()}>
                <button className="st-icon" title="Move up" onClick={() => onMove(i, -1)}>↑</button>
                <button className="st-icon" title="Move down" onClick={() => onMove(i, 1)}>↓</button>
                <button className="st-icon" title="Duplicate" onClick={() => onDuplicate(i)}>⧉</button>
                <button className="st-icon danger" title="Delete" onClick={() => onDelete(i)}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Toolbar ────────────────────────────────────────────────────────────── */
function Dropdown({ btnClass = "st-btn", label, wrapClass, menuClass, render }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <div className={wrapClass} ref={ref}>
      <button className={btnClass} onClick={() => setOpen((v) => !v)}>{label}</button>
      {open && <div className={menuClass}>{render(() => setOpen(false))}</div>}
    </div>
  );
}

function relTime(ts) {
  if (!ts) return "";
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Two-level insert menu: "Chart" opens a picker with the PowerPoint chart
// family (column, bar, line, area, combo, pie, doughnut, radar, bubble,
// waterfall) — each inserts a chart element seeded via chartDefaults().
function InsertMenu({ onInsert, close }) {
  const [chartsOpen, setChartsOpen] = useState(false);
  if (chartsOpen) {
    return (
      <>
        <button className="st-insert-item st-insert-back" onClick={() => setChartsOpen(false)}>
          <span className="st-insert-ic">←</span>All elements
        </button>
        {CHART_KINDS.map((k) => (
          <button key={k.kind} className="st-insert-item" onClick={() => { onInsert("chart", k.kind); close(); }}>
            <span className="st-insert-ic">{k.icon}</span>{k.label}
          </button>
        ))}
      </>
    );
  }
  return ELEMENT_TYPES.map((t) => (
    <button key={t.type} className="st-insert-item"
      onClick={() => { if (t.type === "chart") { setChartsOpen(true); return; } onInsert(t.type); close(); }}>
      <span className="st-insert-ic">{t.icon}</span>{t.label}{t.type === "chart" ? " ▸" : ""}
    </button>
  ));
}

export function Toolbar({ title, onTitle, onCheckpoint, onInsert, onUndo, onRedo, canUndo, canRedo, onPresent, library, currentId, onOpenDeck, onNewDeck, onDuplicateDeck, onDeleteDeck, onImport, onExport, onExportHtml, onExportPptx, onGeneratePages, onSiteCopy, onReview, saved }) {
  return (
    <div className="st-toolbar">
      <div className="st-tb-left">
        <span className="st-brand">◆ Studio</span>
        <Dropdown wrapClass="st-decks" menuClass="st-decks-menu" label="▤ Decks ▾" render={(close) => (
          <>
            <div className="st-decks-list">
              {(!library || !library.length) && <div className="st-deckdate" style={{ padding: "8px 10px" }}>No saved presentations yet.</div>}
              {library && library.map((it) => (
                <div key={it.id} className={"st-deckrow" + (it.id === currentId ? " on" : "")}>
                  <button className="st-deckopen" onClick={() => { onOpenDeck(it.id); close(); }}>
                    <span className="st-deckname">{it.title || "Untitled"}</span>
                    <span className="st-deckdate">{it.id === currentId ? "editing now" : `edited ${relTime(it.updatedAt)}`}</span>
                  </button>
                  <button className="st-icon danger st-deck-del" title="Delete presentation" onClick={() => onDeleteDeck(it.id)}>✕</button>
                </div>
              ))}
            </div>
            <div className="st-decks-foot">
              <button className="st-btn sm" onClick={() => { onNewDeck(); close(); }}>+ New</button>
              <button className="st-btn sm" onClick={() => { onDuplicateDeck(); close(); }}>Duplicate</button>
              <button className="st-btn sm" title="Import a Studio .json — or .html slides generated by the Slide Converter" onClick={() => { onImport(); close(); }}>Import…</button>
            </div>
            <button className="st-sitecopy" onClick={() => { onSiteCopy(); close(); }}
              title="Edit the live NorthStar deck's text & colours, then export copy.js to commit">
              <span className="st-deckname">🌐 NorthStar site copy</span>
              <span className="st-deckdate">the live deck (copy.js) — edit & export</span>
            </button>
          </>
        )} />
        <input className="st-title" value={title} onFocus={onCheckpoint} onChange={(e) => onTitle(e.target.value)} title="Rename this presentation" />
      </div>
      <div className="st-tb-center">
        <Dropdown wrapClass="st-insert" menuClass="st-insert-menu" btnClass="st-btn primary" label="✚ Insert ▾" render={(close) => (
          <InsertMenu onInsert={onInsert} close={close} />
        )} />
        <button className="st-btn" disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)">↶</button>
        <button className="st-btn" disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Shift+Z)">↷</button>
      </div>
      <div className="st-tb-right">
        <span className={"st-saved" + (saved ? " on" : "")}>{saved ? "Saved ✓" : "Saving…"}</span>
        <button className="st-btn" onClick={onReview} title="Lint every slide: text fit, projector-size fonts, contrast, density, alt text, off-brand colours">✓ Review</button>
        <Dropdown wrapClass="st-export" menuClass="st-export-menu" label="Export ▾" render={(close) => (
          <>
            <button className="st-export-item" onClick={() => { onExportHtml(); close(); }}>
              <b>HTML presentation</b>
              <span>Complete interactive page — share or host it anywhere</span>
            </button>
            <button className="st-export-item" onClick={() => { onExportPptx(); close(); }}>
              <b>PowerPoint (.pptx)</b>
              <span>Native slides — built with the Slide Converter's HTML→PPT engine</span>
            </button>
            <button className="st-export-item" onClick={() => { onGeneratePages(); close(); }}>
              <b>Interactive pages (click-to-explain)</b>
              <span>One page per slide with API-enriched explanations — the Slide Converter's Generate step</span>
            </button>
            <button className="st-export-item" onClick={() => { onExport(); close(); }}>
              <b>Studio JSON</b>
              <span>Editable file — import it back into the Studio</span>
            </button>
          </>
        )} />
        <button className="st-btn primary" onClick={onPresent}>▶ Present</button>
      </div>
    </div>
  );
}
