import { theme } from "../ui/theme";

const c = theme.color;

/**
 * Laid out for the AYN Thor's bottom screen: 1240×1080, landscape and nearly square,
 * which a browser reports as roughly 400–620 CSS px a side depending on Android's
 * density. Every size below is in rem, and the root size follows the short side of the
 * viewport, so the page keeps its proportions at whatever density the browser picks.
 * Touch targets stay at 2.6rem or more (≈ 40 px on the Thor).
 */
export const CSS = `
*, *::before, *::after { box-sizing: border-box; }

html {
  font-size: clamp(12px, 3.7vmin, 24px);
  height: 100%;
  background: ${c.bg};
  color-scheme: dark;
}

body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(120% 90% at 100% 0%, #13253a 0%, ${c.bg} 60%);
  color: ${c.text};
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 0.9rem;
  line-height: 1.35;
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
  overscroll-behavior: none;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  cursor: pointer;
  touch-action: manipulation;
}
button:disabled { cursor: default; opacity: 0.4; }

input {
  font: inherit;
  color: inherit;
}

img.ss-sprite {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: -webkit-optimize-contrast;
  pointer-events: none;
}

.ss-scroll {
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.ss-scroll::-webkit-scrollbar { display: none; }

/* --- shell ------------------------------------------------------------------ */
.ss-app {
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: 4.8rem minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 0.5rem;
  padding: 0.5rem;
}

.ss-rail {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-height: 0;
}

.ss-main {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  min-height: 0;
}

/* A portrait browser window (the screen rotated, or a split view) moves the team to a
   row across the top so the line keeps the full width. */
@media (orientation: portrait) {
  .ss-app {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
  .ss-rail { flex-direction: row; }
  .ss-rail .ss-rail-list { flex-direction: row; }
  .ss-line-btn, .ss-add-line { width: 3.9rem; flex-shrink: 0; }
}

/* --- team rail ---------------------------------------------------------------- */
.ss-rail-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.ss-line-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.3rem 0.2rem 0.25rem;
  border-radius: ${theme.radius.lg}px;
  border: 1px solid ${c.border};
  background: ${c.panel};
  flex-shrink: 0;
}
.ss-line-btn.ss-on {
  border-color: ${c.accent};
  background: ${c.accentDim};
  box-shadow: 0 0 0 1px ${c.accent} inset;
}
.ss-line-btn:active { transform: scale(0.96); }
.ss-line-sprite {
  width: 2.7rem;
  height: 2.7rem;
}
.ss-line-meta {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.62rem;
  color: ${c.textDim};
  white-space: nowrap;
}
.ss-line-num {
  position: absolute;
  left: 0.3rem;
  top: 0.2rem;
  font-size: 0.62rem;
  font-weight: 800;
  color: ${c.textFaint};
}
.ss-line-btn.ss-on .ss-line-num { color: ${c.accent}; }
.ss-line-lock {
  position: absolute;
  right: 0.3rem;
  top: 0.25rem;
  color: ${c.locked};
}

.ss-add-line {
  min-height: 2.8rem;
  border-radius: ${theme.radius.lg}px;
  border: 1px dashed ${c.borderStrong};
  color: ${c.textDim};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ss-add-line:active { background: ${c.accentDim}; }

/* --- line header ---------------------------------------------------------------- */
.ss-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.6rem;
  flex-shrink: 0;
}
.ss-head-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}
.ss-head-title {
  font-size: 1rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ss-head-sub {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  color: ${c.textFaint};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ss-head-sub.ss-marked { color: ${c.accent}; }

.ss-icon-btn {
  width: 2.6rem;
  height: 2.6rem;
  flex-shrink: 0;
  border-radius: ${theme.radius.md}px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${c.textDim};
  background: rgba(255, 255, 255, 0.05);
}
.ss-icon-btn:active { background: ${c.accentDim}; color: ${c.text}; }

/* --- evolution strip -------------------------------------------------------------- */
.ss-strip {
  flex-shrink: 0;
  border-radius: ${theme.radius.lg}px;
  background: ${c.panel};
  border: 1px solid ${c.border};
}
.ss-strip-row {
  display: flex;
  align-items: flex-start;
  width: max-content;
  min-width: 100%;
  padding: 0.5rem 0.45rem 0.4rem;
}
.ss-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  width: 5.2rem;
  flex-shrink: 0;
}
.ss-arrow {
  width: 0.9rem;
  height: 4.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${c.textFaint};
  font-size: 1.1rem;
  flex-shrink: 0;
}

.ss-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  width: 100%;
}
.ss-tile:active .ss-frame { transform: scale(0.95); }
.ss-frame {
  position: relative;
  width: 4.4rem;
  height: 4.4rem;
  border-radius: ${theme.radius.md}px;
  overflow: hidden;
  transition: transform 80ms ease-out, box-shadow 80ms ease-out;
}
.ss-tile.ss-inspected .ss-frame {
  box-shadow: 0 0 0 2px ${c.text}, 0 0.3rem 1rem rgba(0, 0, 0, 0.55);
}
.ss-tile-name {
  max-width: 100%;
  font-size: 0.68rem;
  color: ${c.textDim};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ss-tile.ss-inspected .ss-tile-name { color: ${c.text}; font-weight: 600; }
.ss-badge {
  position: absolute;
  padding: 0.05rem 0.25rem;
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: #04121a;
}
.ss-badge-gen { left: 0; bottom: 0; border-top-right-radius: ${theme.radius.sm}px; }
.ss-badge-now { right: 0; top: 0; background: ${c.accent}; border-bottom-left-radius: ${theme.radius.sm}px; }

.ss-ghost {
  width: 4.4rem;
  height: 4.4rem;
  border-radius: ${theme.radius.md}px;
  border: 1px dashed ${c.borderStrong};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${c.textDim};
}
.ss-ghost-label { font-size: 0.68rem; color: ${c.textDim}; }
button:active .ss-ghost { background: ${c.accentDim}; color: ${c.text}; }

.ss-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 2.1rem;
  padding: 0 0.65rem;
  border-radius: 999px;
  border: 1px solid ${c.border};
  background: rgba(255, 255, 255, 0.05);
  color: ${c.textDim};
  font-size: 0.68rem;
  white-space: nowrap;
}
.ss-chip:active { background: ${c.accent}; border-color: ${c.accent}; color: #04121a; }
.ss-chip-spacer { min-height: 2.1rem; }

/* --- details -------------------------------------------------------------------- */
.ss-details {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.55rem 0.6rem 0.7rem;
  border-radius: ${theme.radius.lg}px;
  background: ${c.panel};
  border: 1px solid ${c.border};
}
.ss-detail-top {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}
.ss-detail-frame {
  width: 3.6rem;
  height: 3.6rem;
  border-radius: ${theme.radius.md}px;
  overflow: hidden;
  flex-shrink: 0;
}
.ss-detail-name { font-size: 1.05rem; font-weight: 700; line-height: 1.2; }
.ss-detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem 0.45rem;
  font-size: 0.7rem;
  color: ${c.textDim};
}
.ss-detail-meta img { width: 0.85rem; height: 0.85rem; object-fit: contain; }

.ss-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.ss-action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.6rem;
  padding: 0 0.8rem;
  border-radius: ${theme.radius.md}px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid ${c.border};
  font-size: 0.78rem;
  font-weight: 600;
}
.ss-action:active { background: ${c.accent}; border-color: ${c.accent}; color: #04121a; }
.ss-action.ss-primary { background: ${c.accentDim}; border-color: ${c.accent}; color: ${c.text}; }
.ss-action.ss-danger { color: ${c.danger}; }
.ss-action.ss-danger:active { background: ${c.danger}; border-color: ${c.danger}; color: #180404; }
.ss-action.ss-armed { background: ${c.danger}; border-color: ${c.danger}; color: #180404; }

.ss-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${c.textFaint};
}
.ss-faint { font-size: 0.72rem; color: ${c.textFaint}; }

.ss-reqs { display: flex; flex-direction: column; gap: 0.3rem; }
.ss-req-line { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
.ss-req {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  max-width: 100%;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid ${c.border};
  background: rgba(255, 255, 255, 0.04);
  font-size: 0.72rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ss-req-key { color: ${c.textFaint}; }
.ss-req-value { font-weight: 600; }

.ss-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem 0.9rem;
}
.ss-stat { display: flex; align-items: center; gap: 0.4rem; font-size: 0.66rem; }
.ss-stat-key { width: 1.8rem; color: ${c.textDim}; flex-shrink: 0; }
.ss-stat-bar { flex: 1; height: 0.3rem; border-radius: 0.2rem; background: rgba(255, 255, 255, 0.07); overflow: hidden; }
.ss-stat-fill { height: 100%; border-radius: 0.2rem; }
.ss-stat-value { width: 2.2rem; text-align: right; flex-shrink: 0; }

/* --- sheets (pickers, menus) ----------------------------------------------------- */
.ss-sheet {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.5rem 0.55rem 0.55rem;
  border-radius: ${theme.radius.lg}px;
  background: #0e151e;
  border: 1px solid ${c.borderStrong};
  box-shadow: 0 0.6rem 2rem rgba(0, 0, 0, 0.6);
  animation: ss-rise 140ms ease-out;
}
@keyframes ss-rise { from { opacity: 0; transform: translateY(0.6rem); } to { opacity: 1; transform: none; } }
.ss-sheet-head { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.ss-sheet-title { flex: 1; min-width: 0; font-size: 0.98rem; font-weight: 700; }
.ss-sheet-note { font-size: 0.7rem; color: ${c.textDim}; flex-shrink: 0; }
.ss-sheet-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.35rem; }

.ss-option {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  min-height: 3.6rem;
  padding: 0.4rem 0.5rem;
  border-radius: ${theme.radius.md}px;
  border: 1px solid ${c.border};
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
  flex-shrink: 0;
}
.ss-option:active { background: ${c.accentDim}; border-color: ${c.accent}; }
.ss-option.ss-taken { border-color: ${c.borderStrong}; background: rgba(63, 208, 255, 0.07); }
.ss-option-frame { width: 3rem; height: 3rem; border-radius: ${theme.radius.md}px; overflow: hidden; flex-shrink: 0; }
.ss-option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.ss-option-name { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 600; }
.ss-pill-in {
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #04121a;
  background: ${c.accent};
  border-radius: 999px;
  padding: 0.05rem 0.4rem;
}

.ss-search {
  width: 100%;
  min-height: 2.6rem;
  padding: 0 0.8rem;
  border-radius: ${theme.radius.md}px;
  border: 1px solid ${c.borderStrong};
  background: rgba(0, 0, 0, 0.3);
  outline: none;
  -webkit-user-select: text;
  user-select: text;
}
.ss-search:focus { border-color: ${c.accent}; }
.ss-gens { display: flex; gap: 0.3rem; flex-shrink: 0; }
.ss-gens .ss-chip { flex-shrink: 0; }
.ss-chip.ss-on { background: ${c.accentDim}; border-color: ${c.accent}; color: ${c.text}; }

.ss-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(4.4rem, 1fr));
  gap: 0.4rem;
}
.ss-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.3rem 0.15rem;
  border-radius: ${theme.radius.md}px;
  min-width: 0;
}
.ss-grid-item:active { background: ${c.accentDim}; }
.ss-grid-frame { width: 3.4rem; height: 3.4rem; border-radius: ${theme.radius.md}px; overflow: hidden; }
.ss-grid-name {
  max-width: 100%;
  font-size: 0.62rem;
  color: ${c.textDim};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ss-menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  min-height: 3rem;
  padding: 0 0.8rem;
  border-radius: ${theme.radius.md}px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.85rem;
  text-align: left;
  flex-shrink: 0;
}
.ss-menu-item:active { background: ${c.accentDim}; }
.ss-menu-item.ss-danger { color: ${c.danger}; }
.ss-menu-item.ss-armed { background: ${c.danger}; color: #180404; }

/* --- states ---------------------------------------------------------------------- */
.ss-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  text-align: center;
  padding: 1rem;
  color: ${c.textDim};
  font-size: 0.85rem;
}
.ss-offline {
  position: absolute;
  left: 50%;
  bottom: 0.6rem;
  transform: translateX(-50%);
  z-index: 20;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  background: rgba(40, 12, 12, 0.95);
  border: 1px solid ${c.danger};
  color: ${c.text};
  font-size: 0.72rem;
  white-space: nowrap;
}
`;
