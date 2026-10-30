import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyAll } from "../lib/render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(readFileSync(join(ROOT, "content/site.json"), "utf8"));
applyAll(site);
console.log("rendered: index.html, location.html, assets/js/site-data.js");