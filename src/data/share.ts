import type { Chain } from "./types";

/**
 * Share codes are byte-for-byte compatible with diegogliarte's web team builder, so a
 * team built on the Deck can be pasted into the site and vice versa: base64url of
 * JSON.stringify([{ ids, locked }]).
 */

function normalizeChain(value: unknown): Chain | null {
  // Legacy format: a bare array of ids.
  if (Array.isArray(value)) {
    return value.every((id) => typeof id === "number") ? { ids: value, locked: false } : null;
  }

  if (!value || typeof value !== "object") return null;

  const chain = value as Partial<Chain> & { leftLocked?: boolean; rightLocked?: boolean };
  if (!Array.isArray(chain.ids) || !chain.ids.every((id) => typeof id === "number")) return null;
  if (chain.ids.length === 0) return null;

  return {
    ids: chain.ids,
    // Older versions locked each end of a line independently.
    locked: Boolean(chain.locked || (chain.leftLocked && chain.rightLocked)),
  };
}

export function normalizeChains(value: unknown): Chain[] | null {
  let values: unknown[];
  if (Array.isArray(value)) values = value;
  else if (value && typeof value === "object") values = Object.values(value);
  else return null;

  const chains: Chain[] = [];
  for (const entry of values) {
    const chain = normalizeChain(entry);
    if (!chain) return null;
    chains.push(chain);
  }
  return chains;
}

export function encodeTeam(chains: Chain[]): string {
  const payload = chains.map(({ ids, locked }) => ({ ids, locked }));
  return btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Accepts a raw code, a legacy `v2:`-prefixed code, or a full team-builder URL
 * (`...?team=<code>`) so a link copied off the website can be pasted straight in.
 */
export function decodeTeam(input: string): Chain[] | null {
  let raw = input.trim();
  if (!raw) return null;

  if (raw.includes("team=")) {
    raw = decodeURIComponent(raw.slice(raw.indexOf("team=") + "team=".length).split(/[&#]/)[0]);
  }
  if (raw.startsWith("v2:")) raw = raw.slice(3);

  try {
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    return normalizeChains(JSON.parse(atob(base64)));
  } catch {
    return null;
  }
}

export const SHARE_URL_BASE = "https://tools.diegogliarte.com/digimon/story-time-stranger/team-builder";

export function shareUrl(chains: Chain[]): string {
  return `${SHARE_URL_BASE}?team=${encodeTeam(chains)}`;
}
