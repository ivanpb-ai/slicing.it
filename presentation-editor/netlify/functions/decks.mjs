// Per-user deck storage for the Presentation Studio, so each signed-in user
// gets their own library on every device. Decks live in Netlify Blobs under a
// per-user namespace. Two auth schemes, tried in order:
//
//   1. Netlify Identity — the client sends "Authorization: Bearer <JWT>";
//      the token is validated against the site's own GoTrue endpoint
//      (/.netlify/identity/user) and the stable Identity user id becomes the
//      namespace. Open self-registration and password resets are handled by
//      Identity itself.
//   2. Cookie gate — the sign-in cookie set by
//      netlify/edge-functions/editor-auth.js holds "<user>:<token>" where the
//      token is a SHA-256 derived from that user's password (EDITOR_USERS
//      "alice:pw1,bob:pw2"; EDITOR_PASSWORD is the reserved "admin"
//      account's password).
//
//   GET    /api/decks          → { items: [{id, title, updatedAt, deleted?}] }
//   GET    /api/decks?id=X     → { deck }
//   PUT    /api/decks?id=X     → body { deck, updatedAt } — upsert
//   DELETE /api/decks?id=X     → tombstones the deck (so deletions sync too)
//
// All four operate only on the authenticated user's namespace — one user can
// never list, read or write another user's decks.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const PEPPER = "studio-editor-gate-v1";
const COOKIE = "studio_auth";
const MANIFEST = "__manifest__";
const ID_RE = /^[a-z0-9_-]{1,64}$/i;
const USER_RE = /^[a-z0-9_-]{1,32}$/i;

// "admin"/"default" are reserved: never read from EDITOR_USERS.
// EDITOR_PASSWORD is the admin credential; "default" is its legacy alias.
function parseUsers() {
  const map = new Map();
  const multiSrc = process.env.EDITOR_USERS;
  if (multiSrc) {
    for (const pair of multiSrc.split(",")) {
      const i = pair.indexOf(":");
      if (i < 1) continue;
      const name = pair.slice(0, i).trim();
      const pw = pair.slice(i + 1).trim();
      const lower = name.toLowerCase();
      if (USER_RE.test(name) && pw && lower !== "admin" && lower !== "default") map.set(name, pw);
    }
  }
  const single = process.env.EDITOR_PASSWORD;
  if (single) { map.set("admin", single); map.set("default", single); }
  return map;
}

const tokenFor = (user, password) =>
  crypto.createHash("sha256").update(`${PEPPER}:${user}:${password}`).digest("hex");

// → cookie-gate username, or null.
function cookieAuthedUser(req) {
  const map = parseUsers();
  if (!map.size) return null;
  const part = (req.headers.get("cookie") || "").split(/; */).find((p) => p.trim().startsWith(COOKIE + "="));
  const raw = part ? decodeURIComponent(part.trim().slice(COOKIE.length + 1)) : "";
  const i = raw.indexOf(":");
  if (i < 1) return null;
  const user = raw.slice(0, i), hash = raw.slice(i + 1);
  const pw = map.get(user);
  if (!pw) return null;
  const expected = tokenFor(user, pw);
  if (hash.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected)) ? user : null;
}

// → Netlify Identity user id, or null. The bearer token is validated by
// asking the site's own GoTrue instance who it belongs to — no shared JWT
// secret needed, and revoked/expired tokens fail naturally.
async function identityAuthedUser(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  if (!m) return null;
  const base = process.env.URL || new URL(req.url).origin;
  try {
    const r = await fetch(base + "/.netlify/identity/user", { headers: { Authorization: "Bearer " + m[1] } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && typeof u.id === "string" && /^[a-f0-9-]{16,64}$/i.test(u.id) ? u.id : null;
  } catch { return null; }
}

export default async (req) => {
  // Identity first (namespace prefixed "iduser:" so a UUID can never collide
  // with a cookie-gate username), then the cookie gate.
  let prefix = null;
  const idUser = await identityAuthedUser(req);
  if (idUser) prefix = `iduser:${idUser}`;
  else {
    const cUser = cookieAuthedUser(req);
    // The admin account keeps the former "default" user's namespace so data
    // from before the admin rename stays in place.
    if (cUser) prefix = `user:${cUser === "admin" ? "default" : cUser}`;
  }
  if (!prefix) return Response.json({ error: "unauthorized" }, { status: 401 });

  const store = getStore("studio-decks");
  const k = (s) => `${prefix}:${s}`; // per-user namespace
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
