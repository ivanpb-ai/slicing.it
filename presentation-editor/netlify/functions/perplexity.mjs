// Perplexity proxy for the Studio's "interactive pages" enrichment and the
// live explanation toggle on generated pages. Keeps the API key server-side.
//
//   POST /api/perplexity   body { query, history?: [{role, content}] }
//   → streamed SSE (OpenAI chat-completions frames), same shape the client
//     and generated pages already parse.
//
// Configure in the Netlify site's environment variables:
//   PERPLEXITY_API_KEY  (required) — without it the endpoint returns 503 and
//                       the editor's "No API" mode still works fine.
//
// CORS is open on purpose: generated pages are meant to be downloaded and
// opened from disk or another host, and still reach this endpoint. Anyone
// who can reach the deployed site can therefore spend against your key —
// remove the CORS headers (and the OPTIONS branch) to lock it to same-origin.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405, headers: CORS });

  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return Response.json({ error: "PERPLEXITY_API_KEY is not configured" }, { status: 503, headers: CORS });

  let body;
  try { body = await req.json(); } catch { body = null; }
  const query = body && typeof body.query === "string" ? body.query.slice(0, 8000) : "";
  if (!query) return Response.json({ error: "bad request" }, { status: 400, headers: CORS });

  const history = Array.isArray(body.history)
    ? body.history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
    : [];

  const upstream = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL || "sonar",
      stream: true,
      messages: [
        { role: "system", content: "Be precise and concise. Answer in plain prose without markdown headers." },
        ...history,
        { role: "user", content: query },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return Response.json({ error: "upstream error", status: upstream.status, detail: detail.slice(0, 500) }, { status: 502, headers: CORS });
  }

  // Pass the SSE stream straight through.
  return new Response(upstream.body, {
    status: 200,
    headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
  });
};

export const config = { path: "/api/perplexity" };
