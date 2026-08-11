/**
 * Pure evolution-graph logic over the dataset. Deliberately free of any Decky or
 * browser imports so it can be exercised directly against assets/data/digimon.json.
 * Fetching and caching live in ./dex.ts.
 */
import type { Chain, Digimon, EvolutionCondition, Generation } from "./types";
import { GENERATIONS } from "./types";

export interface Dex {
  all: Digimon[];
  byId: Map<number, Digimon>;
  /** Sorted by generation then name — the order used everywhere a list is shown. */
  sorted: Digimon[];
}

const generationRank = new Map<string, number>(GENERATIONS.map((g, i) => [g, i]));

export function buildDex(all: Digimon[]): Dex {
  const sorted = [...all].sort(
    (a, b) =>
      (generationRank.get(a.generation) ?? 99) - (generationRank.get(b.generation) ?? 99) ||
      a.name.localeCompare(b.name),
  );
  return { all, byId: new Map(all.map((d) => [d.id, d])), sorted };
}

function resolve(ids: number[], byId: Map<number, Digimon>): Digimon[] {
  const out: Digimon[] = [];
  for (const id of ids) {
    const d = byId.get(id);
    if (d) out.push(d);
  }
  return out;
}

export function chainMembers(chain: Chain, byId: Map<number, Digimon>): Digimon[] {
  return resolve(chain.ids, byId);
}

/** How a line is named wherever it's listed: "Agumon → Greymon", or just the one name. */
export function chainLabel(members: Digimon[]): string {
  const head = members[0];
  const tail = members.at(-1);
  if (!head || !tail) return "Empty line";
  return head.id === tail.id ? tail.name : `${head.name} → ${tail.name}`;
}

export function preEvolutionsOf(digimon: Digimon, byId: Map<number, Digimon>): Digimon[] {
  return resolve(digimon.pre_evolutions, byId);
}

export function evolutionsOf(digimon: Digimon, byId: Map<number, Digimon>): Digimon[] {
  return resolve(digimon.evolutions, byId);
}

/** Pre-evolutions available to prepend to a line: everything the head devolves from
 * that isn't already in the line. */
export function prependOptions(chain: Chain, byId: Map<number, Digimon>): Digimon[] {
  const head = byId.get(chain.ids[0]);
  if (!head) return [];
  return preEvolutionsOf(head, byId).filter((d) => !chain.ids.includes(d.id));
}

export function formatRequirements(conditions: EvolutionCondition[]): string[] {
  return conditions.map((c) =>
    Object.entries(c.requirements)
      .map(([key, value]) => `${key} ${value}`)
      .join("  ·  "),
  );
}

export function searchDigimon(dex: Dex, query: string, generation: Generation | "All"): Digimon[] {
  const q = query.trim().toLowerCase();
  return dex.sorted.filter((d) => {
    if (generation !== "All" && d.generation !== generation) return false;
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q) || d.type.toLowerCase().includes(q);
  });
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Walks a random evolution path from `start`, never reusing a Digimon already
 * placed elsewhere in the team. Mirrors the web tool's generator. */
function randomChainFrom(start: Digimon, used: Set<number>, byId: Map<number, Digimon>): number[] {
  const ids = [start.id];
  used.add(start.id);

  let current = start;
  while (current.evolutions?.length) {
    const candidates = evolutionsOf(current, byId).filter((d) => !used.has(d.id));
    if (!candidates.length) break;

    current = randomItem(candidates);
    used.add(current.id);
    ids.push(current.id);
  }

  return ids;
}

/**
 * Builds `size` full evolution lines starting from In-Training I Digimon.
 * `keep` lines (locked ones) are preserved as-is and their members stay off-limits.
 */
export function randomTeam(dex: Dex, size: number, keep: Chain[] = []): Chain[] {
  const starters = dex.all.filter((d) => d.generation === "In-Training I");
  if (!starters.length) return keep;

  const used = new Set<number>(keep.flatMap((c) => c.ids));
  const chains = [...keep];

  while (chains.length < size) {
    const available = starters.filter((d) => !used.has(d.id));
    if (!available.length) break;
    chains.push({ ids: randomChainFrom(randomItem(available), used, dex.byId), locked: false });
  }

  return chains;
}
