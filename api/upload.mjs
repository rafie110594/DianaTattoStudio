import crypto from "node:crypto";
import { sessionFromRequest, requireCsrf } from "../lib/auth.mjs";
import { createBlob, contentHash } from "../lib/github.mjs";

function detect(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  const session = sessionFromRequest(req);
  if (!session || !requireCsrf(req, session)) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Sesi tidak valid" }));
    return;
  }

  let body = {};
  try {
    body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Body tidak valid" }));
    return;
  }

  const buf = Buffer.from(String(body.base64 || ""), "base64");
  if (buf.length === 0 || buf.length > 3_000_000) {
    res.statusCode = 413;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "File harus 1 byte s/d 3 MB" }));
    return;
  }

  const type = detect(buf);
  if (!type) {
    res.statusCode = 415;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Hanya JPEG, PNG, atau WebP" }));
    return;
  }

  const folder = String(body.folder || "gallery").replace(/[^a-z0-9-]/g, "");
  const slug = String(body.slug || "img").replace(/[^a-z0-9-]/g, "");
  const name = `${slug}-${contentHash(buf)}.${type.ext}`;
  const path = `assets/img/${folder}/${name}`;

  try {
    const blob = await createBlob(buf.toString("base64"), "base64");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ sha: blob.sha, path, type: type.ext }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Upload gagal ke GitHub: " + (e.message || "") }));
  }
}