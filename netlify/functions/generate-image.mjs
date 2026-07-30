// AI image generation for the Presentation Studio: an authenticated proxy to
// Replicate's flux-1.1-pro text-to-image model, plus an Openverse search
// passthrough (used only when the browser cannot reach api.openverse.org
// directly). The Replicate API token stays server-side in REPLICATE_API_TOKEN
// (TEXT_TO_IMAGE is accepted as an alias) — it must never ship to the client.
// Gated by the same sign-in cookie as deck storage so anonymous visitors
// cannot spend the site's Replicate credits.
//
//   GET  /api/generate-image?ov_q=…&page=N          → Openverse search JSON
//   POST /api/generate-image {prompt, aspect_ratio} → {dataUri} | {id, status}
//   GET  /api/generate-image?id=…                   → {dataUri} | {id, status}
//
// Generation is asynchronous on Replicate's side: the POST holds the request
// briefly (Prefer: wait) and returns {id, status} if the model needs longer —
// the client then polls the GET until {dataUri} arrives. The finished image is
// re-fetched server-side and returned as a data URI because Replicate output
// URLs expire after about an hour, while decks live for years.
import { authedPrefix } from "./decks.mjs";

const MODEL = "black-forest-labs/flux-1.1-pro";
const ASPECTS = new Set(["1:1", "16:9", "4:3", "3:4", "9:16", "21:9"]);
const apiToken = () => process.env.REPLICATE_API_TOKEN || process.env.TEXT_TO_IMAGE;

// Turn a (possibly still-running) prediction into the client response.
async function predictionResponse(pred) {
  if (pred.status === "failed" || pred.status === "canceled")
    return Response.json({ error: pred.error ? String(pred.error) : "generation failed" }, { status: 502 });
  if (pred.status !== "succeeded") return Response.json({ id: pred.id, status: pred.status });
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (typeof url !== "string" || !/^https:/.test(url))
    return Response.json({ error: "no image in result" }, { status: 502 });
  const img = await fetch(url);
  if (!img.ok) return Response.json({ error: `image fetch failed (${img.status})` }, { status: 502 });
  const mime = img.headers.get("content-type") || "image/webp";
  const b64 = Buffer.from(await img.arrayBuffer()).toString("base64");
  return Response.json({ dataUri: `data:${mime};base64,${b64}` });
}

export default async (req) => {
  if (!authedPrefix(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);

  const ovq = url.searchParams.get("ov_q");
  if (ovq) {
    const page = Math.max(1, Math.min(20, Number(url.searchParams.get("page")) || 1));
    const r = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(ovq.slice(0, 200))}&page_size=24&page=${page}`,
      { headers: { "User-Agent": "PresentationStudio/1.0" } },
    );
    return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
  }

  const token = apiToken();
  if (!token)
    return Response.json({ error: "Image generation is not configured — set REPLICATE_API_TOKEN on this site." }, { status: 503 });
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const id = url.searchParams.get("id");
  if (req.method === "GET" && id) {
    if (!/^[a-z0-9]{8,64}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: auth });
    const pred = await r.json().catch(() => null);
    if (!r.ok || !pred) return Response.json({ error: (pred && (pred.detail || pred.title)) || `Replicate error ${r.status}` }, { status: 502 });
    return predictionResponse(pred);
  }

  if (req.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 2000)
    return Response.json({ error: "prompt required (max 2000 chars)" }, { status: 400 });
  const aspect = ASPECTS.has(body.aspect_ratio) ? body.aspect_ratio : "16:9";

  // Prefer: wait=8 keeps well inside the 10s function timeout; slower runs
  // fall through to client polling via the returned prediction id.
  const r = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: { ...auth, Prefer: "wait=8" },
    body: JSON.stringify({
      input: { prompt, aspect_ratio: aspect, output_format: "webp", output_quality: 90, prompt_upsampling: true, safety_tolerance: 2 },
    }),
  });
  const pred = await r.json().catch(() => null);
  if (!r.ok || !pred)
    return Response.json({ error: (pred && (pred.detail || pred.title)) || `Replicate error ${r.status}` }, { status: 502 });
  return predictionResponse(pred);
};

export const config = { path: "/api/generate-image" };
