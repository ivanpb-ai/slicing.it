// Insert-image dialog: three sources for the image block.
//   Upload   — a file from the user's device, downscaled to keep decks small.
//   Openverse — search openly-licensed photos (api.openverse.org); tried
//               directly from the browser, falling back to the site's
//               /api/generate-image?ov_q= passthrough if CORS blocks it.
//   Generate — a text prompt sent to Replicate's flux-1.1-pro via the site's
//              /api/generate-image function (the API token stays server-side).
// Every path ends in props {src, alt} handed to onInsert together with a
// stage-fitted geometry, so the caller just creates the element.
import { useRef, useState } from "react";

const API = "/api/generate-image";
const MAX_DIM = 1600; // longest edge for imported bitmaps

const readAsDataURL = (blob) =>
  new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error("could not read file"));
    fr.readAsDataURL(blob);
  });

// Downscale + recompress big bitmaps so a few photos don't blow the deck past
// the localStorage quota. SVGs and already-small files pass through untouched.
async function blobToDeckUri(blob) {
  if (blob.type === "image/svg+xml" || blob.type === "image/gif" || blob.size < 300 * 1024)
    return readAsDataURL(blob);
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const uri = canvas.toDataURL("image/webp", 0.85);
    return uri.startsWith("data:image/webp") ? uri : canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return readAsDataURL(blob); // e.g. unsupported format — keep the original
  }
}

const imageDims = (src) =>
  new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth || 800, h: img.naturalHeight || 500 });
    img.onerror = () => res({ w: 800, h: 500 });
    img.src = src;
  });

// Element geometry: fit the picture inside a comfortable stage box, centred.
async function fitGeometry(src) {
  const { w, h } = await imageDims(src);
  const scale = Math.min(720 / w, 460 / h, 1);
  const ew = Math.max(120, Math.round(w * scale));
  const eh = Math.max(90, Math.round(h * scale));
  return { x: Math.round((1280 - ew) / 2), y: Math.round((720 - eh) / 2), w: ew, h: eh };
}

async function searchOpenverse(q, page) {
  const qs = `q=${encodeURIComponent(q)}&page_size=24&page=${page}`;
  try {
    const r = await fetch(`https://api.openverse.org/v1/images/?${qs}`);
    if (r.ok) return r.json();
  } catch { /* CORS / network — fall through to the site passthrough */ }
  const r = await fetch(`${API}?ov_q=${encodeURIComponent(q)}&page=${page}`, { credentials: "same-origin" });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || `search failed (${r.status})`);
  return r.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateImage(prompt, aspect) {
  let r = await fetch(API, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: aspect }),
  });
  let d = await r.json().catch(() => null);
  const t0 = Date.now();
  while (r.ok && d && !d.dataUri && !d.error && d.id && Date.now() - t0 < 120000) {
    await sleep(2500);
    r = await fetch(`${API}?id=${encodeURIComponent(d.id)}`, { credentials: "same-origin" });
    d = await r.json().catch(() => null);
  }
  if (!r.ok || !d || d.error) throw new Error((d && d.error) || `generation failed (${r.status})`);
  if (!d.dataUri) throw new Error("generation timed out — try again");
  return d.dataUri;
}

const TABS = [
  ["upload", "⬆ Upload"],
  ["search", "🔍 Free photos"],
  ["generate", "✨ Generate"],
];
const ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16"];

