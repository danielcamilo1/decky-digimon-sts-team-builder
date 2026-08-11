#!/usr/bin/env node
/**
 * Regenerates assets/ from diegogliarte's `tools` repo.
 *
 *   git clone --depth 1 https://github.com/diegogliarte/tools _ref-tools
 *   pnpm prepare-data                    # or: node scripts/prepare-data.mjs <path-to-tools>
 *
 * Produces:
 *   assets/data/digimon.json   trimmed dataset (only fields the builder uses)
 *   assets/digimon/<id>.webp   475 sprites
 *   assets/attributes/*.png    attribute icons
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, copyFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const upstream = resolve(process.argv[2] ?? join(root, "_ref-tools"));

const srcData = join(upstream, "src/lib/data/digimon-story-ts/digimon.json");
const srcSprites = join(upstream, "static/digimon-story-ts/digimons");
const srcStatic = join(upstream, "static/digimon-story-ts");

if (!existsSync(srcData)) {
  console.error(`Upstream dataset not found at ${srcData}`);
  console.error("Clone it first: git clone --depth 1 https://github.com/diegogliarte/tools _ref-tools");
  process.exit(1);
}

// Fields the team builder actually needs. Dropping possible_personalities and the
// skill lists takes the dataset from ~975 KB to ~240 KB.
const KEEP = [
  "id",
  "slug",
  "name",
  "generation",
  "attribute",
  "type",
  "ridable",
  "base_personality",
  "base_stats",
  "evolution_conditions",
  "pre_evolutions",
  "evolutions",
];

const raw = JSON.parse(readFileSync(srcData, "utf-8"));
const digimon = raw.map((d) => Object.fromEntries(KEEP.filter((k) => k in d).map((k) => [k, d[k]])));

const outData = join(root, "assets/data");
const outSprites = join(root, "assets/digimon");
const outAttrs = join(root, "assets/attributes");
for (const dir of [outData, outSprites, outAttrs]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

writeFileSync(join(outData, "digimon.json"), JSON.stringify(digimon));

// Sprites are named "<id>-<slug>.webp" upstream; the plugin addresses them by id alone.
let copied = 0;
const bySlug = new Map(digimon.map((d) => [`${d.id}-${d.slug}`, d.id]));
for (const file of readdirSync(srcSprites)) {
  const key = file.replace(/\.webp$/, "");
  const id = bySlug.get(key);
  if (id === undefined) {
    console.warn(`  skipping unmatched sprite: ${file}`);
    continue;
  }
  copyFileSync(join(srcSprites, file), join(outSprites, `${id}.webp`));
  copied++;
}

const missing = digimon.filter((d) => !existsSync(join(outSprites, `${d.id}.webp`)));

for (const icon of ["vaccine.png", "virus.png", "data.png", "free.png", "variable.png", "unknown.png", "no-data.png"]) {
  const from = join(srcStatic, icon);
  if (existsSync(from)) copyFileSync(from, join(outAttrs, icon));
  else console.warn(`  missing attribute icon: ${icon}`);
}

const bytes = (dir) =>
  readdirSync(dir).reduce((total, f) => total + statSync(join(dir, f)).size, 0);

console.log(`digimon.json  ${digimon.length} entries, ${(bytes(outData) / 1024).toFixed(0)} KB`);
console.log(`sprites       ${copied} files, ${(bytes(outSprites) / 1024 / 1024).toFixed(1)} MB`);
console.log(`attributes    ${readdirSync(outAttrs).length} files`);
if (missing.length) console.warn(`WARNING: ${missing.length} Digimon have no sprite: ${missing.map((d) => d.slug).join(", ")}`);
