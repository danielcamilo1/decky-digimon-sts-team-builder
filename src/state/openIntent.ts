/**
 * A one-shot hand-off from the Quick Access panel to the full-screen page.
 *
 * Decky mounts the two surfaces independently and the route takes no parameters, so
 * there's no props path between them: the panel leaves a note here before navigating
 * and the page picks it up when it mounts.
 *
 * The note expires, because navigation isn't guaranteed to happen — if the user backs
 * out before the page mounts, a later manual open shouldn't inherit a stale intent.
 */
export type OpenIntent = "line";

const TTL_MS = 10_000;

let pending: { intent: OpenIntent; at: number } | null = null;

export function requestOpen(intent: OpenIntent) {
  pending = { intent, at: Date.now() };
}

/** Reads and clears the pending intent, if one was left recently. */
export function takeOpenIntent(): OpenIntent | null {
  const note = pending;
  pending = null;
  if (!note || Date.now() - note.at > TTL_MS) return null;
  return note.intent;
}
