// HTTP Basic Auth gate for the copy editor only — the rest of the site stays public.
// Configure these in the Netlify site's environment variables:
//   EDITOR_PASSWORD  (required) — the password
//   EDITOR_USER      (optional) — the username, defaults to "editor"
// With no EDITOR_PASSWORD set the editor stays locked (fails closed).
export default async (request, context) => {
  const user = Netlify.env.get("EDITOR_USER") || "editor";
  const password = Netlify.env.get("EDITOR_PASSWORD");

  if (!password) {
    return new Response("Copy editor access is not configured.", { status: 503 });
  }

  const header = request.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try { decoded = atob(encoded); } catch (_) { decoded = ""; }
    const sep = decoded.indexOf(":");
    if (sep !== -1 && decoded.slice(0, sep) === user && decoded.slice(sep + 1) === password) {
      return context.next();
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Copy editor", charset="UTF-8"' },
  });
};
