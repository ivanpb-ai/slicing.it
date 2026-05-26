// Pure serialiser: turns a runtime COPY object back into copy.js source,
// reconstructing P.<name> colour references from a reverse-palette lookup.
// Kept DOM-free so it can be unit-tested in Node and reused by the editor.
import { P } from "./palette";

const nameByValue = {};
for (const [name, value] of Object.entries(P)) {
  if (!(value in nameByValue)) nameByValue[value] = name;
}

export const isColorValue = (v) =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(nameByValue, v);

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

export function serializeCopy(data) {
  return `import { P } from "./palette";\n\nexport const COPY = ${serialize(data, 0)};\n`;
}
