import { clearCookie } from "../lib/auth.mjs";

export default async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", clearCookie());
  res.end(JSON.stringify({ ok: true }));
}
