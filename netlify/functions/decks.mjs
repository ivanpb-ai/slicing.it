// Deck storage for the Presentation Studio. Decks live in Netlify Blobs;
// access is gated by the sign-in cookie set by
// netlify/edge-functions/editor-auth.js.
//
// Two modes, mirroring the edge function:
//   EDITOR_USERS     multi-user — the cookie holds "<user>:<token>" where the
//                    token is a SHA-256 derived from that user's password.
//                    Each user's decks live under a "user:<name>:" namespace;
//                    one user can never list, read or write another's decks.
//                    EDITOR_PASSWORD is the reserved "admin" account's
//                    password; admin owns the original unnamespaced keys, so
//                    the site's pre-existing decks belong to the admin.
//   EDITOR_PASSWORD  alone (no EDITOR_USERS) — the admin-only legacy mode:
//                    plain-token cookie and the original unnamespaced keys,
//                    so existing deployed data keeps working untouched.
//
//   GET    /api/decks          → { items: [{id, title, updatedAt, deleted?}] }
//   GET    /api/decks?id=X     → { deck }
//   PUT    /api/decks?id=X     → body { deck, updatedAt } — upsert
//   DELETE /api/decks?id=X     → tombstones the deck (so deletions sync too)
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const PEPPER = "northstar-editor-gate-v1";
const COOKIE = "ns_editor_auth";
const MANIFEST = "__manifest__";
const ID_RE = /^[a-z0-9_-]{1,64}$/i;
const USER_RE = /^[a-z0-9_-]{1,32}$/i;

// → Map<user, password> when EDITOR_USERS is set, else null (shared mode).
// "admin" is reserved: never read from EDITOR_USERS, and present exactly when
// EDITOR_PASSWORD is set — that password IS the admin credential.
function parseUsers() {
  const multi = process.env.EDITOR_USERS;
  if (!multi) return null;
  const map = new Map();
  for (const pair of multi.split(",")) {
    const i = pair.indexOf(":");
    if (i < 1) continue;
    const name = pair.slice(0, i).trim();
    const pw = pair.slice(i + 1).trim();
    if (USER_RE.test(name) && pw && name.toLowerCase() !== "admin") map.set(name, pw);
  }
  const adminPw = process.env.EDITOR_PASSWORD;
  if (adminPw) map.set("admin", adminPw);
  return map.size ? map : null;
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// → { prefix } for the authenticated caller, or null. Shared mode uses the
// original unnamespaced keys ("" prefix) so pre-existing decks stay visible.
export function authedPrefix(req) {
  const part = (req.headers.get("cookie") || "").split(/; */).find((p) => p.trim().startsWith(COOKIE + "="));
  const raw = part ? decodeURIComponent(part.trim().slice(COOKIE.length + 1)) : "";

  const users = parseUsers();
  if (users) {
    const i = raw.indexOf(":");
    if (i < 1) return null;
    const user = raw.slice(0, i), hash = raw.slice(i + 1);
    const pw = users.get(user);
    if (!pw) return null;
    if (!safeEq(hash, sha256(`${PEPPER}:${user}:${pw}`))) return null;
    // Admin owns the original shared library (the unnamespaced keys).
    return { prefix: user === "admin" ? "" : `user:${user}:` };
  }

  const password = process.env.EDITOR_PASSWORD;
  if (!password) return null;
  return safeEq(raw, sha256(`${PEPPER}:${password}`)) ? { prefix: "" } : null;
}

export default async (req) => {
  const auth = authedPrefix(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  const store = getStore("studio-decks");
  const k = (s) => auth.prefix + s;
  const id = new URL(req.url).searchParams.get("id");
  if (id && !ID_RE.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const manifest = (await store.get(k(MANIFEST), { type: "json" })) || { items: [] };

  if (req.method === "GET" && !id) return Response.json(manifest);

  if (req.method === "GET") {
    const deck = await store.get(k("deck:" + id), { type: "json" });
    return deck ? Response.json({ deck }) : Response.json({ error: "not found" }, { status: 404 });
  }

  if (req.method === "PUT" && id) {
    let body;
    try { body = await req.json(); } catch { body = null; }
    if (!body || !body.deck || typeof body.deck !== "object") return Response.json({ error: "bad request" }, { status: 400 });
    await store.setJSON(k("deck:" + id), body.deck);
    const entry = { id, title: String(body.deck.title || "Untitled"), updatedAt: Number(body.updatedAt) || Date.now() };
    const i = manifest.items.findIndex((x) => x.id === id);
    if (i >= 0) manifest.items[i] = entry; else manifest.items.push(entry);
    await store.setJSON(k(MANIFEST), manifest);
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE" && id) {
    await store.delete(k("deck:" + id));
    const tomb = { id, deleted: true, updatedAt: Date.now() };
    const i = manifest.items.findIndex((x) => x.id === id);
    if (i >= 0) manifest.items[i] = tomb; else manifest.items.push(tomb);
    await store.setJSON(k(MANIFEST), manifest);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "method not allowed" }, { status: 405 });
};

export const config = { path: "/api/decks" };
