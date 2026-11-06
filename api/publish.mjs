import { sessionFromRequest, requireCsrf } from "./_lib/auth.mjs";
import { validateSite, ValidationError } from "./_lib/site-schema.mjs";
import { renderSite, siteDataScript } from "./_lib/render.mjs";
import { commitFiles, readTextFile, listFiles } from "./_lib/github.mjs";
import { del, list } from "@vercel/blob";

const AUTHOR = { name: "Diana Admin", email: "admin@diana-tatto.studio" };
const MAX_DIFF_LINES = 40;

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function diffUnified(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");
  const out = [];
  const iMax = Math.max(a.length, b.length);
  for (let i = 0; i < iMax; i++) {
    if (a[i] !== b[i]) {
      out.push(`- ${a[i] ?? ""}`);
      out.push(`+ ${b[i] ?? ""}`);
    }
  }
  return out.length > MAX_DIFF_LINES ? out.slice(0, MAX_DIFF_LINES).concat(["... (dipotong)"]) : out;
}

function summarize(site) {
  const parts = [];
  if (site.marquee?.length) parts.push("marquee");
  if (site.stats?.length) parts.push("stats");
  if (site.gallery?.length) parts.push("galeri");
  if (site.styles?.length) parts.push("gaya & foto");
  if (site.location) parts.push("lokasi");
  if (site.contact?.length) parts.push("kontak");
  return parts.join(", ") || "konten";
}

function normalizeSiteDiff(site) {
  const out = { ...site, marquee: site.marquee?.slice(0, 3) };
  if (site.styles) out.styles = site.styles.map((s) => ({ ...s, name: s.name, photos: undefined }));
  return out;
}

/* every media reference in a site document */
function collectRefs(site) {
  const refs = new Set();
  const add = (src) => {
    if (typeof src === "string" && src) refs.add(src);
  };
  add(site.hero?.video?.src);
  (site.gallery || []).forEach((g) => add(g.src));
  (site.styles || []).forEach((s) => (s.photos || []).forEach((p) => add(p.src)));
  add(site.location?.photo?.src);
  return refs;
}

const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
const isBlob = (src) => BLOB_HOST.test(src);
const isRepo = (src) => src.startsWith("assets/img/") || src.startsWith("assets/video/");

/* repo assets that must never be swept away: they are the built-in fallback */
const KEEP_REPO = new Set(["assets/video/cinematic.mp4"]);

