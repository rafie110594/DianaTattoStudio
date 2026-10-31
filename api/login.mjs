import { createSession, sessionCookie, checkCredentials, rateLimit, clientIp } from "../lib/auth.mjs";

const json = (res, code, body, headers = {}) => {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const ip = clientIp(req);
  const limit = rateLimit(`login:${ip}`, 5, 60_000);
  if (!limit.ok) {
    return json(res, 429, { error: "Terlalu banyak percobaan. Coba lagi nanti." }, { "Retry-After": String(limit.retryAfter) });
  }

  let body = {};
  try {
    body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
  } catch {
    return json(res, 400, { error: "Body tidak valid" });
  }

  let ok = false;
  try {
    ok = checkCredentials(body.username, body.password);
  } catch {
    return json(res, 500, { error: "Server belum dikonfigurasi" });
  }
  if (!ok) return json(res, 401, { error: "Username atau password salah" });

  const s = createSession(body.username);
  return json(
    res,
    200,
    { ok: true, csrf: s.csrf, exp: s.exp, user: s.user },
    { "Set-Cookie": sessionCookie(s.token) }
  );
}
