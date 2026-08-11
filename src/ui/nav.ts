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
