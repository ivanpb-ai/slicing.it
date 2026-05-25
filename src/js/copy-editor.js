// Visual editor for the presentation copy. Loads the live COPY object, lets you
// edit every text string and section colour, then serialises an updated copy.js
// (reconstructing P.<name> colour references from a reverse-palette lookup).
// It cannot write to the repo (static site) — you export the file and commit it.

import { COPY } from "./copy";
import { P } from "./palette";

// Runtime clone. At runtime COPY's colours are resolved hex/rgba strings.
const data = JSON.parse(JSON.stringify(COPY));

const paletteNames = Object.keys(P);
const nameByValue = {};
for (const [name, value] of Object.entries(P)) {
  if (!(value in nameByValue)) nameByValue[value] = name;
}

const isColorValue = (v) =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(nameByValue, v);

// Keys that are structural identifiers (used by rendering logic) — not editable text.
const SKIP_KEYS = new Set(["id"]);

const form = document.getElementById("form");

function makeTextField(parent, key, label) {
  const value = parent[key];
  const wrap = document.createElement("label");
  wrap.className = "field";
  const lab = document.createElement("span");
  lab.className = "lab";
  lab.textContent = label;
  wrap.appendChild(lab);

  const long = value.length > 58 || value.includes("\n");
  const el = document.createElement(long ? "textarea" : "input");
  if (long) el.rows = Math.min(6, Math.max(2, Math.ceil(value.length / 72)));
  else el.type = "text";
  el.value = value;
  el.addEventListener("input", () => { parent[key] = el.value; });
  wrap.appendChild(el);
  return wrap;
}

function makeColorField(parent, key, label) {
  const value = parent[key];
  const wrap = document.createElement("label");
  wrap.className = "field";
  const lab = document.createElement("span");
  lab.className = "lab";
  lab.textContent = label;
  wrap.appendChild(lab);

  const row = document.createElement("div");
  row.className = "color-row";

  const sel = document.createElement("select");
  for (const name of paletteNames) {
    const opt = document.createElement("option");
    opt.value = P[name];
    opt.textContent = name;
    if (P[name] === value) opt.selected = true;
    sel.appendChild(opt);
  }
  if (!paletteNames.some((n) => P[n] === value)) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = "(custom) " + value;
    opt.selected = true;
    sel.appendChild(opt);
  }

  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.background = value;

  sel.addEventListener("change", () => {
    parent[key] = sel.value;
    swatch.style.background = sel.value;
  });

  row.appendChild(sel);
  row.appendChild(swatch);
  wrap.appendChild(row);
  return wrap;
}

function renderEntry(parent, key, container, label) {
  if (SKIP_KEYS.has(String(key))) return;
  const value = parent[key];

  if (Array.isArray(value)) {
    value.forEach((_, i) => renderEntry(value, i, container, `${label}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) renderEntry(value, k, container, `${label}.${k}`);
    return;
  }
  // Skip numbers/booleans (stat values, coordinates, flags) — not "text".
  if (typeof value !== "string") return;

  container.appendChild(
    isColorValue(value)
      ? makeColorField(parent, key, label)
      : makeTextField(parent, key, label)
  );
}

// One collapsible group per top-level COPY key.
for (const topKey of Object.keys(data)) {
  const body = document.createElement("div");
  body.className = "group-body";
  renderEntry(data, topKey, body, topKey);
  if (!body.children.length) continue;

  const det = document.createElement("details");
  const sum = document.createElement("summary");
  sum.textContent = topKey;
  det.appendChild(sum);
  det.appendChild(body);
  form.appendChild(det);
}

// ── Serialise back to copy.js source ──────────────────────────────────────
function serialize(v, indent) {
  const pad = "  ".repeat(indent);
  const pad1 = "  ".repeat(indent + 1);

  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return "[\n" + v.map((x) => pad1 + serialize(x, indent + 1)).join(",\n") + "\n" + pad + "]";
  }
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    if (!keys.length) return "{}";
    const body = keys
      .map((k) => {
        const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
        return pad1 + key + ": " + serialize(v[k], indent + 1);
      })
      .join(",\n");
    return "{\n" + body + "\n" + pad + "}";
  }
  if (typeof v === "string") {
    return Object.prototype.hasOwnProperty.call(nameByValue, v)
      ? "P." + nameByValue[v]
      : JSON.stringify(v);
  }
  return String(v);
}

function buildSource() {
  return `import { P } from "./palette";\n\nexport const COPY = ${serialize(data, 0)};\n`;
}

// ── Toolbar ───────────────────────────────────────────────────────────────
const out = document.getElementById("out");
const output = document.getElementById("output");

function ensureGenerated() {
  if (!output.value) {
    output.value = buildSource();
    out.hidden = false;
  }
}

document.getElementById("generate").addEventListener("click", () => {
  output.value = buildSource();
  out.hidden = false;
  out.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("copy").addEventListener("click", async () => {
  ensureGenerated();
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
  ensureGenerated();
  const blob = new Blob([output.value], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "copy.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Downloaded copy.js");
});

document.getElementById("expand").addEventListener("click", () =>
  document.querySelectorAll("details").forEach((d) => (d.open = true))
);
document.getElementById("collapse").addEventListener("click", () =>
  document.querySelectorAll("details").forEach((d) => (d.open = false))
);

const filter = document.getElementById("filter");
filter.addEventListener("input", () => {
  const q = filter.value.trim().toLowerCase();
  document.querySelectorAll("details").forEach((det) => {
    let any = false;
    det.querySelectorAll(".field").forEach((f) => {
      const match = !q || f.querySelector(".lab").textContent.toLowerCase().includes(q);
      f.classList.toggle("hidden", !match);
      if (match) any = true;
    });
    det.style.display = !any && q ? "none" : "";
    if (q && any) det.open = true;
  });
});

let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1500);
}

document.getElementById("intro").textContent =
  "Numbers and layout coordinates are intentionally hidden — edit those in copy.js directly. " +
  "Colours come from the Telia palette. Nothing saves automatically: click “Generate copy.js”, " +
  "then copy or download the result and commit it.";
