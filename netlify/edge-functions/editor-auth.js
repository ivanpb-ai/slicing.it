// Login gate for the editor tools (copy editor + presentation studio).
// The rest of the site stays public.
//
// Why a form + cookie instead of HTTP Basic Auth?
// The native Basic-Auth popup is suppressed in many corporate environments:
// security proxies strip the `WWW-Authenticate` header (so the browser just
// renders a bare 401 body and never prompts), and some managed browsers disable
// the Basic scheme by policy. A normal HTTPS form + cookie works everywhere.
//
// Configure in the Netlify site's environment variables:
//   EDITOR_PASSWORD  (required) — the shared password. Unset → tools stay locked.
//
// On success, a token (SHA-256 of the password + a static pepper) is stored in
// an HttpOnly, Secure cookie; the password itself is never stored client-side.

const COOKIE = "ns_editor_auth";
const PEPPER = "northstar-editor-gate-v1";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function tokenFor(password) {
  const bytes = new TextEncoder().encode(`${PEPPER}:${password}`);
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

// The form has no `action`, so it posts back to whatever gated path served it.
function loginPage(failed) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/><title>NorthStar editor · Sign in</title>
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
  <p class="sub">Enter the editor password to continue.</p>
  ${failed ? '<div class="err">Incorrect password — please try again.</div>' : ""}
  <input class="pw" type="password" name="password" placeholder="Password" autofocus autocomplete="current-password" required/>
  <button class="go" type="submit">Sign in</button>
 </form>
</body></html>`;
}

const htmlHeaders = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

export default async (request, context) => {
  const password = Netlify.env.get("EDITOR_PASSWORD");
  if (!password) return new Response("Editor access is not configured.", { status: 503 });

  const expected = await tokenFor(password);

  // Already signed in?
  if (constantEquals(readCookie(request.headers.get("cookie"), COOKIE) || "", expected)) {
    return context.next();
  }

  // Handle a sign-in submission.
  if (request.method === "POST") {
    let supplied = "";
    try { supplied = String((await request.formData()).get("password") || ""); } catch { /* ignore */ }
    if (supplied && constantEquals(await tokenFor(supplied), expected)) {
      const url = new URL(request.url);
      return new Response(null, {
        status: 303,
        headers: {
          "Location": url.pathname + url.search,
          "Set-Cookie": `${COOKIE}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`,
          "Cache-Control": "no-store",
        },
      });
    }
    return new Response(loginPage(true), { status: 401, headers: htmlHeaders });
  }

  // Otherwise show the login form.
  return new Response(loginPage(false), { status: 200, headers: htmlHeaders });
};
