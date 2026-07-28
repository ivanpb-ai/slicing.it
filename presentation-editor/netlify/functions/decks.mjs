// Shared deck storage for the Presentation Studio, so the same library is
// available from every device. Decks live in Netlify Blobs; access is gated
// by the same sign-in cookie the editor tools use (see
// netlify/edge-functions/editor-auth.js — the cookie holds a SHA-256 token
// derived from EDITOR_PASSWORD, which this function recomputes and checks).
//
//   GET    /api/decks          → { items: [{id, title, updatedAt, deleted?}] }
//   GET    /api/decks?id=X     → { deck }
//   PUT    /api/decks?id=X     → body { deck, updatedAt } — upsert
//   DELETE /api/decks?id=X     → tombstones the deck (so deletions sync too)
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const PEPPER = "studio-editor-gate-v1";
const COOKIE = "studio_auth";
const MANIFEST = "__manifest__";
const ID_RE = /^[a-z0-9_-]{1,64}$/i;

function authed(req) {
  const password = process.env.EDITOR_PASSWORD;
  if (!password) return false;
  const expected = crypto.createHash("sha256").update(`${PEPPER}:${password}`).digest("hex");
  const part = (req.headers.get("cookie") || "").split(/; */).find((p) => p.trim().startsWith(COOKIE + "="));
  const val = part ? decodeURIComponent(part.trim().slice(COOKIE.length + 1)) : "";
  return val.length === expected.length && crypto.timingSafeEqual(Buffer.from(val), Buffer.from(expected));
}

export default async (req) => {
  if (!authed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const store = getStore("studio-decks");
  const id = new URL(req.url).searchParams.get("id");
  if (id && !ID_RE.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const manifest = (await store.get(MANIFEST, { type: "json" })) || { items: [] };

  if (req.method === "GET" && !id) return Response.json(manifest);

  if (req.method === "GET") {
    const deck = await store.get("deck:" + id, { type: "json" });
    return deck ? Response.json({ deck }) : Response.json({ error: "not found" }, { status: 404 });
  }

  if (req.method === "PUT" && id) {
    let body;
    try { body = await req.json(); } catch { body = null; }
    if (!body || !body.deck || typeof body.deck !== "object") return Response.json({ error: "bad request" }, { status: 400 });
    await store.setJSON("deck:" + id, body.deck);
    const entry = { id, title: String(body.deck.title || "Untitled"), updatedAt: Number(body.updatedAt) || Date.now() };
    const i = manifest.items.findIndex((x) => x.id === id);
    if (i >= 0) manifest.items[i] = entry; else manifest.items.push(entry);
    await store.setJSON(MANIFEST, manifest);
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE" && id) {
    await store.delete("deck:" + id);
    const tomb = { id, deleted: true, updatedAt: Date.now() };
    const i = manifest.items.findIndex((x) => x.id === id);
    if (i >= 0) manifest.items[i] = tomb; else manifest.items.push(tomb);
    await store.setJSON(MANIFEST, manifest);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "method not allowed" }, { status: 405 });
};

export const config = { path: "/api/decks" };
