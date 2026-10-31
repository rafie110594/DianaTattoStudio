import { handleUpload } from "@vercel/blob/client";
import { sessionFromRequest } from "../lib/auth.mjs";

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];

const send = (res, code, body) => {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

/* pathname must stay inside the media/ namespace, no traversal */
function isAllowedPath(pathname) {
  if (typeof pathname !== "string" || pathname.length > 200) return false;
  if (pathname.includes("..") || pathname.startsWith("/")) return false;
  return /^media\/[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*\/[a-z0-9][a-z0-9._-]*\.(jpe?g|png|webp|mp4|webm)$/i.test(pathname);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  const session = sessionFromRequest(req);
  if (!session) return send(res, 401, { error: "Sesi tidak valid" });

  let body;
  try {
    body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
  } catch {
    return send(res, 400, { error: "Body tidak valid" });
  }

  try {
    const result = await handleUpload({
      body,
      request: {
        headers: req.headers,
        url: `https://${req.headers.host || "localhost"}${req.url || "/api/blob-upload"}`
      },
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try {
          payload = clientPayload ? JSON.parse(clientPayload) : {};
        } catch {
          payload = {};
        }
        if (payload.csrf !== session.csrf) throw new Error("CSRF tidak valid");
        if (!isAllowedPath(pathname)) throw new Error("Path file tidak diizinkan");

        const isVideo = /\.(mp4|webm)$/i.test(pathname);
        return {
          allowedContentTypes: isVideo ? VIDEO_TYPES : IMAGE_TYPES,
          maximumSizeInBytes: isVideo ? MAX_VIDEO : MAX_IMAGE,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 30
        };
      }
    });
    return send(res, 200, result);
  } catch (e) {
    return send(res, 400, { error: e.message || "Upload gagal" });
  }
}
