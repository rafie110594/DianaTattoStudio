import { clearCookie } from "./_lib/auth.mjs";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  /* POST only: a plain GET link must not be able to log the admin out (CSRF) */
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  res.statusCode = 200;
  res.setHeader("Set-Cookie", clearCookie());
  res.end(JSON.stringify({ ok: true }));
}
