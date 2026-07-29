// Optional login gate for the editor, with per-user accounts.
//
// Why a form + cookie instead of HTTP Basic Auth?
// The native Basic-Auth popup is suppressed in many corporate environments:
// security proxies strip the `WWW-Authenticate` header (so the browser just
// renders a bare 401 body and never prompts), and some managed browsers disable
// the Basic scheme by policy. A normal HTTPS form + cookie works everywhere.
//
// Configure in the Netlify site's environment variables (pick one):
//   EDITOR_USERS     comma-separated "username:password" pairs, e.g.
//                    "alice:s3cret,bob:hunter2". Each user signs in with their
//                    own credentials and sees/edits only their own decks
//                    (see netlify/functions/decks.mjs). Usernames: letters,
//                    digits, "_" or "-", max 32 chars.
//                    "admin" and "default" are reserved — entries with those
//                    names are ignored.
//   EDITOR_PASSWORD  the ADMIN credential: username "admin" signs in with it
//                    (alongside EDITOR_USERS, or via a password-only form
//                    when EDITOR_USERS is unset). For data continuity the
//                    admin account keeps the storage namespace of the former
//                    "default" user, and old "default" cookies stay valid.
//   Neither set → the editor is public and decks stay device-local.
//
// On success two cookies are set: studio_auth (HttpOnly) carrying
// "<user>:<SHA-256 of pepper+user+password>", and studio_user (readable) so
// the client can namespace its local storage per user. The password itself is
// never stored client-side. Any URL with ?signout=1 clears both cookies.

const AUTH_COOKIE = "studio_auth";
const USER_COOKIE = "studio_user";
const PEPPER = "studio-editor-gate-v1";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const USER_RE = /^[a-z0-9_-]{1,32}$/i;

// → { map: Map<user, password>, multi: boolean }. "admin"/"default" are
// reserved: never read from EDITOR_USERS. EDITOR_PASSWORD is the admin
// credential; "default" is its legacy alias so pre-admin cookies keep working.
function parseUsers(env) {
  const map = new Map();
  const multiSrc = env.get("EDITOR_USERS");
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
  const single = env.get("EDITOR_PASSWORD");
  if (single) { map.set("admin", single); map.set("default", single); }
  return { map, multi: !!multiSrc };
}

async function tokenFor(user, password) {
  const bytes = new TextEncoder().encode(`${PEPPER}:${user}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(header, name) {
  for (const part of (header || "").split(/; */)) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// The auth cookie is "<user>:<token>"; returns the username or null.
async function authedUser(cookieHeader, map) {
  const raw = readCookie(cookieHeader, AUTH_COOKIE) || "";
  const i = raw.indexOf(":");
  if (i < 1) return null;
  const user = raw.slice(0, i);
  const pw = map.get(user);
  if (!pw) return null;
  return constantEquals(raw.slice(i + 1), await tokenFor(user, pw)) ? user : null;
}

// The form has no `action`, so it posts back to whatever gated path served it.
function loginPage(multi, failed) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/><title>Presentation Studio · Sign in</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
 background:radial-gradient(circle at 70% 20%,rgba(0,212,255,.10),transparent 55%),radial-gradient(circle at 20% 80%,rgba(108,92,231,.18),transparent 55%),#0B1026;
 color:#E9ECFF;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}
.card{width:340px;max-width:90vw;background:linear-gradient(180deg,rgba(233,236,255,.06),rgba(233,236,255,.02));
 border:1px solid rgba(233,236,255,.15);border-radius:18px;padding:30px 26px;box-shadow:0 20px 60px rgba(0,0,0,.4);}
.brand{font-weight:700;letter-spacing:.5px;color:#00D4FF;font-size:16px;margin-bottom:10px;}
.sub{margin:0 0 18px;color:rgba(233,236,255,.65);font-size:13.5px;line-height:1.5;}
.err{background:rgba(255,82,82,.12);border:1px solid rgba(255,82,82,.5);color:#FF8A8A;border-radius:9px;padding:8px 12px;font-size:12.5px;margin-bottom:14px;}
.pw{width:100%;font:inherit;font-size:15px;padding:11px 13px;border-radius:10px;border:1px solid rgba(233,236,255,.2);background:rgba(0,0,0,.3);color:#fff;margin-bottom:14px;}
.pw:focus{outline:none;border-color:#00D4FF;}
.go{width:100%;font:inherit;font-weight:600;font-size:15px;padding:11px;border-radius:10px;border:0;cursor:pointer;background:#6C5CE7;color:#fff;transition:background .15s;}
.go:hover{background:#7D6EF5;}
</style></head>
<body>
 <form class="card" method="post" autocomplete="on">
  <div class="brand">◆ Presentation Studio</div>
  <p class="sub">${multi ? "Sign in to your presentations." : "Enter password to continue."}</p>
  ${failed ? '<div class="err">Incorrect credentials — please try again.</div>' : ""}
  ${multi ? '<input class="pw" type="text" name="username" placeholder="Username" autofocus autocomplete="username" required/>' : ""}
  <input class="pw" type="password" name="password" placeholder="Password" ${multi ? "" : "autofocus"} autocomplete="current-password" required/>
  <button class="go" type="submit">Sign in</button>
 </form>
</body></html>`;
}

const htmlHeaders = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

export default async (request, context) => {
  const { map, multi } = parseUsers(Netlify.env);
  if (!map.size) return context.next(); // no accounts configured — stay open

  const url = new URL(request.url);

  // Sign out: clear both cookies and reload the page without the parameter.
  if (url.searchParams.has("signout")) {
    url.searchParams.delete("signout");
    const headers = new Headers({ "Location": url.pathname + url.search, "Cache-Control": "no-store" });
    headers.append("Set-Cookie", `${AUTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    headers.append("Set-Cookie", `${USER_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0`);
    return new Response(null, { status: 303, headers });
  }

  // Already signed in?
  if (await authedUser(request.headers.get("cookie"), map)) return context.next();

  // Handle a sign-in submission.
  if (request.method === "POST") {
    let user = "admin", supplied = "";
    try {
      const form = await request.formData();
      supplied = String(form.get("password") || "");
      if (multi) user = String(form.get("username") || "").trim();
    } catch { /* ignore */ }
    const pw = map.get(user);
    if (pw && supplied && constantEquals(await tokenFor(user, supplied), await tokenFor(user, pw))) {
      const token = await tokenFor(user, pw);
      const headers = new Headers({ "Location": url.pathname + url.search, "Cache-Control": "no-store" });
      headers.append("Set-Cookie", `${AUTH_COOKIE}=${encodeURIComponent(`${user}:${token}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
      headers.append("Set-Cookie", `${USER_COOKIE}=${encodeURIComponent(user)}; Path=/; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
      return new Response(null, { status: 303, headers });
    }
    return new Response(loginPage(multi, true), { status: 401, headers: htmlHeaders });
  }

  // Otherwise show the login form.
  return new Response(loginPage(multi, false), { status: 200, headers: htmlHeaders });
};