export function ImageInsertDialog({ onInsert, onClose }) {
  const [tab, setTab] = useState("upload");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);

  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("16:9");
  const [preview, setPreview] = useState(null);

  const insert = async (src, alt) => {
    setError("");
    setBusy("Adding to the slide…");
    try {
      const geo = await fitGeometry(src);
      onInsert({ ...geo, props: { src, alt: (alt || "").slice(0, 300), fit: "cover" } });
    } catch (e) { setError(String(e.message || e)); setBusy(""); }
  };

  const pickFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) { setError("That file is not an image."); return; }
    setError("");
    setBusy("Preparing image…");
    try { await insert(await blobToDeckUri(file), file.name.replace(/\.[a-z0-9]+$/i, "")); }
    catch (e) { setError(String(e.message || e)); setBusy(""); }
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setError(""); setResults(null);
    setBusy("Searching Openverse…");
    try { setResults((await searchOpenverse(query.trim(), 1)).results || []); }
    catch (e) { setError(String(e.message || e)); }
    setBusy("");
  };

  // Prefer a stable data URI (survives link rot, exports to .pptx); if the
  // provider blocks cross-origin reads, fall back to hot-linking the URL.
  const pickResult = async (item) => {
    setError("");
    setBusy("Fetching image…");
    const alt = item.attribution || [item.title, item.creator && `by ${item.creator}`, item.license && `(${String(item.license).toUpperCase()})`].filter(Boolean).join(" ");
    try {
      const r = await fetch(item.url);
      if (!r.ok) throw new Error(`fetch failed (${r.status})`);
      await insert(await blobToDeckUri(await r.blob()), alt);
    } catch {
      await insert(item.url, alt);
    }
  };

  const doGenerate = async () => {
    if (!prompt.trim()) return;
    setError(""); setPreview(null);
    setBusy("Generating with flux-1.1-pro — usually 5–15 seconds…");
    try { setPreview(await generateImage(prompt.trim(), aspect)); }
    catch (e) { setError(String(e.message || e)); }
    setBusy("");
  };

  return (
    <div className="st-gen-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="st-gen st-imgdlg">
        <div className="st-gen-head">
          <b>▤ Insert image</b>
          <button className="st-icon" onClick={onClose}>✕</button>
        </div>
        <div className="st-imgtabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={"st-imgtab" + (tab === k ? " on" : "")} onClick={() => { setTab(k); setError(""); }}>{label}</button>
          ))}
        </div>

        {tab === "upload" && (
          <div className="st-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current && fileRef.current.click()}>
            <div className="st-dropzone-icon">🖼</div>
            <b>Choose an image from this device</b>
            <span>click to browse, or drop a file here — large photos are scaled down automatically</span>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { pickFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
          </div>
        )}

        {tab === "search" && (
          <>
            <div className="st-imgrow">
              <input className="st-imginput" placeholder="Search openly-licensed photos — e.g. northern lights"
                value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }} autoFocus />
              <button className="st-btn primary" onClick={doSearch} disabled={!query.trim() || !!busy}>Search</button>
            </div>
            {results && !results.length && <p className="st-gen-sub">No matches — try different words.</p>}
            {results && results.length > 0 && (
              <div className="st-ovgrid">
                {results.map((it) => (
                  <button key={it.id} className="st-ovitem" title={`${it.title || "Untitled"} — ${it.creator || "unknown"} (${String(it.license || "").toUpperCase()})`}
                    onClick={() => pickResult(it)}>
                    <img src={it.thumbnail || it.url} alt={it.title || ""} loading="lazy" />
                    <span>{String(it.license || "").toUpperCase()}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="st-gen-sub">Photos via <b>Openverse</b> (openverse.org) under Creative Commons and public-domain licenses. The license is kept in the image's alt text — double-check terms before commercial use.</p>
          </>
        )}

        {tab === "generate" && (
          <>
            <textarea className="st-imgprompt" rows={3} autoFocus
              placeholder="Describe the image — e.g. isometric illustration of a 5G antenna on a mountain at dawn, purple and cyan palette"
              value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <div className="st-imgrow">
              <label className="st-gen-sub" style={{ margin: 0 }}>Shape&nbsp;
                <select className="st-imgselect" value={aspect} onChange={(e) => setAspect(e.target.value)}>
                  {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <button className="st-btn primary" onClick={doGenerate} disabled={!prompt.trim() || !!busy}>
                {preview ? "↻ Regenerate" : "✨ Generate"}
              </button>
            </div>
            {preview && (
              <>
                <img className="st-genprev" src={preview} alt="Generated preview" />
                <div className="st-imgrow" style={{ justifyContent: "flex-end" }}>
                  <button className="st-btn primary" onClick={() => insert(preview, prompt.trim().slice(0, 200))}>✓ Insert this image</button>
                </div>
              </>
            )}
            <p className="st-gen-sub">Images are generated by Replicate's <b>flux-1.1-pro</b> model via this site's own API proxy.</p>
          </>
        )}

        {busy && <p className="st-gen-sub st-imgbusy">{busy}</p>}
        {error && <p className="st-gen-sub st-imgerr">⚠ {error}</p>}
      </div>
    </div>
  );
}
