// Login gate for the editor tools (copy editor + presentation studio) and
// the other protected NorthStar pages. The rest of the site stays public.
//
// Why a form + cookie instead of HTTP Basic Auth?
// The native Basic-Auth popup is suppressed in many corporate environments:
// security proxies strip the `WWW-Authenticate` header (so the browser just
// renders a bare 401 body and never prompts), and some managed browsers disable
// the Basic scheme by policy. A normal HTTPS form + cookie works everywhere.
//
// Configure in the Netlify site's environment variables:
//   EDITOR_USERS     comma-separated "username:password" pairs, e.g.
//                    "alice:s3cret,bob:hunter2". Each user signs in with their
//                    own credentials; in the Presentation Studio each user
//                    sees/edits only their own decks (netlify/functions/
//                    decks.mjs). Usernames: letters, digits, "_" or "-",
//                    max 32 chars ("admin" is reserved — entries with that
//                    name are ignored). Sign out via any gated URL +
//                    ?signout=1.
//   EDITOR_PASSWORD  the ADMIN credential. With EDITOR_USERS set, signing in
//                    as username "admin" with this password opens the admin
//                    account, which owns the original shared deck library
//                    (the legacy unnamespaced storage). Without EDITOR_USERS
//                    it is the only account (password-only form, legacy
//                    cookie format and storage keys unchanged, so existing
//                    sessions and decks keep working).
//   Neither set → the gated pages stay locked (503).
//
// On success a token is stored in an HttpOnly, Secure cookie — in shared mode
// SHA-256 of the password + a static pepper (legacy format); in multi-user
// mode "<user>:<SHA-256 of pepper+user+password>", plus a readable
// ns_editor_user cookie so the Studio can scope its local storage per user.
// The password itself is never stored client-side.

const COOKIE = "ns_editor_auth";
const USER_COOKIE = "ns_editor_user";
const PEPPER = "northstar-editor-gate-v1";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const USER_RE = /^[a-z0-9_-]{1,32}$/i;

// → Map<user, password> when EDITOR_USERS is set, else null (shared mode).
// "admin" is reserved: it is never read from EDITOR_USERS, and exists exactly
// when EDITOR_PASSWORD is set — that password IS the admin credential.
function parseUsers(env) {
  const multi = env.get("EDITOR_USERS");
  if (!multi) return null;
  const map = new Map();
  for (const pair of multi.split(",")) {
    const i = pair.indexOf(":");
    if (i < 1) continue;
    const name = pair.slice(0, i).trim();
    const pw = pair.slice(i + 1).trim();
    if (USER_RE.test(name) && pw && name.toLowerCase() !== "admin") map.set(name, pw);
  }
  const adminPw = env.get("EDITOR_PASSWORD");
  if (adminPw) map.set("admin", adminPw);
  return map.size ? map : null;
}

async function sha256Hex(s) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const tokenShared = (password) => sha256Hex(`${PEPPER}:${password}`);          // legacy single-password format
const tokenUser = (user, password) => sha256Hex(`${PEPPER}:${user}:${password}`);

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

// The form has no `action`, so it posts back to whatever gated path served it.
function loginPage(multi, failed) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/><title>NorthStar protected zone · Sign in</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
 background:radial-gradient(circle at 70% 20%,rgba(0,212,255,.10),transparent 55%),radial-gradient(circle at 20% 80%,rgba(153,10,227,.18),transparent 55%),#29003E;
 color:#F4E0FF;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}
.card{width:340px;max-width:90vw;background:linear-gradient(180deg,rgba(244,224,255,.06),rgba(244,224,255,.02));
 border:1px solid rgba(244,224,255,.15);border-radius:18px;padding:30px 26px;box-shadow:0 20px 60px rgba(0,0,0,.4);}
