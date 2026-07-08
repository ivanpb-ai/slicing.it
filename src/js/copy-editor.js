// Visual editor for the presentation copy. Loads the live COPY object, groups it
// by presentation section, and lets you edit every string/number/colour and
// add · duplicate · delete · reorder the repeating blocks inside a section
// (vertical cards, the waves, timeline entries, CTAs, roadmap items, …).
// It cannot write to the repo (static site) — you export an updated copy.js and commit it.

import { COPY } from "./copy";
import { P } from "./palette";
import { serializeCopy, isColorValue } from "./copy-serialize";
import { loadDeckById, loadManifest, saveDeckToLib, downloadDeck, uid } from "./studio/model";

// ── Studio hand-off ────────────────────────────────────────────────────────
// The Presentation Studio's "Copy editor" button links here with ?deck=<id>.
// When that presentation exists in the shared localStorage library, we edit it
// instead of the live NorthStar COPY, and "Save to Studio" writes it straight
// back so the Studio picks the changes up.
const requestedDeckId = new URLSearchParams(location.search).get("deck");
let studioDeck = requestedDeckId ? loadDeckById(requestedDeckId) : null;
if (requestedDeckId && !studioDeck) {
  // Stale link (deck deleted / renamed id) — fall back to the last-edited deck.
  const currentId = loadManifest().currentId;
  studioDeck = currentId ? loadDeckById(currentId) : null;
}
const studioMode = !!studioDeck;

// Working copy. At runtime COPY's colours are resolved hex/rgba strings; the
// serialiser maps them back to P.<name> on export. A Studio deck arrives as a
// fresh validated object from localStorage, so it's already a working copy.
const data = studioMode ? studioDeck : JSON.parse(JSON.stringify(COPY));
const clone = (v) => JSON.parse(JSON.stringify(v));

const paletteNames = Object.keys(P);

// ── Section metadata (order + friendly titles match the deck) ──────────────
const DECK = [
  ["hero", "Hero"],
  ["inflection", "The Inflection Point"],
  ["waves", "Three Waves"],
  ["innovation", "NorthStar Innovation Network"],
  ["demo", "AstaZero Latency Demo"],
  ["core", "Inside the Core"],
  ["slicing", "Live Slicing"],
  ["ainative", "AI-Native Networks"],
  ["ambient", "Ambient / ISAC"],
  ["positioning", "Positioning"],
  ["ntn", "Non-Terrestrial Networks"],
  ["verticals", "Verticals in 2035"],
  ["economy", "The Business Model Shift"],
  ["vision", "Vision / CTA"],
];
const META = { ui: "Shared UI & chrome", navLabels: "Nav-dot tooltips", roadmap: "Roadmap page (standalone)", sixg: "3GPP releases page (standalone)" };

// Friendlier field labels (everything else is auto-prettified from the key).
const LABELS = {
  desc: "Description", suf: "Suffix", pre: "Prefix", dec: "Decimals",
  brainSub: "Brain subtitle", gnbLabel: "gNB label", youAreHere: "“You are here” label",
  roadmapTapHint: "Tap hint", roadmapMilestones: "Milestones label", scrollHint: "Scroll hint",
  backLink: "Back link", href: "Link (href)", primary: "Primary button", anim: "Animated",
  b: "Bold", c: "Colour", t: "Text", v: "Value", l: "Label", acc: "Accuracy",
  rel: "Release", axisMax: "Axis max", sub: "Subtitle",
};

// Structural identifiers used by rendering logic — kept in the data, hidden from
// the UI. Studio decks also carry geometry & animation, which belong to the
// Studio canvas, not a copy editor.
const SKIP_KEYS = studioMode
  ? new Set(["id", "type", "x", "y", "w", "h", "rotation", "anim", "variant"])
  : new Set(["id"]);

function pretty(key) {
  if (LABELS[key]) return LABELS[key];
  const s = String(key).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Arrays of free-form text fragments + styled segments (rendered by <Rich>/<Heading>):
// editable inline, but their segment structure is not add/deleteable.
function isRichArray(arr) {
  const isSeg = (el) => el && typeof el === "object" && !Array.isArray(el);
  const hasString = arr.some((el) => typeof el === "string");
  const hasBrGrad = arr.some((el) => isSeg(el) && ("br" in el || "grad" in el));
  const hasTextSeg = arr.some((el) => isSeg(el) && "t" in el);
  return (hasString && (hasTextSeg || hasBrGrad)) || hasBrGrad;
}

// Arrays whose length is coupled to other data by index — editable, never add/delete.
const isIndexCoupled = (path) => path === "navLabels" || /(^|\.)chart(\.|$)/.test(path);

// ── Tiny DOM helper ────────────────────────────────────────────────────────
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
  return e;
}

