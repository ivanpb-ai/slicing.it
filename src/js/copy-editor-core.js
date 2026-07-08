// ─────────────────────────────────────────────────────────────────────────
// Copy editor core — the form-based text & colour editor, packaged as a
// mountable component so the Presentation Studio can host it as an overlay.
//
//   mountCopyEditor(root, { mode, data, onApply }) → { destroy }
//
//   mode: "deck"  edit a Studio presentation (plain JSON deck). "Apply to
//                 presentation" hands a validated clone back via onApply.
//   mode: "copy"  edit the live NorthStar COPY object; exports an updated
//                 copy.js to copy/download and commit (the site is static).
//
// The editor always works on a deep clone of `data`; nothing mutates the
// caller's object until onApply.
// ─────────────────────────────────────────────────────────────────────────
import { P } from "./palette";
import { serializeCopy, isColorValue } from "./copy-serialize";
import { uid, cloneDeep, downloadDeck } from "./studio/model";

const paletteNames = Object.keys(P);

// ── Section metadata for the live COPY (order + titles match the deck) ─────
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

// A cloned block keeps its source's id; regenerate duplicates so the Studio's
// React keys (and future edits) don't collide.
function freshIds(deck) {
  const seen = new Set();
  const fix = (o, prefix) => { if (!o.id || seen.has(o.id)) o.id = uid(prefix); seen.add(o.id); };
  (deck.slides || []).forEach((s) => { fix(s, "slide"); (s.elements || []).forEach((e) => fix(e, "el")); });
}

