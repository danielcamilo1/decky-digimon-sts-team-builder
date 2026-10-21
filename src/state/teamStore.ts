import { addEventListener, callable } from "@decky/api";
import { useEffect, useState } from "react";

import { normalizeChains } from "../data/share";
import type { Chain, TeamState } from "../data/types";
import * as ops from "./teamOps";
import { clampIndex } from "./teamOps";

const loadState = callable<[], TeamState>("load_state");
const saveState = callable<[state: TeamState], boolean>("save_state");

/** Emitted by the backend when the second-screen page saves a change. */
const REMOTE_EVENT = "team_state_changed";

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

  constructor() {
    addEventListener<[state: TeamState]>(REMOTE_EVENT, (state) => this.applyRemote(state));
  }

  /**
   * Takes a team the second-screen page saved. It's already on disk, so this only
   * replaces what's shown — and drops a pending local write, which would otherwise put
   * the older team back. Selection stays local: the two surfaces each have their own.
   */
  private applyRemote(stored: TeamState) {
    const chains = normalizeChains(stored?.chains);
    if (!chains) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.dirty = false;
    this.loaded = true;
    this.state = { chains, selected: clampIndex(this.state.selected, chains.length) };
    this.emit();
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
    const chains = ops.addChain(this.state.chains, id);
    const index = chains.length - 1;
    this.update({ chains, selected: index });
    return index;
  }

  /** Applies an edit from ./teamOps, skipping the write when it changed nothing. */
  private edit(chains: Chain[], selected?: number) {
    if (chains === this.state.chains) return;
    this.update({ chains, selected });
  }

  /** Replaces a line's members; removing the last member deletes the line. */
  setChainIds(index: number, ids: number[]) {
    if (ids.length === 0) {
      this.removeChain(index);
      return;
    }
    this.edit(ops.setChainIds(this.state.chains, index, ids));
  }

  /** Marks the stage the line has actually reached, or clears the mark with `null`. */
  setCurrent(index: number, id: number | null) {
    this.edit(ops.setCurrent(this.state.chains, index, id));
  }

  prepend(index: number, id: number) {
    this.edit(ops.prepend(this.state.chains, index, id));
  }

  /** Removing an end drops it; picking a member in the middle trims everything after it. */
  trimAt(index: number, id: number) {
    const chains = ops.trimAt(this.state.chains, index, id);
    this.edit(chains, Math.min(this.state.selected, Math.max(0, chains.length - 1)));
  }

  /** Takes a different branch out of the Digimon at `position`. */
  chooseBranch(index: number, position: number, id: number) {
    this.edit(ops.chooseBranch(this.state.chains, index, position, id));
  }

  toggleLock(index: number) {
    this.edit(ops.toggleLock(this.state.chains, index));
  }

  removeChain(index: number) {
    const chains = ops.removeChain(this.state.chains, index);
    this.edit(chains, Math.min(this.state.selected, Math.max(0, chains.length - 1)));
  }

  move(index: number, delta: -1 | 1) {
    this.edit(ops.move(this.state.chains, index, delta), index + delta);
  }

  clear() {
    this.update({ chains: [], selected: 0 });
  }
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
