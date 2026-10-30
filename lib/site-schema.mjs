const MAX_TEXT = 400;
const MAX_ITEMS = 60;
const SLUG = /^[a-z0-9][a-z0-9-]{1,30}$/;
const IMG_PATH = /^assets\/img\/[A-Za-z0-9_\-./]+\.(jpe?g|png|webp)$/;
const EXTERNAL = /^https?:\/\/[^\s"'<>]+$/;

export class ValidationError extends Error {}

const fail = (msg) => {
  throw new ValidationError(msg);
};
const text = (v, field, { max = MAX_TEXT, allowTags = false } = {}) => {
  if (typeof v !== "string") fail(`${field} harus berupa teks`);
  const s = v.trim();
  if (!s) fail(`${field} tidak boleh kosong`);
  if (s.length > max) fail(`${field} terlalu panjang (maks ${max})`);
  if (!allowTags && /[<>]/.test(s)) fail(`${field} tidak boleh memuat tag HTML`);
  return s;
};
const int = (v, field, { min = 0, max = 100000 } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) fail(`${field} harus bilangan bulat`);
  if (n < min || n > max) fail(`${field} di luar rentang`);
  return n;
};
const imgPath = (v, field) => {
  const s = text(v, field, { max: 200 });
  if (!IMG_PATH.test(s)) fail(`${field} harus path gambar di assets/img/`);
  if (s.includes("..")) fail(`${field} tidak boleh memuat ..`);
  return s;
};

function photo(p, field) {
  if (!p || typeof p !== "object") fail(`${field} tidak valid`);
  return {
    src: imgPath(p.src, `${field}.src`),
    w: int(p.w, `${field}.w`, { min: 1, max: 20000 }),
    h: int(p.h, `${field}.h`, { min: 1, max: 20000 })
  };
}

const CONTACT_KEYS = ["whatsapp", "instagram", "tiktok", "facebook"];

export function validateSite(input) {
  if (!input || typeof input !== "object") fail("Data situs tidak valid");

  const since = int(input.meta && input.meta.since, "meta.since", { min: 1900, max: 2100 });

  if (!Array.isArray(input.marquee) || !input.marquee.length) fail("marquee minimal 1 baris");
  if (input.marquee.length > 8) fail("marquee maksimal 8 baris");
  const marquee = input.marquee.map((m, i) => text(m, `marquee[${i}]`, { max: 40 }));

  if (!Array.isArray(input.stats) || !input.stats.length) fail("stats minimal 1 item");
  if (input.stats.length > 6) fail("stats maksimal 6 item");
  const stats = input.stats.map((s, i) => {
    const f = `stats[${i}]`;
    const value = int(s.value, `${f}.value`, { min: 0, max: 99999 });
    const label = text(s.label, `${f}.label`, { max: 40 });
    const suffix = s.suffix ? text(s.suffix, `${f}.suffix`, { max: 4 }) : null;
    const delay = s.delay ? text(s.delay, `${f}.delay`, { max: 10 }) : null;
    if (delay && !/^\.?\d+(\.\d+)?s$/.test(delay)) fail(`${f}.delay harus format seperti .1s`);
    return { value, label, plain: Boolean(s.plain), delay, suffix };
  });

  if (!Array.isArray(input.gallery)) fail("gallery tidak valid");
  if (input.gallery.length > MAX_ITEMS) fail(`gallery maksimal ${MAX_ITEMS} foto`);
  const gallery = input.gallery.map((g, i) => {
    const f = `gallery[${i}]`;
    const slug = text(g.slug, `${f}.slug`, { max: 32 });
    if (!SLUG.test(slug)) fail(`${f}.slug tidak valid`);
    return { src: imgPath(g.src, `${f}.src`), slug, w: int(g.w, `${f}.w`, { min: 1, max: 20000 }), h: int(g.h, `${f}.h`, { min: 1, max: 20000 }) };
  });

  if (!Array.isArray(input.styles) || !input.styles.length) fail("styles minimal 1 gaya");
  if (input.styles.length > 12) fail("styles maksimal 12 gaya");
  const seen = new Set();
  const styles = input.styles.map((s, i) => {
    const f = `styles[${i}]`;
    const slug = text(s.slug, `${f}.slug`, { max: 32 });
    if (!SLUG.test(slug)) fail(`${f}.slug tidak valid`);
    if (seen.has(slug)) fail(`${f}.slug duplikat`);
    seen.add(slug);
    const name = text(s.name, `${f}.name`, { max: 40 });
    const blurb = text(s.blurb, `${f}.blurb`, { max: 80 });
    if (!Array.isArray(s.photos) || !s.photos.length) fail(`${f}.photos minimal 1 foto`);
    if (s.photos.length > MAX_ITEMS) fail(`${f}.photos maksimal ${MAX_ITEMS} foto`);
    return { slug, name, blurb, photos: s.photos.map((p, j) => photo(p, `${f}.photos[${j}]`)) };
  });

  const loc = input.location;
  if (!loc || typeof loc !== "object") fail("location tidak valid");
  const location = {
    photo: photo(loc.photo, "location.photo"),
    caption: text(loc.caption, "location.caption", { max: 160, allowTags: true }),
    guide:
      Array.isArray(loc.guide) && loc.guide.length
        ? loc.guide.map((g, i) => text(g, `location.guide[${i}]`, { max: 300, allowTags: true }))
        : fail("location.guide minimal 1 baris"),
    address: text(loc.address, "location.address", { max: 160 }),
    hours: text(loc.hours, "location.hours", { max: 160, allowTags: true }),
    mapsCid: text(String(loc.mapsCid ?? ""), "location.mapsCid", { max: 40 })
  };
  if (location.guide.length > 10) fail("location.guide maksimal 10 baris");
  if (!/^\d{5,25}$/.test(location.mapsCid)) fail("location.mapsCid harus angka");

  if (!Array.isArray(input.contact)) fail("contact tidak valid");
  const contact = input.contact.map((c, i) => {
    const f = `contact[${i}]`;
    const key = text(c.key, `${f}.key`, { max: 20 });
    if (!CONTACT_KEYS.includes(key)) fail(`${f}.key tidak dikenal`);
    const href = text(c.href, `${f}.href`, { max: 300 });
    if (!EXTERNAL.test(href)) fail(`${f}.href harus URL http(s)`);
    return { key, label: text(c.label, `${f}.label`, { max: 30 }), href };
  });
  if (new Set(contact.map((c) => c.key)).size !== contact.length) fail("contact key duplikat");

  return { meta: { since }, marquee, stats, gallery, styles, location, contact };
}