const iconBtn = (glyph, title, onClick, disabled) =>
  h("button", { class: "icon-btn", title, type: "button", text: glyph, onclick: onClick, disabled: disabled ? "" : null });

// ── Field builders ─────────────────────────────────────────────────────────
function labelEl(label, path, badge) {
  return h("span", { class: "lab", title: path },
    h("span", { class: "lab-name", text: label }),
    badge ? h("span", { class: "lab-badge", text: badge }) : null,
    h("span", { class: "lab-path", text: path }),
  );
}

function labeledField(label, path, control, extra) {
  return h("label", { class: "field" + (extra ? " " + extra : "") }, labelEl(label, path), control);
}

function fieldText(obj, key, label, path) {
  const value = obj[key] ?? "";
  const long = String(value).length > 58 || String(value).includes("\n");
  const input = long ? h("textarea", { spellcheck: "false" }) : h("input", { type: "text" });
  if (long) input.rows = Math.min(8, Math.max(2, Math.ceil(String(value).length / 72)));
  input.value = value;
  input.addEventListener("input", () => { obj[key] = input.value; });
  return labeledField(label, path, input);
}

function fieldNumber(obj, key, label, path) {
  const input = h("input", { type: "number", step: "any" });
  input.value = obj[key];
  input.addEventListener("input", () => {
    if (input.value === "") return;
    const n = Number(input.value);
    if (!Number.isNaN(n)) obj[key] = n;
  });
  return labeledField(label, path, input, "num");
}

function fieldBool(obj, key, label, path) {
  const input = h("input", { type: "checkbox" });
  input.checked = !!obj[key];
  input.addEventListener("change", () => { obj[key] = input.checked; });
  return h("label", { class: "field bool" }, input,
    h("span", { class: "lab inline", title: path },
      h("span", { class: "lab-name", text: label }),
      h("span", { class: "lab-path", text: path }),
    ),
  );
}

function colorSelect(value, onChange) {
  const sel = h("select");
  for (const name of paletteNames) {
    const o = h("option", { value: P[name], text: name });
    if (P[name] === value) o.selected = true;
    sel.appendChild(o);
  }
  if (!paletteNames.some((n) => P[n] === value)) {
    const o = h("option", { value, text: "(custom) " + value });
    o.selected = true;
    sel.appendChild(o);
  }
  const sw = h("span", { class: "swatch" });
  sw.style.background = value;
  sel.addEventListener("change", () => { onChange(sel.value); sw.style.background = sel.value; });
  return h("div", { class: "color-row" }, sel, sw);
}

const fieldColor = (obj, key, label, path) =>
  labeledField(label, path, colorSelect(obj[key], (v) => { obj[key] = v; }));

// ── Recursive renderers ────────────────────────────────────────────────────
function renderValue(obj, key, container, label, path) {
  if (SKIP_KEYS.has(String(key))) return;
  const value = obj[key];

  if (Array.isArray(value)) {
    if (isRichArray(value)) container.appendChild(richField(obj, key, label, path));
    else renderCollection(obj, key, container, label, path);
    return;
  }
  if (value && typeof value === "object") {
    const wrap = h("div", { class: "subgroup" }, h("div", { class: "subhead", text: label }));
    renderObjectFields(value, wrap, path);
    if (wrap.children.length > 1) container.appendChild(wrap);
    return;
  }
  if (typeof value === "string")
    container.appendChild(isColorValue(value) ? fieldColor(obj, key, label, path) : fieldText(obj, key, label, path));
  else if (typeof value === "number") container.appendChild(fieldNumber(obj, key, label, path));
  else if (typeof value === "boolean") container.appendChild(fieldBool(obj, key, label, path));
}

function renderObjectFields(obj, container, basePath) {
  for (const key of Object.keys(obj)) {
    if (SKIP_KEYS.has(key)) continue;
    renderValue(obj, key, container, pretty(key), basePath ? basePath + "." + key : key);
  }
}

// Rich-text array: each fragment editable (text + styling), structure fixed.
function richField(obj, key, label, path) {
  const arr = obj[key];
  const box = h("div", { class: "rich-box" });
  arr.forEach((_, i) => box.appendChild(richRow(arr, i, path)));
  box.appendChild(h("div", { class: "rich-foot" },
    h("button", { class: "mini", type: "button", text: "+ Text", onclick: () => { arr.push(""); rerender(); } }),
  ));
  return h("div", { class: "field rich" }, labelEl(label, path, "rich text"), box);
}

