import crypto from "node:crypto";

const COOKIE = "dts_admin";
const TTL_MS = 12 * 60 * 60 * 1000;

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("ADMIN_SESSION_SECRET missing or too short");
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payloadB64) {
  return b64url(crypto.createHmac("sha256", secret()).update(payloadB64).digest());
}

export function createSession() {
  const payload = { exp: Date.now() + TTL_MS, csrf: crypto.randomBytes(16).toString("hex") };
  const payloadB64 = b64url(JSON.stringify(payload));
  return { token: `${payloadB64}.${sign(payloadB64)}`, csrf: payload.csrf, exp: payload.exp };
}

export function readSession(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload;
}

export function sessionFromRequest(req) {
  const raw = req.headers.cookie || "";
  const found = raw
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!found) return null;
  return readSession(decodeURIComponent(found.slice(COOKIE.length + 1)));
}

export function sessionCookie(token) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${
    TTL_MS / 1000
  }`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD not configured");
  const a = Buffer.from(String(input ?? ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    /* still spend comparable time to avoid trivial length oracle */
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function requireCsrf(req, session) {
  const header = req.headers["x-csrf"] || req.headers["X-CSRF"];
  return Boolean(session && header && session.csrf === header);
}

/* simple in-memory rate limit (per warm lambda instance) */
const hits = new Map();
export function rateLimit(key, max = 5, windowMs = 60_000) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  entry.count += 1;
  if (entry.count > max) return { ok: false, remaining: 0, retryAfter: Math.ceil((entry.reset - now) / 1000) };
  return { ok: true, remaining: max - entry.count };
}

export function clientIp(req) {
  const f = req.headers["x-forwarded-for"];
  if (typeof f === "string" && f.length) return f.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}
