import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PAGES = ["index.html", "location.html"];

const load = (p) => readFileSync(join(ROOT, p), "utf8");
const sp = (n) => " ".repeat(n);
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function nameForSlug(styles, slug) {
  const s = (styles || []).find((x) => x.slug === slug);
  return s ? s.name : slug;
}

/* ---------- block builders (indent-aware) ---------- */
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

function patchMaps(html, cid) {
  return html.replace(/cid=\d+/g, `cid=${esc(cid)}`);
}

/* ---------- page layouts ---------- */
const LAYOUT = {
  index: { marqueeInd: 6, statsInd: 6, galleryInd: 8, guideInd: 10, metaInd: 10 },
  location: { guideInd: 8, metaInd: 8 },
};

function patch(html, re, replacer) {
  if (!re.test(html)) throw new Error(`render: pattern not found: ${re}`);
  return html.replace(re, replacer);
}

export function renderSite(site, loadPage = load) {
  let index = loadPage("index.html");
  const li = LAYOUT.index;

  index = patch(
    index,
    /(<div class="marquee__track">\n)([\s\S]*?)(\n {4}<\/div>)/,
    (_m, a, _b, c) => `${a}${marqueeBlock(site.marquee, 3, li.marqueeInd)}${c}`
  );
  index = patch(
    index,
    /(<ul class="stats__list">\n)([\s\S]*?)(\n {4}<\/ul>)/,
    (_m, a, _b, c) => `${a}${statsItems(site.stats, li.statsInd)}${c}`
  );
  index = patch(
    index,
    /(<div class="arc-strip">\n)([\s\S]*?)(\n {6}<\/div>)/,
    (_m, a, _b, c) => `${a}${galleryFigures(site.gallery, site.styles, li.galleryInd)}${c}`
  );
  index = patch(index, /<img class="location-figure__img"[^>]*>/, () => figureImg(site.location));
  index = patch(
    index,
    /(<figcaption class="location-figure__cap">)[\s\S]*?(<\/figcaption>)/,
    (_m, a, b) => `${a}${site.location.caption}${b}`
  );
  index = patch(
    index,
    /(<ol class="location-guide__list">\n)([\s\S]*?)(\n {8}<\/ol>)/,
    (_m, a, _b, c) => `${a}${guideItems(site.location.guide, li.guideInd)}${c}`
  );
  index = patch(
    index,
    /(<div class="location-meta">\n)([\s\S]*?)(\n {8}<\/div>)/,
    (_m, a, _b, c) => `${a}${metaBlock(site.location, li.metaInd)}${c}`
  );
  index = patchMaps(index, site.location.mapsCid);

  let location = loadPage("location.html");
  const ll = LAYOUT.location;

  location = patch(location, /<img class="location-figure__img"[^>]*>/, () => figureImg(site.location));
  location = patch(
    location,
    /(<figcaption class="location-figure__cap">)[\s\S]*?(<\/figcaption>)/,
    (_m, a, b) => `${a}${site.location.caption}${b}`
  );
  location = patch(
    location,
    /(<ol class="location-guide__list">\n)([\s\S]*?)(\n {6}<\/ol>)/,
    (_m, a, _b, c) => `${a}${guideItems(site.location.guide, ll.guideInd)}${c}`
  );
  location = patch(
    location,
    /(<div class="location-meta">\n)([\s\S]*?)(\n {6}<\/div>)/,
    (_m, a, _b, c) => `${a}${metaBlock(site.location, ll.metaInd)}${c}`
  );
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
