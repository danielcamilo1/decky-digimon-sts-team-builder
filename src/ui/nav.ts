import { GamepadButton } from "@decky/ui";
import type { GamepadEvent } from "@decky/ui";

/**
 * Hands focus to another region of the page on a given d-pad press.
 *
 * Steam's spatial navigation searches within the focused element's own container
 * first, and doesn't reliably cross from the team sidebar into the line strip (or
 * back) because each is its own scroll container. Rather than hope the geometry
 * resolves, the elements on those boundaries say explicitly where focus should go.
 *
 * `stopPropagation` keeps Steam's own handler from also acting on the press, which
 * would otherwise move focus a second time.
 */
export function focusExit(button: GamepadButton, getTarget: () => HTMLElement | null) {
  return (evt: GamepadEvent) => {
    if (evt.detail.button !== button) return;

    const target = getTarget();
    if (!target) return;

    evt.stopPropagation();
    target.focus();
  };
}

export const exitRight = (getTarget: () => HTMLElement | null) => focusExit(GamepadButton.DIR_RIGHT, getTarget);
export const exitLeft = (getTarget: () => HTMLElement | null) => focusExit(GamepadButton.DIR_LEFT, getTarget);

/** First gamepad target inside a container, by the class names this plugin sets. */
export function firstTarget(root: HTMLElement | null, selector: string): HTMLElement | null {
  return root?.querySelector<HTMLElement>(selector) ?? null;
}

/**
 * Focuses a target that may not exist yet, and holds it there.
 *
 * Used when arriving on the page from the Quick Access panel: the route mounts before
 * the dataset has loaded, so the element to focus doesn't exist for the first few
 * frames. Steam also applies its own focus when a route mounts, which can land after
 * ours, so the focus is re-asserted once the tree has settled.
 *
 * Returns a cancel function, for use as an effect cleanup.
 */
export function focusWhenReady(getTarget: () => HTMLElement | null, timeoutMs = 2000): () => void {
  const start = Date.now();
  let cancelled = false;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    if (cancelled) return;

    const target = getTarget();
    if (!target) {
      if (Date.now() - start > timeoutMs) return;
      frame = requestAnimationFrame(tick);
      return;
    }

    target.focus();
    timer = setTimeout(() => {
      timer = null;
      // Only take focus back if Steam's mount-time focus moved it elsewhere; if the
      // user has already moved on, leave them where they are.
      if (!cancelled && !target.contains(document.activeElement)) target.focus();
    }, 120);
  };

  frame = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
  };
}