// ── Mount ──────────────────────────────────────────────────────────────────
export function mountCopyEditor(root, opts = {}) {
  ensureStyles();
  const deckMode = opts.mode === "deck";
  const data = cloneDeep(opts.data);

  // Structural identifiers used by rendering logic — kept in the data, hidden
  // from the UI. Studio decks also carry geometry & animation, which belong to
  // the Studio canvas, not a copy editor.
  const SKIP_KEYS = deckMode
    ? new Set(["id", "type", "x", "y", "w", "h", "rotation", "anim", "variant"])
    : new Set(["id"]);

  // ── Field builders ───────────────────────────────────────────────────────
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

  // ── Recursive renderers ──────────────────────────────────────────────────
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
    if (arr.length) return cloneDeep(arr[arr.length - 1]);
    const t = templates.get(arr);
    if (t) return cloneDeep(t);
    return "";
  }

  function cardTitle(item, i) {
    const own = item.title || item.label || item.era || item.tag || item.rel || item.what || item.year || item.t || "";
    // Studio elements keep their copy under props.
    const fromProps = item.props ? item.props.text || item.props.title || item.props.label || "" : "";
    const pick = own || fromProps;
    const txt = typeof pick === "string" ? pick : "";
    const kind = deckMode && typeof item.type === "string" ? " · " + item.type : "";
    return `#${i + 1}${kind}` + (txt ? " · " + (txt.length > 46 ? txt.slice(0, 45) + "…" : txt) : "");
  }

  function renderCollection(obj, key, container, label, path) {
    const arr = obj[key];
    if (arr.length) templates.set(arr, cloneDeep(arr[0]));
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
      iconBtn("⧉", "Duplicate", () => { arr.splice(i + 1, 0, cloneDeep(arr[i])); rerender(); }),
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

  // ── Static chrome (toolbar · instructions · form · output · toast) ───────
  const filter = h("input", { type: "text", placeholder: "Filter fields…" });
  const btnExpand = h("button", { type: "button", text: "Expand all" });
  const btnCollapse = h("button", { type: "button", text: "Collapse all" });
  const btnPrimary = h("button", { type: "button", class: "primary", text: deckMode ? "Apply to presentation ✓" : "Generate copy.js ↓" });
  const btnCopy = deckMode ? null : h("button", { type: "button", text: "Copy" });
  const btnDownload = h("button", { type: "button", text: deckMode ? "Download .studio.json" : "Download copy.js" });

  const bar = h("div", { class: "ce-bar" },
    btnExpand, btnCollapse, btnPrimary, btnCopy, btnDownload,
    h("span", { class: "filter" }, filter),
  );

  const deploy = deckMode
    ? h("section", { class: "deploy" },
        h("h2", { text: "Applying your changes" }),
        h("ol", {},
          h("li", {}, "Edit the text, numbers & colours below. ", h("strong", { text: "Nothing here applies on its own." })),
          h("li", {}, "Click ", h("strong", { text: "Apply to presentation" }), " — the deck updates in the Studio right away (and autosaves to your library)."),
          h("li", {}, "Close this panel to keep designing, present, or export the deck as usual."),
        ),
      )
    : h("section", { class: "deploy" },
        h("h2", { text: "Deploying your changes" }),
        h("ol", {},
          h("li", {}, "Edit the text, numbers & colours below. ", h("strong", { text: "Nothing here saves on its own." })),
          h("li", {}, "Click ", h("strong", { text: "Generate copy.js" }), ", then ", h("strong", { text: "Copy" }), " or ", h("strong", { text: "Download copy.js" }), "."),
          h("li", {}, "Replace ", h("code", { text: "src/js/copy.js" }), " in the repository with the generated file."),
          h("li", {}, "Commit and push it — directly to ", h("code", { text: "main" }), ", or via a pull request that you merge into ", h("code", { text: "main" }), "."),
          h("li", {}, "Netlify rebuilds and redeploys automatically; the live deck updates within a minute or two. No manual build step needed."),
        ),
      );

  const intro = h("p", { class: "note" });
  intro.textContent = deckMode
    ? "One section per slide, in deck order. Edit any text, number or colour; " +
      "use + Add / ⧉ / ✕ / ↑ ↓ to add, duplicate, delete or reorder repeating blocks (list items, bullets, chart series…). " +
      "Layout, animation and slide structure stay on the Studio canvas. Click “Apply to presentation” when you're done."
    : "Grouped by presentation section, in deck order. Edit any text, number or colour; " +
      "use + Add / ⧉ / ✕ / ↑ ↓ to add, duplicate, delete or reorder the repeating blocks in a section. " +
      "Nothing saves automatically — click “Generate copy.js”, then copy or download the result and commit it.";

  const form = h("div", { class: "ce-form" });
  const output = h("textarea", { spellcheck: "false", readonly: "" });
  const out = h("div", { class: "out", hidden: "" },
    h("p", { class: "note" },
      "Copy this into ", h("code", { text: "src/js/copy.js" }), " (or download it), then commit & push — Netlify rebuilds and redeploys automatically."),
    output,
  );
  const toastEl = h("div", { class: "toast" });

  root.classList.add("ce-root");
  root.append(bar, h("div", { class: "ce-main" }, deploy, intro, form, deckMode ? null : out, toastEl));

  // ── Build / rebuild the form ─────────────────────────────────────────────
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

  // Deck mode: one section for the presentation itself, then one per slide.
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
    if (deckMode) {
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
    const y = root.scrollTop;
    buildForm();
    root.scrollTop = y;
    if (!deckMode && !out.hidden) regen();
  }

  // ── Output / toolbar ─────────────────────────────────────────────────────
  function regen() { output.value = serializeCopy(data); out.hidden = false; }

  btnPrimary.addEventListener("click", () => {
    if (deckMode) {
      freshIds(data);
      const ok = opts.onApply ? opts.onApply(cloneDeep(data)) !== false : false;
      toast(ok ? "Applied to presentation ✓" : "Couldn't apply — invalid presentation");
      return;
    }
    regen();
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  btnCopy?.addEventListener("click", async () => {
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

  btnDownload.addEventListener("click", () => {
    if (deckMode) {
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

  btnExpand.addEventListener("click", () =>
    form.querySelectorAll("details").forEach((d) => { d.open = true; openState.add(d.dataset.key); }));
  btnCollapse.addEventListener("click", () => {
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
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1500);
  }

  buildForm();

  return {
    destroy() {
      clearTimeout(toastTimer);
      root.textContent = "";
      root.classList.remove("ce-root");
    },
  };
}

// ── Stylesheet (scoped under .ce-root; injected once) ──────────────────────
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  document.head.appendChild(h("style", { text: COPY_EDITOR_CSS }));
}

const COPY_EDITOR_CSS = `
.ce-root {
  --deep: #29003E; --card: #4A1969; --purple: #990AE3;
  --light: #F4E0FF; --cyan: #00D4FF; --line: rgba(244,224,255,0.16);
  --dim: rgba(244,224,255,0.65);
  background: var(--deep); color: var(--light);
  font-family: 'Telia Sans', system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5;
}
.ce-root * { box-sizing: border-box; }
.ce-root .ce-bar {
  position: sticky; top: 0; z-index: 5; background: rgba(41,0,62,0.96);
  backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); padding: 12px 20px;
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
}
.ce-root button {
  font: inherit; cursor: pointer; border-radius: 8px; padding: 8px 14px; border: 1px solid var(--line);
  background: var(--card); color: var(--light); transition: background .15s, border-color .15s;
}
.ce-root button:hover { border-color: var(--cyan); }
.ce-root button.primary { background: var(--purple); border-color: var(--purple); color: #fff; font-weight: 600; }
.ce-root button.primary:hover { background: #b01ff5; }
.ce-root .filter { margin-left: auto; }
.ce-root .filter input {
  font: inherit; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line);
  background: rgba(0,0,0,0.25); color: var(--light); width: 220px;
}
.ce-root .ce-main { padding: 18px 20px 80px; max-width: 1000px; margin: 0 auto; }
.ce-root details {
  border: 1px solid var(--line); border-radius: 12px; margin-bottom: 12px; overflow: hidden;
  background: rgba(0,0,0,0.14);
}
.ce-root summary {
  cursor: pointer; padding: 12px 16px; font-weight: 600; font-size: 15px;
  list-style: none; user-select: none; background: rgba(255,255,255,0.03);
  display: flex; align-items: baseline; gap: 8px;
}
.ce-root summary::-webkit-details-marker { display: none; }
.ce-root summary::before { content: "▸"; color: var(--cyan); }
.ce-root details[open] > summary::before { content: "▾"; }
.ce-root .sec-title { flex: 1; }
.ce-root .sec-key { font-family: ui-monospace, monospace; font-size: 11px; color: var(--dim); opacity: 0.7; }
.ce-root .group-body { padding: 8px 16px 16px; }
.ce-root .subgroup { border-left: 2px solid var(--line); padding-left: 12px; margin: 14px 0; }
.ce-root .subhead { font-size: 12px; font-weight: 600; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.ce-root .field { display: block; margin: 12px 0; }
.ce-root .field.hidden, .ce-root .item-card.hidden { display: none; }
.ce-root .lab { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-bottom: 4px; }
.ce-root .lab.inline { margin-bottom: 0; }
.ce-root .lab-name { font-size: 12.5px; color: var(--light); font-weight: 500; }
.ce-root .lab-badge { font-size: 10px; color: var(--cyan); border: 1px solid var(--line); border-radius: 999px; padding: 0 7px; }
.ce-root .lab-path { font-size: 10.5px; color: var(--dim); font-family: ui-monospace, monospace; opacity: 0.55; word-break: break-all; }
.ce-root .collection { margin: 14px 0; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: rgba(0,0,0,0.10); }
.ce-root .coll-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.ce-root .coll-title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.ce-root .coll-title .count { font-size: 11px; color: var(--dim); background: rgba(0,0,0,0.3); border-radius: 999px; padding: 1px 8px; font-family: ui-monospace, monospace; }
.ce-root .coll-head .add { margin-left: auto; }
.ce-root button.mini { padding: 5px 11px; font-size: 12.5px; border-radius: 7px; }
.ce-root button.mini.add { background: rgba(153,10,227,0.25); border-color: var(--purple); }
.ce-root button.mini.add:hover { background: var(--purple); }
.ce-root .coll-list { display: flex; flex-direction: column; gap: 8px; }
.ce-root .item-card { border: 1px solid var(--line); border-radius: 9px; background: rgba(255,255,255,0.02); overflow: hidden; }
.ce-root .card-head { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: rgba(255,255,255,0.03); }
.ce-root .card-title { flex: 1; font-size: 12.5px; color: var(--light); font-weight: 600; }
.ce-root .card-body { padding: 4px 12px 10px; }
.ce-root .controls { display: flex; gap: 4px; flex: none; }
.ce-root .icon-btn { padding: 3px 8px; font-size: 13px; line-height: 1; border-radius: 6px; }
.ce-root .icon-btn:disabled { opacity: 0.3; cursor: default; }
.ce-root .scalar-row { display: flex; align-items: center; gap: 6px; }
.ce-root .scalar-row .grow { flex: 1; font: inherit; padding: 7px 9px; border-radius: 7px; border: 1px solid var(--line); background: rgba(0,0,0,0.28); color: var(--light); }
.ce-root .scalar-row .grow:focus { outline: none; border-color: var(--cyan); }
.ce-root .collection[data-coupled] .coll-title::after { content: "fixed length"; font-size: 10px; color: var(--dim); font-weight: 400; border: 1px solid var(--line); border-radius: 999px; padding: 0 7px; }
.ce-root .rich-box { display: flex; flex-direction: column; gap: 6px; border: 1px dashed var(--line); border-radius: 9px; padding: 10px; }
.ce-root .rich-row { display: flex; align-items: flex-start; gap: 8px; }
.ce-root .rich-content { flex: 1; min-width: 0; }
.ce-root .rich-ctrls { display: flex; gap: 4px; flex: none; padding-top: 2px; }
.ce-root .rich-foot { display: flex; gap: 8px; padding-top: 2px; }
.ce-root .seg { display: flex; flex-direction: column; gap: 6px; padding: 7px 9px; border-radius: 7px; background: rgba(0,212,255,0.05); }
.ce-root .seg-plain, .ce-root .seg-text { width: 100%; font: inherit; padding: 7px 9px; border-radius: 7px; border: 1px solid var(--line); background: rgba(0,0,0,0.28); color: var(--light); }
.ce-root .seg-plain:focus, .ce-root .seg-text:focus { outline: none; border-color: var(--cyan); }
.ce-root .seg-extras { display: flex; flex-wrap: wrap; gap: 10px 18px; }
.ce-root .seg-extras .field { margin: 2px 0; }
.ce-root .seg-br { font-size: 11px; color: var(--dim); font-style: italic; padding: 2px 4px; }
.ce-root .grad-row { display: flex; flex-wrap: wrap; gap: 8px; }
.ce-root .field.bool { display: flex; align-items: center; gap: 8px; }
.ce-root .field.bool input { width: 16px; height: 16px; }
.ce-root .field input[type=text], .ce-root .field textarea {
  width: 100%; font: inherit; padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--line); background: rgba(0,0,0,0.28); color: var(--light); resize: vertical;
}
.ce-root .field input[type=text]:focus, .ce-root .field textarea:focus { outline: none; border-color: var(--cyan); }
.ce-root .field input[type=number] {
  font: inherit; padding: 8px 10px; border-radius: 8px; width: 140px;
  border: 1px solid var(--line); background: rgba(0,0,0,0.28); color: var(--light);
}
.ce-root .field input[type=number]:focus { outline: none; border-color: var(--cyan); }
.ce-root .color-row { display: flex; align-items: center; gap: 10px; }
.ce-root .color-row select {
  font: inherit; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line);
  background: rgba(0,0,0,0.28); color: var(--light); min-width: 160px;
}
.ce-root .swatch { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--line); flex: none; }
.ce-root .out { margin-top: 14px; }
.ce-root .out textarea {
  width: 100%; min-height: 320px; font-family: ui-monospace, 'SFMono-Regular', monospace; font-size: 12.5px;
  padding: 12px; border-radius: 10px; border: 1px solid var(--line); background: #1b0a28; color: var(--light);
}
.ce-root .note { color: var(--dim); font-size: 12.5px; }
.ce-root .note code { background: rgba(0,0,0,0.3); padding: 1px 5px; border-radius: 4px; }
.ce-root .deploy {
  border: 1px solid var(--line); border-left: 3px solid var(--cyan); border-radius: 10px;
  background: rgba(0,212,255,0.06); padding: 12px 16px 13px; margin-bottom: 16px;
}
.ce-root .deploy h2 {
  margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--cyan);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.ce-root .deploy ol { margin: 0; padding-left: 20px; }
.ce-root .deploy li { margin: 3px 0; color: var(--dim); }
.ce-root .deploy strong { color: var(--light); font-weight: 600; }
.ce-root .deploy code {
  background: rgba(0,0,0,0.3); padding: 1px 5px; border-radius: 4px;
  color: var(--light); font-family: ui-monospace, monospace; font-size: 12px;
}
.ce-root .toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 50;
  background: var(--cyan); color: #04222b; font-weight: 600; padding: 10px 18px; border-radius: 10px;
  opacity: 0; transition: opacity .2s; pointer-events: none;
}
.ce-root .toast.show { opacity: 1; }
`;