function richRow(arr, i, path) {
  const seg = arr[i];
  const content = h("div", { class: "rich-content" });
  if (typeof seg === "string") {
    const long = seg.length > 44;
    const inp = long ? h("textarea", {}) : h("input", { type: "text" });
    if (long) inp.rows = 2;
    inp.value = seg;
    inp.classList.add("seg-plain");
    inp.addEventListener("input", () => { arr[i] = inp.value; });
    content.appendChild(inp);
  } else if (seg && typeof seg === "object" && "br" in seg && !("t" in seg)) {
    content.appendChild(h("div", { class: "seg-br", text: "↵ line break" }));
  } else if (seg && typeof seg === "object") {
    const segRow = h("div", { class: "seg" });
    if ("t" in seg) {
      const inp = h("input", { type: "text" });
      inp.value = seg.t;
      inp.classList.add("seg-text");
      inp.addEventListener("input", () => { seg.t = inp.value; });
      segRow.appendChild(inp);
    }
    const extras = h("div", { class: "seg-extras" });
    for (const k of Object.keys(seg)) {
      if (k === "t") continue;
      if (k === "grad" && Array.isArray(seg.grad)) { extras.appendChild(gradEditor(seg, path)); continue; }
      renderValue(seg, k, extras, pretty(k), `${path}.${k}`);
    }
    if (extras.children.length) segRow.appendChild(extras);
    content.appendChild(segRow);
  }
  const controls = h("div", { class: "rich-ctrls" },
    iconBtn("↑", "Move up", () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; rerender(); } }, i === 0),
    iconBtn("↓", "Move down", () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; rerender(); } }, i === arr.length - 1),
    iconBtn("↵", "Insert line break after", () => { arr.splice(i + 1, 0, { br: true }); rerender(); }),
    iconBtn("✕", "Delete", () => { arr.splice(i, 1); rerender(); }),
  );
  return h("div", { class: "rich-row" }, content, controls);
}

function gradEditor(seg, path) {
  const row = h("div", { class: "grad-row" });
  seg.grad.forEach((c, j) => row.appendChild(colorSelect(c, (v) => { seg.grad[j] = v; })));
  return h("div", { class: "field" }, labelEl("Gradient", path + ".grad"), row);
}

// Repeating-block collection: add · duplicate · delete · reorder.
const templates = new WeakMap();
function makeNew(arr) {
  if (arr.length) return clone(arr[arr.length - 1]);
  const t = templates.get(arr);
  if (t) return clone(t);
  return "";
}

function cardTitle(item, i) {
  const own = item.title || item.label || item.era || item.tag || item.rel || item.what || item.year || item.t || "";
  // Studio elements keep their copy under props.
  const fromProps = item.props ? item.props.text || item.props.title || item.props.label || "" : "";
  const pick = own || fromProps;
  const txt = typeof pick === "string" ? pick : "";
  const kind = studioMode && typeof item.type === "string" ? " · " + item.type : "";
  return `#${i + 1}${kind}` + (txt ? " · " + (txt.length > 46 ? txt.slice(0, 45) + "…" : txt) : "");
}

function renderCollection(obj, key, container, label, path) {
  const arr = obj[key];
  if (arr.length) templates.set(arr, clone(arr[0]));
  const allowEdit = !isIndexCoupled(path);

  const head = h("div", { class: "coll-head" },
    h("span", { class: "coll-title" },
      h("span", { class: "lab-name", text: label }),
      h("span", { class: "count", text: String(arr.length) }),
    ),
    allowEdit ? h("button", { class: "mini add", type: "button", text: "+ Add", onclick: () => { arr.push(makeNew(arr)); rerender(); } }) : null,
  );

  const list = h("div", { class: "coll-list" });
  arr.forEach((item, i) => {
    if (item && typeof item === "object" && !Array.isArray(item)) list.appendChild(objectCard(arr, i, path, allowEdit));
    else list.appendChild(scalarRow(arr, i, path, allowEdit));
  });

  container.appendChild(h("div", { class: "collection", "data-coupled": allowEdit ? null : "1" }, head, list));
}

function ctrls(arr, i) {
  return h("div", { class: "controls" },
    iconBtn("↑", "Move up", () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; rerender(); } }, i === 0),
    iconBtn("↓", "Move down", () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; rerender(); } }, i === arr.length - 1),
    iconBtn("⧉", "Duplicate", () => { arr.splice(i + 1, 0, clone(arr[i])); rerender(); }),
    iconBtn("✕", "Delete", () => { arr.splice(i, 1); rerender(); }),
  );
}