/* every blob we own that the new site no longer references */
async function findOrphanBlobs(newSite, { graceMs = 0 } = {}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const after = collectRefs(newSite);
  const cutoff = Date.now() - graceMs;
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: "media/", cursor });
    for (const b of page.blobs) {
      if (after.has(b.url)) continue;
      if (graceMs && b.uploadedAt && new Date(b.uploadedAt).getTime() > cutoff) continue;
      out.push(b.url);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

/* media that existed before but is no longer referenced */
async function findOrphans(oldSite, newSite, { deep = true } = {}) {
  const before = collectRefs(oldSite);
  const after = collectRefs(newSite);

  const blobs = [...before].filter((s) => isBlob(s) && !after.has(s));
  const repoCandidates = new Set([...before].filter((s) => isRepo(s) && !after.has(s)));

  /* also drop files in managed folders that no longer appear anywhere in the new site */
  if (deep) {
    const dirs = ["assets/img/ring", "assets/img/styles", "assets/img/location", "assets/video"];
    const listings = await Promise.all(
      dirs.map((dir) =>
        listFiles(dir).catch(() => [])
      )
    );
    for (const files of listings) {
      for (const f of files) {
        if (!after.has(f)) repoCandidates.add(f);
      }
    }
  }

  return { blobs, repo: [...repoCandidates].filter((f) => !KEEP_REPO.has(f) && /\.(jpe?g|png|webp|mp4|webm)$/i.test(f)) };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const session = sessionFromRequest(req);
  if (!session || !requireCsrf(req, session)) return send(res, 401, { error: "Sesi tidak valid" });

  let body = {};
  try {
    body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
  } catch {
    return send(res, 400, { error: "Body tidak valid" });
  }

  let site;
  try {
    site = validateSite(body.site);
  } catch (e) {
    return send(res, 422, { error: e instanceof ValidationError ? e.message : "Data situs tidak valid" });
  }

  const uploads = (Array.isArray(body.files) ? body.files : []).map((f) =>
    typeof f === "string" ? { path: f } : f
  );
  const deletes = (Array.isArray(body.deletes) ? body.deletes : []).map((f) =>
    typeof f === "string" ? { path: f } : f
  );
  const pathRe = /^assets\/(img|video)\/[A-Za-z0-9_\-./]+\.(jpe?g|png|webp|mp4|webm)$/;
  for (const f of [...uploads, ...deletes]) {
    if (!f || !pathRe.test(f.path) || f.path.includes("..")) return send(res, 422, { error: `Path file tidak valid: ${f && f.path}` });
  }

  let repoHtml = {};
  let oldSite = null;
  try {
    for (const page of ["index.html", "location.html"]) {
      repoHtml[page] = await readTextFile(page);
    }
    oldSite = JSON.parse(await readTextFile("content/site.json"));
  } catch {
    return send(res, 502, { error: "Repo belum siap. Deploy versi dengan index.html/location.html lebih dulu." });
  }

  const outPages = renderSite(site, (p) => repoHtml[p]);

  let orphans = { blobs: [], repo: [] };
  try {
    /* preview stays shallow so the dialog opens fast; publish does the deep sweep */
    orphans = await findOrphans(oldSite, site, { deep: !body.preview });
  } catch {
    orphans = { blobs: [], repo: [] };
  }

  /* blob orphans = referenced-before + uploaded-but-replaced + abandoned uploads */
  let orphanBlobs = orphans.blobs;
  try {
    const stray = await findOrphanBlobs(site);
    orphanBlobs = [...new Set([...orphanBlobs, ...stray])];
  } catch {
    /* keep whatever the reference diff found */
  }
  orphans.blobs = orphanBlobs;

  if (body.preview) {
    return send(res, 200, {
      preview: true,
      summary: summarize(site),
      diff: diffUnified("", JSON.stringify(normalizeSiteDiff(site), null, 2)),
      orphans: { blobs: orphans.blobs.length, repo: orphans.repo.length },
      html: { index: outPages.index.slice(0, 90000) }
    });
  }

  const filesToCommit = [{ path: "content/site.json", base64: Buffer.from(JSON.stringify(site, null, 2)).toString("base64") }];
  for (const f of uploads) {
    filesToCommit.push({ path: f.path, base64: f.base64 || "", sha: f.sha || undefined });
  }
  const deletedRepo = new Set();
  for (const f of deletes) {
    filesToCommit.push({ path: f.path, delete: true, mode: "100644" });
    deletedRepo.add(f.path);
  }
  for (const p of orphans.repo) {
    if (deletedRepo.has(p)) continue;
    filesToCommit.push({ path: p, delete: true, mode: "100644" });
    deletedRepo.add(p);
  }

  /* artefak hasil render: HTML + site-data.js ikut di-commit agar live tanpa build */
  filesToCommit.push(
    { path: "index.html", base64: Buffer.from(outPages.index).toString("base64") },
    { path: "location.html", base64: Buffer.from(outPages.location).toString("base64") },
    { path: "assets/js/site-data.js", base64: Buffer.from(siteDataScript(site)).toString("base64") }
  );

  const message = `Admin: update ${summarize(site)}`;
  try {
    const result = await commitFiles(filesToCommit, message, AUTHOR);

    /* blob cleanup after a successful commit (best effort) */
    let blobsDeleted = 0;
    if (orphans.blobs.length && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(orphans.blobs);
        blobsDeleted = orphans.blobs.length;
      } catch {
        blobsDeleted = 0;
      }
    }

    return send(res, 200, {
      ok: true,
      commit: result.sha,
      summary: message,
      removed: { repo: orphans.repo.length, blobs: blobsDeleted }
    });
  } catch (e) {
    return send(res, 502, { error: "Gagal commit ke repo: " + (e.message || "") });
  }
}