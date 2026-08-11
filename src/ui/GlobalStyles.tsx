import { theme } from "./theme";

/**
 * Steam's gamepad navigation puts `gpfocus` on the focused element and
 * `gpfocuswithin` on its ancestors, so focus styling is plain CSS. Rendered once per
 * mounted surface; duplicate <style> tags are harmless and unmount with their tree.
 */
const CSS = `
.dtb-root {
  color: ${theme.color.text};
  font-size: 14px;
  line-height: 1.35;
}

/* --- focusable tiles ------------------------------------------------------ */
.dtb-tile {
  position: relative;
  border-radius: ${theme.radius.md}px;
  transition: transform 90ms ease-out, box-shadow 90ms ease-out, background-color 90ms ease-out;
  outline: none;
}
.dtb-tile.gpfocus {
  transform: scale(1.08);
  z-index: 2;
  box-shadow: 0 0 0 2px ${theme.color.accent}, 0 6px 20px rgba(0, 0, 0, 0.55);
}
.dtb-tile.dtb-disabled.gpfocus {
  transform: none;
  box-shadow: 0 0 0 2px ${theme.color.borderStrong};
}

/* --- rows (team lines, list entries) -------------------------------------- */
.dtb-row {
  border-radius: ${theme.radius.md}px;
  border: 1px solid ${theme.color.border};
  background: ${theme.color.panel};
  transition: background-color 90ms ease-out, border-color 90ms ease-out;
  outline: none;
}
.dtb-row.gpfocus,
.dtb-row.gpfocuswithin {
  border-color: ${theme.color.accent};
  background: ${theme.color.accentDim};
}
.dtb-row.dtb-selected {
  border-color: ${theme.color.borderStrong};
  background: rgba(63, 208, 255, 0.07);
}

/* The row body and its ⋮ button are separate targets inside one row shell, so they
   get their own highlight while the shell shows the selection. */
.dtb-row-body,
.dtb-dots {
  border-radius: ${theme.radius.sm}px;
  transition: background-color 90ms ease-out;
  outline: none;
}
.dtb-row-body.gpfocus,
.dtb-dots.gpfocus {
  background: rgba(255, 255, 255, 0.10);
  box-shadow: inset 0 0 0 1px ${theme.color.accent};
}
.dtb-dots {
  color: ${theme.color.textFaint};
}
.dtb-dots.gpfocus {
  color: ${theme.color.text};
}

/* --- small inline controls (edit / evolve under a tile) ------------------- */
.dtb-chip {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid ${theme.color.border};
  background: rgba(255, 255, 255, 0.05);
  color: ${theme.color.textDim};
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  transition: background-color 90ms ease-out, color 90ms ease-out, border-color 90ms ease-out;
  outline: none;
}
.dtb-chip.gpfocus {
  background: ${theme.color.accent};
  border-color: ${theme.color.accent};
  color: #04121a;
  font-weight: 600;
}

/* --- text buttons --------------------------------------------------------- */
.dtb-action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: ${theme.radius.md}px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.05);
  color: ${theme.color.text};
  transition: background-color 90ms ease-out, border-color 90ms ease-out;
  outline: none;
}
.dtb-action.gpfocus {
  background: ${theme.color.accent};
  border-color: ${theme.color.accent};
  color: #04121a;
  font-weight: 600;
}
.dtb-action.dtb-danger.gpfocus {
  background: ${theme.color.danger};
  border-color: ${theme.color.danger};
  color: #180404;
}

/* Sprites are pixel art upscaled by the source; keep the edges crisp. */
.dtb-sprite {
  image-rendering: -webkit-optimize-contrast;
  object-fit: contain;
}

.dtb-scroll::-webkit-scrollbar { width: 6px; }
.dtb-scroll::-webkit-scrollbar-thumb {
  background: ${theme.color.borderStrong};
  border-radius: 3px;
}
`;

export function GlobalStyles() {
  return <style>{CSS}</style>;
}