function objectCard(arr, i, path, allowEdit) {
  const body = h("div", { class: "card-body" });
  renderObjectFields(arr[i], body, `${path}[${i}]`);
  return h("div", { class: "item-card" },
    h("div", { class: "card-head" },
      h("span", { class: "card-title", text: cardTitle(arr[i], i) }),
      allowEdit ? ctrls(arr, i) : null,
    ),
    body,
  );
}

function scalarRow(arr, i, path, allowEdit) {
  const val = arr[i];
  const isColor = typeof val === "string" && isColorValue(val);
  let input;
  if (typeof val === "number") {
    input = h("input", { type: "number", step: "any" });
    input.value = val;
    input.addEventListener("input", () => { if (input.value !== "") { const n = Number(input.value); if (!Number.isNaN(n)) arr[i] = n; } });
  } else if (isColor) {
    input = colorSelect(val, (v) => { arr[i] = v; });
    input.style.flex = "1";
  } else {
    const long = String(val).length > 58;
    input = long ? h("textarea", {}) : h("input", { type: "text" });
    if (long) input.rows = 2;
    input.value = val;
    input.addEventListener("input", () => { arr[i] = input.value; });
  }
  if (!isColor) input.classList.add("grow");
  return h("div", { class: "scalar-row" }, input,
    allowEdit ? iconBtn("↑", "Move up", () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; rerender(); } }, i === 0) : null,
    allowEdit ? iconBtn("↓", "Move down", () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; rerender(); } }, i === arr.length - 1) : null,
    allowEdit ? iconBtn("✕", "Delete", () => { arr.splice(i, 1); rerender(); }) : null,
  );
}

// ── Build / rebuild the form ───────────────────────────────────────────────
const form = document.getElementById("form");
const openState = new Set();

function sectionShell(key, title, body) {
  if (!body.children.length) return;
  const det = h("details", { "data-key": key });
  det.appendChild(h("summary", {},
    h("span", { class: "sec-title", text: title }),
    h("span", { class: "sec-key", text: key }),
  ));
  det.appendChild(body);
  if (openState.has(key)) det.open = true;
  det.addEventListener("toggle", () => { if (det.open) openState.add(key); else openState.delete(key); });
  form.appendChild(det);
}

function addSection(key, title) {
  const body = h("div", { class: "group-body" });
  const value = data[key];
  if (value && typeof value === "object" && !Array.isArray(value)) renderObjectFields(value, body, key);
  else renderValue(data, key, body, title, key);
  sectionShell(key, title, body);
}

// Studio mode: one section for the deck itself, then one per slide, in order.
function addDeckSection() {
  const body = h("div", { class: "group-body" });
  renderValue(data, "title", body, "Presentation title", "title");
  renderValue(data, "theme", body, "Theme", "theme");
  sectionShell("deck", "Presentation", body);
}

function addSlideSection(slide, i) {
  const body = h("div", { class: "group-body" });
  renderObjectFields(slide, body, `slides[${i}]`);
  sectionShell(`slide-${slide.id}`, `${i} · ${slide.name || "Slide"}`, body);
}

function buildForm() {
  form.textContent = "";
  if (studioMode) {
    addDeckSection();
    data.slides.forEach(addSlideSection);
  } else {
    DECK.forEach(([key, title], idx) => { if (key in data) addSection(key, `${idx} · ${title}`); });
    for (const key of Object.keys(META)) if (key in data) addSection(key, META[key]);
    for (const key of Object.keys(data))
      if (!DECK.some(([k]) => k === key) && !(key in META)) addSection(key, pretty(key));
  }
  applyFilter();
}

function rerender() {
  const y = window.scrollY;
  buildForm();
  window.scrollTo(0, y);
  if (!out.hidden) regen();
}

// ── Output / toolbar ───────────────────────────────────────────────────────
const out = document.getElementById("out");
const output = document.getElementById("output");
const filter = document.getElementById("filter");

function regen() {
  output.value = studioMode ? JSON.stringify(data, null, 2) : serializeCopy(data);
  out.hidden = false;
}

// A cloned block keeps its source's id; give the Studio back unique ones so
// React keys (and future edits) don't collide.
function freshIds(deck) {
  const seen = new Set();
  const fix = (o, prefix) => { if (!o.id || seen.has(o.id)) o.id = uid(prefix); seen.add(o.id); };
  deck.slides.forEach((s) => { fix(s, "slide"); (s.elements || []).forEach((e) => fix(e, "el")); });
}

