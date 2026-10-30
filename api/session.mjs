import { sessionFromRequest } from "../lib/auth.mjs";

export default async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const session = sessionFromRequest(req);
  if (!session) {
    res.end(JSON.stringify({ ok: false }));
    return;
  }
  res.end(JSON.stringify({ ok: true, csrf: session.csrf, exp: session.exp }));
}
