import { useEffect, useState } from "react";

import type { Dex } from "../data/digimon";
import { getCachedDex, loadDex } from "../data/dex";

export interface DexState {
  dex: Dex | null;
  error: string | null;
}

/** Loads the bundled dataset once and shares it across every mounted surface. */
export function useDex(): DexState {
  const [dex, setDex] = useState<Dex | null>(getCachedDex);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dex) return;

    let cancelled = false;
    loadDex()
      .then((loaded) => {
        if (!cancelled) setDex(loaded);
      })
      .catch((e: unknown) => {
        console.error("[digimon-team-builder] could not load the Digimon dataset:", e);
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [dex]);

  return { dex, error };
}
