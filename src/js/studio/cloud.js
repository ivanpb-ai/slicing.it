// ─────────────────────────────────────────────────────────────────────────
// Cloud sync — keeps the Studio's deck library identical on every device.
//
// localStorage stays the working store (fast, offline-capable); this module
// mirrors it against /api/decks (a Netlify Function backed by Netlify Blobs,
// gated by the same editor sign-in cookie). Strategy: last-writer-wins by
// updatedAt, with tombstones so deletions propagate. When the API is
// unreachable (local static preview, offline) everything degrades to
// device-local behaviour.
// ─────────────────────────────────────────────────────────────────────────
import { loadManifest, loadDeckById, saveDeckToLib, deleteDeckFromLib, validateDeck } from "./model";

const API = "/api/decks";
const SKEW = 1500; // ms of clock tolerance between devices

async function req(method, id, body) {
  const r = await fetch(API + (id ? "?id=" + encodeURIComponent(id) : ""), {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
  return r.json();
}

export const cloudPut = (deck, updatedAt) => req("PUT", deck.id, { deck, updatedAt });
export const cloudDelete = (id) => req("DELETE", id).catch(() => {});

// Two-way merge. Returns { pulled: [ids], ok: true } or throws (401 / network).
export async function syncLibrary(currentId) {
  const remote = ((await req("GET")).items || []);
  const local = loadManifest().items;
  const pulled = [];

  for (const r of remote) {
    const l = local.find((x) => x.id === r.id);
    if (r.deleted) {
      // Deletion wins over an older local copy — but never the deck open now.
      if (l && r.id !== currentId && (r.updatedAt || 0) > (l.updatedAt || 0)) deleteDeckFromLib(r.id);
      continue;
    }
    if (!l || (r.updatedAt || 0) > (l.updatedAt || 0) + SKEW) {
      try {
        const got = await req("GET", r.id);
        const deck = validateDeck(got.deck);
        if (deck) {
          saveDeckToLib({ ...deck, id: r.id }, { updatedAt: r.updatedAt || Date.now(), makeCurrent: false });
          pulled.push(r.id);
        }
      } catch { /* skip this deck, keep syncing the rest */ }
    }
  }

  for (const l of local) {
    const r = remote.find((x) => x.id === l.id);
    if (r && r.deleted && (r.updatedAt || 0) >= (l.updatedAt || 0)) continue; // respect tombstone
    if (!r || r.deleted || (l.updatedAt || 0) > (r.updatedAt || 0) + SKEW) {
      const deck = loadDeckById(l.id);
      if (deck) await cloudPut(deck, l.updatedAt || Date.now()).catch(() => {});
    }
  }

  return { pulled };
}

// ── Welcome-deck template ──────────────────────────────────────────────────
// Site-global default deck: any signed-in user reads it (a new library is
// seeded from it); only admin can publish it. Null when none is set or the
// API is unreachable — callers fall back to the built-in starter.
export async function cloudGetTemplate() {
  try {
    const r = await fetch(API + "?template=1", { credentials: "same-origin" });
    if (!r.ok) return null;
    return (await r.json()).deck || null;
  } catch { return null; }
}

export async function cloudPutTemplate(deck) {
  const r = await fetch(API + "?template=1", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deck }),
  });
  if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
  return r.json();
}
