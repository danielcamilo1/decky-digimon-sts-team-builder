import { useEffect, useState } from "react";

/**
 * Which of the Quick Access panel's two views is showing.
 *
 * Decky unmounts the panel's content every time the menu closes, so this lives outside
 * the component tree: coming back to the panel mid-game should land on the view you
 * were last reading. It isn't written to disk — it's a reading position, not a setting,
 * and a fresh session starting on the team overview is the right default.
 */
export type PanelView = "lines" | "next";

let view: PanelView = "lines";
const listeners = new Set<() => void>();

export function setPanelView(next: PanelView) {
  if (next === view) return;
  view = next;
  for (const listener of listeners) listener();
}

export function usePanelView(): PanelView {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return view;
}
