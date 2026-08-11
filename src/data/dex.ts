import { DATA_URL } from "./assets";
import type { Dex } from "./digimon";
import { buildDex } from "./digimon";
import type { Digimon } from "./types";

let cache: Dex | null = null;
let inFlight: Promise<Dex> | null = null;

/**
 * Loads the bundled dataset over decky-loader's asset route. Cached for the lifetime
 * of the plugin, and concurrent callers share one request so opening the panel and
 * the page at once only fetches once.
 */
export function loadDex(): Promise<Dex> {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;

  inFlight = fetch(DATA_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json() as Promise<Digimon[]>;
    })
    .then((all) => {
      cache = buildDex(all);
      return cache;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function getCachedDex(): Dex | null {
  return cache;
}