function saveToStudio() {
  freshIds(data);
  saveDeckToLib(data);
  if (!out.hidden) regen();
  toast("Saved to Studio ✓");
}

document.getElementById("generate").addEventListener("click", () => {
  if (studioMode) { saveToStudio(); return; }
  regen();
  out.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("copy").addEventListener("click", async () => {
  if (!output.value) regen();
  try {
    await navigator.clipboard.writeText(output.value);
    toast("Copied to clipboard");
  } catch {
    output.removeAttribute("readonly");
    output.select();
    document.execCommand("copy");
    output.setAttribute("readonly", "");
    toast("Copied");
  }
});

document.getElementById("download").addEventListener("click", () => {
  if (studioMode) {
    freshIds(data);
    downloadDeck(data);
    toast("Downloaded .studio.json");
    return;
  }
  if (!output.value) regen();
  const blob = new Blob([output.value], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: "copy.js" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Downloaded copy.js");
});

document.getElementById("expand").addEventListener("click", () =>
  form.querySelectorAll("details").forEach((d) => { d.open = true; openState.add(d.dataset.key); }));
document.getElementById("collapse").addEventListener("click", () => {
  form.querySelectorAll("details").forEach((d) => { d.open = false; });
  openState.clear();
});

function applyFilter() {
  const q = filter.value.trim().toLowerCase();
  form.querySelectorAll("details").forEach((det) => {
    const secMatch = !q || (det.querySelector(".sec-title")?.textContent || "").toLowerCase().includes(q);
    let any = secMatch;
    det.querySelectorAll(".field").forEach((f) => {
      const m = secMatch || (f.querySelector(".lab")?.textContent || "").toLowerCase().includes(q);
      f.classList.toggle("hidden", !m);
      if (m) any = true;
    });
    det.querySelectorAll(".item-card").forEach((c) => {
      const vis = secMatch || [...c.querySelectorAll(".field")].some((f) => !f.classList.contains("hidden"));
      c.classList.toggle("hidden", q && !vis);
    });
    det.style.display = q && !any ? "none" : "";
    if (q && any) det.open = true;
  });
}
filter.addEventListener("input", applyFilter);

let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1500);
}

// ── Page chrome per mode ───────────────────────────────────────────────────
const cyanLink = (href, text) => h("a", { href, style: "color:var(--cyan);", text });

if (studioMode) {
  document.title = `Copy Editor — ${data.title || "Studio presentation"}`;
  document.getElementById("generate").textContent = "Save to Studio ✓";
  document.getElementById("copy").textContent = "Copy JSON";
  document.getElementById("download").textContent = "Download .studio.json";

  const sub = document.querySelector(".sub");
  sub.textContent = "";
  sub.append(
    "Editing the Studio presentation “", h("strong", { text: data.title || "Untitled" }), "”. ",
    "Changes apply when you click Save to Studio. ",
    cyanLink("presentation-studio.html", "← Back to Studio"),
  );

  const deploy = document.querySelector(".deploy");
  deploy.textContent = "";
  deploy.append(
    h("h2", { text: "Saving your changes" }),
    h("ol", {},
      h("li", {}, "Edit the text, numbers & colours below. ", h("strong", { text: "Nothing here saves on its own." })),
      h("li", {}, "Click ", h("strong", { text: "Save to Studio" }), " — the presentation updates in the Studio's library on this browser."),
      h("li", {}, "Back in the ", cyanLink("presentation-studio.html", "Presentation Studio"), ", present it or export it (HTML / .studio.json) as usual."),
    ),
  );

  const note = out.querySelector(".note");
  note.textContent = "The presentation as Studio JSON — “Save to Studio” already persists it; use Download to keep a backup or share it.";
}

document.getElementById("intro").textContent = studioMode
  ? "One section per slide, in deck order. Edit any text, number or colour; " +
    "use + Add / ⧉ / ✕ / ↑ ↓ to add, duplicate, delete or reorder repeating blocks (list items, bullets, chart series…). " +
    "Layout, animation and slide structure stay in the Studio. Click “Save to Studio” when you're done."
  : "Grouped by presentation section, in deck order. Edit any text, number or colour; " +
    "use + Add / ⧉ / ✕ / ↑ ↓ to add, duplicate, delete or reorder the repeating blocks in a section. " +
    "Nothing saves automatically — click “Generate copy.js”, then copy or download the result and commit it." +
    (requestedDeckId ? " (Couldn't find the requested Studio presentation in this browser, so you're editing the live NorthStar deck copy instead.)" : "");

buildForm();
