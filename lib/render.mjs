import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PAGES = ["index.html", "location.html"];

const load = (p) => readFileSync(join(ROOT, p), "utf8");
const sp = (n) => " ".repeat(n);
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const toLF = (s) => String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

function nameForSlug(styles, slug) {
  const s = (styles || []).find((x) => x.slug === slug);
  return s ? s.name : slug;
}

/* ---------- block builders ---------- */
function marqueeBlock(items, repeat, ind) {
  const line = (t) => `${sp(ind)}<span>${esc(t)}</span><i class="marquee__dot"></i>`;
  return Array.from({ length: repeat }, () => items.map(line)).flat().join("\n");
}

function statsItems(stats, ind) {
  return stats
    .map((s) => {
      const d = s.delay ? ` style="--d:${esc(s.delay)}"` : "";
      const plain = s.plain ? ' data-plain="true"' : "";
      const suf = s.suffix ? ` data-suffix="${esc(s.suffix)}"` : "";
      const disp = s.plain ? String(s.value) : "0";
      return `${sp(ind)}<li class="stats__item" data-reveal${d}>
${sp(ind + 2)}<span class="stats__num" data-count="${esc(s.value)}"${plain}${suf}>${disp}</span>
${sp(ind + 2)}<span class="stats__label">${esc(s.label)}</span>
${sp(ind)}</li>`;
    })
    .join("\n");
}

function galleryFigures(gallery, styles, ind) {
  return gallery
    .map(
      (g, i) =>
        `${sp(ind)}<figure class="arc-card" data-slug="${esc(g.slug)}" role="button" tabindex="0" aria-label="Lihat gaya ${esc(
          nameForSlug(styles, g.slug)
        )}"><img src="${esc(g.src)}" alt="" width="${g.w}" height="${g.h}"${
          i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'
        }></figure>`
    )
    .join("\n");
}

function guideItems(guide, ind) {
  return guide
    .map((g, i) => {
      const n = String(i + 1).padStart(2, "0");
      return `${sp(ind)}<li class="location-guide__item">
${sp(ind + 2)}<span class="location-guide__num" aria-hidden="true">${n}</span>
${sp(ind + 2)}<p>${g}</p>
${sp(ind)}</li>`;
    })
    .join("\n");
}

function metaBlock(loc, ind) {
  return `${sp(ind)}<div class="location-meta__row">
${sp(ind + 2)}<span class="location-meta__label">Alamat</span>
${sp(ind + 2)}<p class="location-meta__value">${esc(loc.address)}</p>
${sp(ind)}</div>
${sp(ind)}<div class="location-meta__row">
${sp(ind + 2)}<span class="location-meta__label">Jam Buka</span>
${sp(ind + 2)}<p class="location-meta__value">${loc.hours}</p>
${sp(ind)}</div>`;
}

function figureImg(loc) {
  const p = loc.photo;
  return `<img class="location-figure__img" src="${esc(p.src)}" alt="${esc(p.alt)}" width="${p.w}" height="${p.h}" loading="lazy">`;
}

/* ---------- indent/lf agnostic block replacement ---------- */
const OPEN_RE = (open) => {
  const m = open.match(/^<([a-zA-Z]+)(\s[^>]*)?>$/);
  if (!m) throw new Error(`bad open selector: ${open}`);
  const tag = m[1];
  const attrs = m[2] || "";
  const parts = attrs.match(/([a-zA-Z-]+)="([^"]*)"/g) || [];
  const checks = parts.map((p) => {
    const [, k, v] = p.match(/([a-zA-Z-]+)="([^"]*)"/);
    return { k, v };
  });
  return { tag, checks };
};

function findOpen(html, open, from = 0) {
  const { tag, checks } = OPEN_RE(open);
  const re = new RegExp(`<${tag}\\b[^>]*>`, "g");
  re.lastIndex = from;
  let m;
  while ((m = re.exec(html))) {
    const token = m[0];
    const ok = checks.every(({ k, v }) => {
      const a = token.match(new RegExp(`\\b${k}="([^"]*)"`));
      return a && a[1] === v;
    });
    if (ok) return { start: m.index, end: m.index + token.length, tag };
  }
  return null;
}

