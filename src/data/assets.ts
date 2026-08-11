import manifest from "@decky/manifest";

import type { Attribute, Digimon } from "./types";

/**
 * decky-loader serves everything under the plugin's dist/assets directory here, and
 * this route is exempt from the loader's CSRF check — so plain <img src> works.
 * See decky_loader/loader.py (`/plugins/{plugin_name}/assets/{path}`).
 */
const ASSET_BASE = `http://127.0.0.1:1337/plugins/${encodeURIComponent(manifest.name)}/assets`;

export const DATA_URL = `${ASSET_BASE}/data/digimon.json`;

export function spriteUrl(digimon: Digimon | number): string {
  const id = typeof digimon === "number" ? digimon : digimon.id;
  return `${ASSET_BASE}/digimon/${id}.webp`;
}

const ATTRIBUTE_ICONS: Record<Attribute, string> = {
  Vaccine: "vaccine.png",
  Data: "data.png",
  Virus: "virus.png",
  Free: "free.png",
  Variable: "variable.png",
  Unknown: "unknown.png",
  "No Data": "no-data.png",
};

export function attributeIconUrl(attribute: Attribute): string {
  return `${ASSET_BASE}/attributes/${ATTRIBUTE_ICONS[attribute] ?? ATTRIBUTE_ICONS.Unknown}`;
}
