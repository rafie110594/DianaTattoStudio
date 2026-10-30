import { sessionFromRequest, requireCsrf } from "../lib/auth.mjs";
import { validateSite, ValidationError } from "../lib/site-schema.mjs";
import { renderSite, siteDataScript } from "../lib/render.mjs";
import { commitFiles, readTextFile } from "../lib/github.mjs";

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

  const uploads = Array.isArray(body.files) ? body.files : [];
  const deletes = Array.isArray(body.deletes) ? body.deletes : [];
  const pathRe = /^assets\/img\/[A-Za-z0-9_\-./]+\.(jpe?g|png|webp)$/;
  for (const f of [...uploads, ...deletes]) {
    if (!pathRe.test(f.path) || f.path.includes("..")) return send(res, 422, { error: `Path file tidak valid: ${f.path}` });
  }

  let repoHtml = {};
  try {
    repoHtml.index = await readTextFile("index.html");
    repoHtml.location = await readTextFile("location.html");
  } catch {
    return send(res, 502, { error: "Repo belum siap. Deploy versi dengan index.html/location.html lebih dulu." });
  }

  const outPages = renderSite(site, (p) => repoHtml[p]);

  if (body.preview) {
    return send(res, 200, {
      preview: true,
      summary: summarize(site),
      diff: diffUnified("", JSON.stringify(normalizeSiteDiff(site), null, 2)),
      html: { index: outPages.index.slice(0, 90000) }
    });
  }

  const filesToCommit = [{ path: "content/site.json", base64: Buffer.from(JSON.stringify(site, null, 2)).toString("base64") }];
  for (const f of uploads) {
    filesToCommit.push({ path: f.path, base64: f.base64 || "", sha: f.sha || undefined });
  }
  for (const f of deletes) {
    filesToCommit.push({ path: f.path, delete: true, mode: "100644" });
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
    return send(res, 200, { ok: true, commit: result.sha, summary: message });
  } catch (e) {
    return send(res, 502, { error: "Gagal commit ke repo: " + (e.message || "") });
  }
}