/* scan balanced close tag of the same name, ignoring self-closing */
function findClose(html, from, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*?(/?)>|</${tag}\\s*>`, "gi");
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    const token = m[0];
    if (token.startsWith("</")) {
      depth -= 1;
      if (depth === 0) return { start: m.index, end: m.index + token.length };
    } else if (!token.endsWith("/>")) {
      depth += 1;
    }
  }
  return null;
}

/**
 * Replace the inner content of the first element matching `open`.
 * Content is rebuilt by `build(indent)` where indent = indentation of the open tag
 * plus one level (2 spaces), so output stays consistent.
 */
function patchBlock(html, open, build, label) {
  const found = findOpen(html, open);
  if (!found) throw new Error(`render(${label}): open tag not found: ${open}`);
  const close = findClose(html, found.end, found.tag);
  if (!close) throw new Error(`render(${label}): matching close not found for ${open}`);

  const head = html.slice(0, found.end);
  const tail = html.slice(close.start);
  const between = html.slice(found.end, close.start);

  /* inline element (no newline inside) -> replace content in place */
  if (!between.includes("\n")) return `${head}${build(0)}${tail}`;

  /* otherwise preserve the indentation already used by the existing children */
  const firstChild = between.split("\n").find((l) => l.trim().length);
  const lineStart = html.lastIndexOf("\n", found.start) + 1;
  const openIndent = html.slice(lineStart, found.start).match(/^[ \t]*/)[0].length;
  const indent = firstChild ? firstChild.match(/^[ \t]*/)[0].length : openIndent + 2;
  const closeIndent = " ".repeat(Math.max(0, indent - 2));

  return `${head}\n${build(indent)}\n${closeIndent}${tail}`;
}

function patchTag(html, re, replacer, label) {
  if (!re.test(html)) throw new Error(`render(${label}): pattern not found`);
  return html.replace(re, replacer);
}

function patchMaps(html, cid) {
  return html.replace(/cid=\d+/g, `cid=${esc(cid)}`);
}

export function renderSite(site, loadPage = load) {
  let index = toLF(loadPage("index.html"));

  index = patchBlock(index, '<div class="marquee__track">', (i) => marqueeBlock(site.marquee, 3, i), "marquee");
  index = patchBlock(index, '<ul class="stats__list">', (i) => statsItems(site.stats, i), "stats");
  index = patchBlock(index, '<div class="arc-strip">', (i) => galleryFigures(site.gallery, site.styles, i), "arc");
  index = patchTag(index, /<img class="location-figure__img"[^>]*>/, () => figureImg(site.location), "loc-img");
  index = patchBlock(index, '<figcaption class="location-figure__cap">', () => site.location.caption, "loc-caption");
  index = patchBlock(index, '<ol class="location-guide__list">', (i) => guideItems(site.location.guide, i), "guide");
  index = patchBlock(index, '<div class="location-meta">', (i) => metaBlock(site.location, i), "meta");
  index = patchMaps(index, site.location.mapsCid);

  let location = toLF(loadPage("location.html"));
  location = patchTag(location, /<img class="location-figure__img"[^>]*>/, () => figureImg(site.location), "loc-img");
  location = patchBlock(location, '<figcaption class="location-figure__cap">', () => site.location.caption, "loc-caption");
  location = patchBlock(location, '<ol class="location-guide__list">', (i) => guideItems(site.location.guide, i), "guide");
  location = patchBlock(location, '<div class="location-meta">', (i) => metaBlock(site.location, i), "meta");
  location = patchMaps(location, site.location.mapsCid);

  return { index, location };
}

export function writePages(pages) {
  for (const f of PAGES) writeFileSync(join(ROOT, f), pages[f.replace(/\.html$/, "")]);
}

/* runtime payload: works on file://, GH Pages and Vercel (no fetch/CORS) */
export function siteDataScript(site) {
  const payload = {
    meta: site.meta,
    gallery: site.gallery,
    styles: site.styles,
    contact: site.contact,
    location: { address: site.location.address, hours: site.location.hours }
  };
  return `/* generated by lib/render.mjs from content/site.json — do not edit by hand */\nwindow.__SITE__ = ${JSON.stringify(
    payload
  )};\n`;
}

export function writeSiteData(site) {
  writeFileSync(join(ROOT, "assets/js/site-data.js"), siteDataScript(site));
}

export function applyAll(site) {
  const pages = renderSite(site);
  writePages(pages);
  writeSiteData(site);
  return pages;
}