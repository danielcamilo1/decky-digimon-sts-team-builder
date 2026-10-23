import { callable } from "@decky/api";
import { useEffect, useState } from "react";

import { normalizeChains } from "../data/share";
import type { Chain, TeamState } from "../data/types";

const loadState = callable<[], TeamState>("load_state");
const saveState = callable<[state: TeamState], boolean>("save_state");

const EMPTY: TeamState = { chains: [], selected: 0 };

/**
 * A tiny observable store. The Quick Access panel and the full-screen page are mounted
 * independently by Decky, so state lives here rather than in either tree.
 */
class TeamStore {
  private state: TeamState = EMPTY;
  private readonly listeners = new Set<() => void>();
  private loaded = false;
  private loading: Promise<void> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set on any mutation, cleared once written to disk. */
  private dirty = false;

  get(): TeamState {
    return this.state;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  /** Reads the persisted team once; later calls resolve immediately. */
  async hydrate(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const stored = await loadState();
        const chains = normalizeChains(stored?.chains) ?? [];
        this.state = { chains, selected: clampIndex(stored?.selected ?? 0, chains.length) };
      } catch (e) {
        console.error("[digimon-team-builder] could not load saved team:", e);
        this.state = EMPTY;
      } finally {
        this.loaded = true;
        this.loading = null;
        this.emit();
      }
    })();

    return this.loading;
  }

  /**
   * Applies a change and schedules a write. Saves are debounced because holding a
   * direction on the d-pad can fire several edits in quick succession.
   *
   * `persist: false` still marks the state dirty but doesn't schedule a write — used
   * for selection, which changes on every focus move and isn't worth the disk churn.
   * It gets written along with the next real edit, or on flush().
   */
  private update(next: Partial<TeamState>, persist = true) {
    const chains = next.chains ?? this.state.chains;
    const selected = clampIndex(next.selected ?? this.state.selected, chains.length);
    this.state = { chains, selected };
    this.dirty = true;
    this.emit();

    if (!persist) return;

    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.write();
    }, 400);
  }

  private write() {
    this.dirty = false;
    saveState(this.state).catch((e) => console.error("[digimon-team-builder] could not save team:", e));
  }

  /** Writes any pending change immediately — called when a surface unmounts so a last
   * edit isn't lost to the debounce. */
  flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) this.write();
  }

  select(index: number) {
    if (index === this.state.selected) return;
    this.update({ selected: index }, false);
  }

  setChains(chains: Chain[], selected = this.state.selected) {
    this.update({ chains, selected });
  }

  addChain(id: number): number {
    const chains = [...this.state.chains, { ids: [id], locked: false }];
    const index = chains.length - 1;
    this.update({ chains, selected: index });
    return index;
  }

  /** Replaces a line's members; removing the last member deletes the line. */
  setChainIds(index: number, ids: number[]) {
    if (ids.length === 0) {
      this.removeChain(index);
      return;
    }
    this.update({
      chains: this.state.chains.map((chain, i) => (i === index ? withIds(chain, ids) : chain)),
    });
  }

  /**
   * Marks the stage the line has actually reached, or clears the mark with `null`.
   *
   * Allowed on locked lines: the lock keeps a line's members through a reroll, and
   * where you are in it isn't a member change.
   */
  setCurrent(index: number, id: number | null) {
    const chain = this.state.chains[index];
    if (!chain) return;
    if (id !== null && !chain.ids.includes(id)) return;
    if ((chain.current ?? null) === id) return;

    this.update({
      chains: this.state.chains.map((c, i) => (i === index ? withCurrent(c, id) : c)),
    });
  }

  prepend(index: number, id: number) {
    const chain = this.state.chains[index];
    if (!chain || chain.locked || chain.ids.includes(id)) return;
    this.setChainIds(index, [id, ...chain.ids]);
  }

  /**
   * Same semantics as the web tool: removing an end just drops it, while picking a
   * member in the middle trims everything after it.
   */
  trimAt(index: number, id: number) {
    const chain = this.state.chains[index];
    if (!chain || chain.locked) return;

    const position = chain.ids.indexOf(id);
    if (position === -1) return;

    if (position === 0) this.setChainIds(index, chain.ids.slice(1));
    else if (position === chain.ids.length - 1) this.setChainIds(index, chain.ids.slice(0, -1));
    else this.setChainIds(index, chain.ids.slice(0, position + 1));
  }

  /**
   * Takes a different branch out of the Digimon at `position`: everything after it is
   * replaced by `id`. Choosing from the last member simply extends the line.
   */
  chooseBranch(index: number, position: number, id: number) {
    const chain = this.state.chains[index];
    if (!chain || chain.locked) return;
    if (position < 0 || position >= chain.ids.length) return;

    const head = chain.ids.slice(0, position + 1);
    // Re-entering a Digimon already earlier in the line would make a loop.
    if (head.includes(id)) return;

    this.setChainIds(index, [...head, id]);
  }

  toggleLock(index: number) {
    this.update({
      chains: this.state.chains.map((chain, i) => (i === index ? { ...chain, locked: !chain.locked } : chain)),
    });
  }

  removeChain(index: number) {
    const chains = this.state.chains.filter((_, i) => i !== index);
    this.update({ chains, selected: Math.min(this.state.selected, Math.max(0, chains.length - 1)) });
  }

  move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= this.state.chains.length) return;

    const chains = [...this.state.chains];
    [chains[index], chains[target]] = [chains[target], chains[index]];
    this.update({ chains, selected: target });
  }

  clear() {
    this.update({ chains: [], selected: 0 });
  }
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

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(Math.max(0, Math.floor(index) || 0), length - 1);
}

export const teamStore = new TeamStore();

/** Subscribes a component to the store, hydrating from disk on first mount. */
export function useTeam(): { team: TeamState; loaded: boolean } {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const unsubscribe = teamStore.subscribe(() => forceRender((n) => n + 1));
    teamStore.hydrate();
    return unsubscribe;
  }, []);

  return { team: teamStore.get(), loaded: teamStore.isLoaded() };
}
