import { useEffect, useState } from "react";

import { normalizeChains } from "../data/share";
import type { Chain } from "../data/types";

/** Matches WRITE_HEADER in py_modules/second_screen.py. */
const WRITE_HEADER = "X-Team-Builder";
const WRITE_DEBOUNCE_MS = 250;
const RETRY_MS = 2000;

interface StateReply {
  version: number;
  state: { chains?: unknown };
}

/**
 * The team as the plugin backend holds it, kept current with a long poll: the backend
 * answers as soon as either screen saves a change. Edits apply here at once and are
 * written shortly after, and while one is waiting to be written the poll doesn't
 * overwrite it with the older team.
 */
class SyncStore {
  chains: Chain[] = [];
  loaded = false;
  /** False while the backend can't be reached — the toggle was switched off, say. */
  online = true;

  private version: number | null = null;
  private unsaved = false;
  private writing = false;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<() => void>();
  private started = false;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private setOnline(online: boolean) {
    if (online === this.online) return;
    this.online = online;
    this.emit();
  }

  start() {
    if (this.started) return;
    this.started = true;
    void this.poll();
  }

  private async poll() {
    for (;;) {
      try {
        const since = this.version === null ? "" : String(this.version);
        const res = await fetch(`/api/state?since=${since}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status}`);
        const reply = (await res.json()) as StateReply;
        this.setOnline(true);
        this.version = Math.max(this.version ?? 0, reply.version);
        if (!this.unsaved && !this.writing) {
          const chains = normalizeChains(reply.state?.chains);
          if (chains) {
            this.chains = chains;
            this.loaded = true;
            this.emit();
          }
        }
      } catch {
        this.setOnline(false);
        await sleep(RETRY_MS);
      }
    }
  }

  /** Applies an edit from state/teamOps; a no-op edit returns the same array and is skipped. */
  edit(apply: (chains: Chain[]) => Chain[]) {
    const next = apply(this.chains);
    if (next === this.chains) return;
    this.chains = next;
    this.unsaved = true;
    this.emit();
    this.scheduleWrite(WRITE_DEBOUNCE_MS);
  }

  private scheduleWrite(delay: number) {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      void this.write();
    }, delay);
  }

  private async write() {
    if (this.writing) {
      this.scheduleWrite(WRITE_DEBOUNCE_MS);
      return;
    }
    this.writing = true;
    this.unsaved = false;
    const chains = this.chains;
    try {
      const res = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json", [WRITE_HEADER]: "1" },
        body: JSON.stringify({ chains }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const reply = (await res.json()) as { version: number };
      this.version = Math.max(this.version ?? 0, reply.version);
      this.setOnline(true);
    } catch {
      // Kept for the next attempt rather than dropped: the edit is still on screen.
      this.unsaved = true;
      this.setOnline(false);
      this.scheduleWrite(RETRY_MS);
    } finally {
      this.writing = false;
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const syncStore = new SyncStore();

export function useSync(): SyncStore {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const unsubscribe = syncStore.subscribe(() => forceRender((n) => n + 1));
    syncStore.start();
    return () => {
      unsubscribe();
    };
  }, []);
  return syncStore;
}
