/**
 * The editing rules for a team, as pure functions over the chain list. Shared by the
 * Steam-side store and the second-screen web app so both surfaces edit a line the same
 * way. Every function returns the input array unchanged when the edit doesn't apply.
 */
import type { Chain } from "../data/types";

/** Replaces a line's members; removing the last member deletes the line. */
export function setChainIds(chains: Chain[], index: number, ids: number[]): Chain[] {
  if (!chains[index]) return chains;
  if (ids.length === 0) return removeChain(chains, index);
  return chains.map((chain, i) => (i === index ? withIds(chain, ids) : chain));
}

export function addChain(chains: Chain[], id: number): Chain[] {
  return [...chains, { ids: [id], locked: false }];
}

/**
 * Marks the stage the line has actually reached, or clears the mark with `null`.
 *
 * Allowed on locked lines: the lock keeps a line's members through a reroll, and
 * where you are in it isn't a member change.
 */
export function setCurrent(chains: Chain[], index: number, id: number | null): Chain[] {
  const chain = chains[index];
  if (!chain) return chains;
  if (id !== null && !chain.ids.includes(id)) return chains;
  if ((chain.current ?? null) === id) return chains;
  return chains.map((c, i) => (i === index ? withCurrent(c, id) : c));
}

export function prepend(chains: Chain[], index: number, id: number): Chain[] {
  const chain = chains[index];
  if (!chain || chain.locked || chain.ids.includes(id)) return chains;
  return setChainIds(chains, index, [id, ...chain.ids]);
}

/**
 * Same semantics as the web tool: removing an end just drops it, while picking a
 * member in the middle trims everything after it.
 */
export function trimAt(chains: Chain[], index: number, id: number): Chain[] {
  const chain = chains[index];
  if (!chain || chain.locked) return chains;

  const position = chain.ids.indexOf(id);
  if (position === -1) return chains;

  if (position === 0) return setChainIds(chains, index, chain.ids.slice(1));
  if (position === chain.ids.length - 1) return setChainIds(chains, index, chain.ids.slice(0, -1));
  return setChainIds(chains, index, chain.ids.slice(0, position + 1));
}

/**
 * Takes a different branch out of the Digimon at `position`: everything after it is
 * replaced by `id`. Choosing from the last member simply extends the line.
 */
export function chooseBranch(chains: Chain[], index: number, position: number, id: number): Chain[] {
  const chain = chains[index];
  if (!chain || chain.locked) return chains;
  if (position < 0 || position >= chain.ids.length) return chains;

  const head = chain.ids.slice(0, position + 1);
  // Re-entering a Digimon already earlier in the line would make a loop.
  if (head.includes(id)) return chains;

  return setChainIds(chains, index, [...head, id]);
}

export function toggleLock(chains: Chain[], index: number): Chain[] {
  if (!chains[index]) return chains;
  return chains.map((chain, i) => (i === index ? { ...chain, locked: !chain.locked } : chain));
}

export function removeChain(chains: Chain[], index: number): Chain[] {
  if (!chains[index]) return chains;
  return chains.filter((_, i) => i !== index);
}

export function move(chains: Chain[], index: number, delta: -1 | 1): Chain[] {
  const target = index + delta;
  if (!chains[index] || target < 0 || target >= chains.length) return chains;

  const next = [...chains];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(Math.max(0, Math.floor(index) || 0), length - 1);
}

/** Applies new members, dropping a progress mark the edit has removed from the line. */
function withIds(chain: Chain, ids: number[]): Chain {
  const next: Chain = { ...chain, ids };
  if (next.current !== undefined && !ids.includes(next.current)) delete next.current;
  return next;
}

function withCurrent(chain: Chain, id: number | null): Chain {
  if (id === null) {
    const next = { ...chain };
    delete next.current;
    return next;
  }
  return { ...chain, current: id };
}
