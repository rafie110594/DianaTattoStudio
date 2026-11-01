import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite, PAGES } from "../api/_lib/render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

function firstDiff(a, b) {
  const la = a.split("\n");
  const lb = b.split("\n");
  const n = Math.min(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    if (la[i] !== lb[i]) {
      return `line ${i + 1}\n  got : ${JSON.stringify(la[i])}\n  want: ${JSON.stringify(lb[i])}`;
    }
  }
  return `length ${la.length} vs ${lb.length}`;
}

const site = JSON.parse(read("content/site.json"));
const before = Object.fromEntries(PAGES.map((f) => [f, read(f)]));
const out = renderSite(site);
let fail = false;

for (const f of PAGES) {
  const key = f.replace(/\.html$/, "");
  const got = out[key];
  if (got === before[f]) {
    console.log(`OK   ${f} byte-identical`);
  } else {
    fail = true;
    console.error(`DIFF ${f}: ${firstDiff(got, before[f])}`);
  }
}
process.exit(fail ? 1 : 0);