export const API_URLS = {
  northstar: "https://northstar-program.com/.netlify/functions/perplexity-api",
  generic: "https://northstar-program.com/.netlify/functions/perplexity-generic",
};

const DEFAULT_API_URL = API_URLS.northstar;

// Strip Perplexity citation markers like [3][6][7] and tidy whitespace.
// Markdown emphasis (**bold**) is kept — the modal renders it.
export function cleanDescription(desc) {
  return desc
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// The API often echoes the queried term as a "LABEL – " prefix, which
// duplicates the modal title. Strip it, but only when followed by a
// separator — "**RAN** is the radio…" is a normal sentence and stays.
export function stripLabelEcho(label, text) {
  const escd = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    "^\\s*(?:\\*\\*)?" + escd + "(?:\\*\\*)?\\s*[–—:-]\\s*",
    "i"
  );
  let t = text;
  while (re.test(t)) t = t.replace(re, "");
  return t;
}

/**
 * Query the NorthStar API (SSE/streaming) and return the full text answer.
 */
async function askNorthStar(query, apiUrl) {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, history: [] }),
  });
  if (!res.ok) {
    throw new Error(`NorthStar API ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const c =
          j.choices?.[0]?.delta?.content ??
          j.choices?.[0]?.message?.content ??
          "";
        if (c) out += c;
      } catch {
        /* ignore non-JSON frames */
      }
    }
  }
  return out.trim();
}

/**
 * Given a parsed slide, query the NorthStar API for a one-sentence
 * explanation of each component. Returns a Map<string, string> keyed
 * by the element's display text.
 *
 * Batches items into a single prompt per group to minimise API calls.
 */
export async function enrichSlide(slide, opts = {}) {
  const mode = opts.mode || "northstar";
  const apiUrl = opts.apiUrl || API_URLS[mode] || DEFAULT_API_URL;
  const concurrency = opts.concurrency ?? 3;
  const descriptions = new Map();

  // Collect unique text labels from the slide's shapes.
  const seen = new Set();
  const labels = [];
  for (const s of slide.shapes || []) {
    const t = (s.textPlain || "").trim();
    if (!t || seen.has(t)) continue;
    if (/^\d{1,3}$/.test(t)) continue; // page numbers
    if (/internal$/i.test(t)) continue; // footers
    seen.add(t);
    labels.push(t);
  }

  if (labels.length === 0) return descriptions;

  // Build batched queries — group labels together in chunks of ~8
  const batchSize = 8;
  const batches = [];
  for (let i = 0; i < labels.length; i += batchSize) {
    batches.push(labels.slice(i, i + batchSize));
  }

  const pending = [];
  let active = 0;

  const framing =
    mode === "generic"
      ? "In the context of 5G mobile networks, give a one-sentence description for each of the following terms."
      : "In the NorthStar / Telia 5G SA architecture, give a one-sentence description for each of the following components.";

  for (const batch of batches) {
    const listStr = batch.map((l, i) => `${i + 1}. ${l}`).join("\n");
    const query = `${framing} Return ONLY a numbered list matching the input — one line per item, number then description. No markdown headers.\n\n${listStr}`;

    const run = async () => {
      process.stderr.write(`  ⏳ Querying: ${batch.join(", ")}\n`);
      try {
        const answer = await askNorthStar(query, apiUrl);
        // Parse numbered list from response
        const lines = answer.split("\n").filter(l => /^\d+[\.\)]\s/.test(l.trim()));
        for (let i = 0; i < Math.min(lines.length, batch.length); i++) {
          const desc = stripLabelEcho(
            batch[i],
            cleanDescription(lines[i].replace(/^\d+[\.\)]\s*/, ""))
          );
          if (desc && !desc.toLowerCase().startsWith("not available")) {
            descriptions.set(batch[i], desc);
          }
        }
      } catch (err) {
        process.stderr.write(`  ⚠ API error for batch: ${err.message}\n`);
      }
    };

    pending.push(run);
  }

  // Run with concurrency limit
  const executing = new Set();
  for (const task of pending) {
    const p = task().then(() => executing.delete(p));
    executing.add(p);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);

  return descriptions;
}
