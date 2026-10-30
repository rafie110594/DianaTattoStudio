import { readFileSync, writeFileSync } from "node:fs";
import { renderSite } from "../lib/render.mjs";

const site = JSON.parse(readFileSync("content/site.json", "utf8"));
const original = {
  index: readFileSync("index.html", "utf8"),
  location: readFileSync("location.html", "utf8")
};

site.marquee = ["CUSTOM ONLY", "2019", "UBUD"];
site.stats[0].value = 2019;
site.stats[0].plain = true;
site.gallery = site.gallery.slice(0, 3);
site.location.photo = { src: "assets/img/location/baru.jpg", w: 800, h: 1000, alt: "depan baru" };
site.location.caption = "Caption uji";
site.location.guide = ["Satu", "Dua"];
site.location.address = "Jl. Uji 1";
site.location.hours = "Setiap hari";
site.location.mapsCid = "999";

const out = renderSite(site);
const checks = [
  ["marquee 2019", out.index.includes("<span>2019</span>")],
  ["marquee UBUD", out.index.includes("<span>UBUD</span>")],
  ["no 2022 in marquee", !/marquee__track[\s\S]*?<span>2022<\/span>/.test(out.index)],
  ["stat 2019", out.index.includes('data-count="2019" data-plain="true">2019')],
  ["gallery trimmed", (out.index.match(/arc-card/g) || []).length === 3],
  ["loc photo index", out.index.includes('src="assets/img/location/baru.jpg" alt="depan baru" width="800" height="1000"')],
  ["loc photo page", out.location.includes('src="assets/img/location/baru.jpg"')],
  ["caption both", out.index.includes("Caption uji") && out.location.includes("Caption uji")],
  ["guide 2 items index", (out.index.match(/location-guide__item/g) || []).length === 2],
  ["guide 2 items page", (out.location.match(/location-guide__item/g) || []).length === 2],
  ["address both", out.index.includes("Jl. Uji 1") && out.location.includes("Jl. Uji 1")],
  ["hours both", out.index.includes("Setiap hari") && out.location.includes("Setiap hari")],
  ["cid replaced", out.index.includes("cid=999") && !out.index.includes("5724227728851520814")]
];

let fail = 0;
for (const [name, ok] of checks) {
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}
writeFileSync("index.html", original.index);
writeFileSync("location.html", original.location);
console.log(fail ? `\n${fail} FAILED` : "\nall mutation checks passed (files restored)");
process.exit(fail ? 1 : 0);
