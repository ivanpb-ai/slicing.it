// ─────────────────────────────────────────────────────────────────────────
// Client-side auth: one place that answers "who is using the editor?".
//
// Three modes, detected automatically:
//   identity  Netlify Identity is enabled on the site → open self-
//             registration, password resets and dozens of users, all handled
//             by the Identity widget. API calls carry the user's JWT; local
//             storage is scoped by the stable Identity user id.
//   cookie    the EDITOR_USERS / EDITOR_PASSWORD gate (see
//             netlify/edge-functions/editor-auth.js) set a readable
//             "studio_user" cookie at sign-in.
//   open      neither — the editor is public and storage is unscoped.
//
// initAuth() must resolve before any studio module is imported (model.js
// reads storageScope() at module-init time); studio-entry.jsx guarantees
// this by importing the app dynamically.
// ─────────────────────────────────────────────────────────────────────────
import netlifyIdentity from "netlify-identity-widget";

const USER_RE = /^[a-z0-9_-]{1,32}$/i;

let mode = "open";        // "identity" | "cookie" | "open"
let identityUser = null;  // netlify-identity-widget user object

function cookieUser() {
  try {
    const m = document.cookie.match(/(?:^|;\s*)studio_user=([^;]+)/);
    const u = m ? decodeURIComponent(m[1]) : "";
    return USER_RE.test(u) ? u : "";
  } catch { return ""; }
}

// Detect Identity by probing GoTrue's public settings endpoint — it only
// exists (as JSON) when Identity is enabled for the site.
async function identityEnabled() {
  try {
    const r = await fetch("/.netlify/identity/settings", { headers: { accept: "application/json" } });
    return r.ok && (r.headers.get("content-type") || "").includes("json");
  } catch { return false; }
}

// → { mode, user } — user is null in identity mode until someone signs in
// (studio-entry.jsx shows the sign-in gate in that case).
export async function initAuth() {
  if (await identityEnabled()) {
    mode = "identity";
    netlifyIdentity.init();
    // Reloading after login/logout re-derives the storage scope and cloud
    // session from scratch — much simpler than hot-swapping libraries.
    netlifyIdentity.on("login", () => { netlifyIdentity.close(); window.location.reload(); });
    netlifyIdentity.on("logout", () => window.location.reload());
    identityUser = netlifyIdentity.currentUser();
    return { mode, user: identityUser };
  }
  mode = cookieUser() ? "cookie" : "open";
  return { mode, user: null };
}

// Opens the Identity widget (sign in / sign up / recover password).
export function openLogin() { netlifyIdentity.open(); }

// Namespace for localStorage keys. Identity ids are UUIDs — prefixed so they
// can never collide with a cookie-mode username.
export function storageScope() {
  if (mode === "identity" && identityUser) return "id-" + identityUser.id;
  if (mode === "cookie") return cookieUser();
  return "";
}

// Short human-readable name for the signed-in user ("" when anonymous).
export function userLabel() {
  if (mode === "identity" && identityUser) return identityUser.user_metadata?.full_name || identityUser.email || "signed in";
  if (mode === "cookie") return cookieUser();
  return "";
}

export function canSignOut() { return (mode === "identity" && !!identityUser) || mode === "cookie"; }

export function doSignOut() {
  if (mode === "identity") { netlifyIdentity.logout(); return; }
  if (mode === "cookie") window.location.href = "?signout=1";
}

// Extra headers for /api/decks calls. In identity mode user.jwt() returns a
// fresh access token (auto-refreshing via the stored refresh token); cookie
// mode relies on the HttpOnly cookie instead.
export async function authHeader() {
  const u = mode === "identity" ? netlifyIdentity.currentUser() : null;
  if (!u) return {};
  try { return { Authorization: "Bearer " + (await u.jwt()) }; }
  catch { return {}; }
}