.brand{font-weight:700;letter-spacing:.5px;color:#00D4FF;font-size:16px;margin-bottom:10px;}
.sub{margin:0 0 18px;color:rgba(244,224,255,.65);font-size:13.5px;line-height:1.5;}
.err{background:rgba(255,82,82,.12);border:1px solid rgba(255,82,82,.5);color:#FF8A8A;border-radius:9px;padding:8px 12px;font-size:12.5px;margin-bottom:14px;}
.pw{width:100%;font:inherit;font-size:15px;padding:11px 13px;border-radius:10px;border:1px solid rgba(244,224,255,.2);background:rgba(0,0,0,.3);color:#fff;margin-bottom:14px;}
.pw:focus{outline:none;border-color:#00D4FF;}
.go{width:100%;font:inherit;font-weight:600;font-size:15px;padding:11px;border-radius:10px;border:0;cursor:pointer;background:#990AE3;color:#fff;transition:background .15s;}
.go:hover{background:#b01ff5;}
</style></head>
<body>
 <form class="card" method="post" autocomplete="on">
  <div class="brand">◆ NorthStar protected zone</div>
  <p class="sub">${multi ? "Sign in to continue." : "Enter password to continue."}</p>
  ${failed ? '<div class="err">Incorrect credentials — please try again.</div>' : ""}
  ${multi ? '<input class="pw" type="text" name="username" placeholder="Username" autofocus autocomplete="username" required/>' : ""}
  <input class="pw" type="password" name="password" placeholder="Password" ${multi ? "" : "autofocus"} autocomplete="current-password" required/>
  <button class="go" type="submit">Sign in</button>
 </form>
</body></html>`;
}

const htmlHeaders = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

export default async (request, context) => {
  const users = parseUsers(Netlify.env);
  const password = Netlify.env.get("EDITOR_PASSWORD");
  if (!users && !password) return new Response("Editor access is not configured.", { status: 503 });

  const url = new URL(request.url);

  // Sign out: clear the cookies and reload the page without the parameter.
  if (url.searchParams.has("signout")) {
    url.searchParams.delete("signout");
    const headers = new Headers({ "Location": url.pathname + url.search, "Cache-Control": "no-store" });
    headers.append("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    headers.append("Set-Cookie", `${USER_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0`);
    return new Response(null, { status: 303, headers });
  }

  const raw = readCookie(request.headers.get("cookie"), COOKIE) || "";

  // Already signed in?
  if (users) {
    const i = raw.indexOf(":");
    if (i > 0) {
      const user = raw.slice(0, i);
      const pw = users.get(user);
      if (pw && constantEquals(raw.slice(i + 1), await tokenUser(user, pw))) return context.next();
    }
  } else if (constantEquals(raw, await tokenShared(password))) {
    return context.next();
  }

  // Handle a sign-in submission.
  if (request.method === "POST") {
    let username = "", supplied = "";
    try {
      const form = await request.formData();
      supplied = String(form.get("password") || "");
      username = String(form.get("username") || "").trim();
    } catch { /* ignore */ }

    const headers = new Headers({ "Location": url.pathname + url.search, "Cache-Control": "no-store" });
    if (users) {
      const pw = users.get(username);
      if (pw && supplied && constantEquals(await tokenUser(username, supplied), await tokenUser(username, pw))) {
        headers.append("Set-Cookie", `${COOKIE}=${encodeURIComponent(`${username}:${await tokenUser(username, pw)}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
        headers.append("Set-Cookie", `${USER_COOKIE}=${encodeURIComponent(username)}; Path=/; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
        return new Response(null, { status: 303, headers });
      }
    } else if (supplied && constantEquals(await tokenShared(supplied), await tokenShared(password))) {
      headers.append("Set-Cookie", `${COOKIE}=${await tokenShared(password)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
      headers.append("Set-Cookie", `${USER_COOKIE}=admin; Path=/; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
      return new Response(null, { status: 303, headers });
    }
    return new Response(loginPage(!!users, true), { status: 401, headers: htmlHeaders });
  }

  // Otherwise show the login form.
  return new Response(loginPage(!!users, false), { status: 200, headers: htmlHeaders });
};
