import { Focusable, Menu, MenuItem, MenuSeparator, showContextMenu } from "@decky/ui";
import { useRef } from "react";

import { chainLabel } from "../data/digimon";
import type { Chain, Digimon } from "../data/types";
import { teamStore } from "../state/teamStore";
import { IconDots, IconLock } from "../ui/icons";
import { exitRight } from "../ui/nav";
import { theme } from "../ui/theme";
import { ChainStrip } from "./ChainStrip";

interface Props {
  chain: Chain;
  index: number;
  total: number;
  members: Digimon[];
  selected: boolean;
  /** Called when the row body is activated — opens this line in the detail panel. */
  onOpen: () => void;
  /** Target for d-pad right off the ⋮, which is the sidebar's right edge. */
  onExitRight: () => HTMLElement | null;
}

/**
 * One line in the team sidebar, split into two targets: the body opens the line in the
 * detail panel, and the ⋮ button at the end opens the line's own menu. Keeping them
 * separate means a tap on the row does the obvious thing instead of a menu appearing.
 */
export function TeamLineRow({ chain, index, total, members, selected, onOpen, onExitRight }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    showContextMenu(
      <Menu label={`Line ${index + 1}`} cancelText="Close">
        <MenuItem disabled={index === 0} onSelected={() => teamStore.move(index, -1)}>
          Move up
        </MenuItem>
        <MenuItem disabled={index === total - 1} onSelected={() => teamStore.move(index, 1)}>
          Move down
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelected={() => teamStore.toggleLock(index)}>
          {chain.locked ? "Unlock line" : "Lock line (kept when rolling a random team)"}
        </MenuItem>
        {chain.current !== undefined && (
          <MenuItem onSelected={() => teamStore.setCurrent(index, null)}>Clear the current-stage mark</MenuItem>
        )}
        <MenuSeparator />
        <MenuItem tone="destructive" onSelected={() => teamStore.removeChain(index)}>
          Remove line
        </MenuItem>
      </Menu>,
      dotsRef.current ?? ref.current ?? undefined,
    );
  };

  const label = chainLabel(members);

  const select = () => {
    teamStore.select(index);
    ref.current?.scrollIntoView({ block: "nearest" });
  };

  return (
    <Focusable
      ref={ref}
      className={`dtb-row${selected ? " dtb-selected" : ""}`}
      focusWithinClassName="gpfocuswithin"
      style={{ display: "flex", alignItems: "stretch", gap: 4, padding: 2 }}
    >
      <Focusable
        className="dtb-row-body"
        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, padding: "6px 8px" }}
        onActivate={() => {
          select();
          onOpen();
        }}
        onGamepadFocus={select}
        onMenuButton={openMenu}
        onSecondaryButton={() => teamStore.toggleLock(index)}
        onOKActionDescription="Open line"
        onSecondaryActionDescription={chain.locked ? "Unlock line" : "Lock line"}
        onMenuActionDescription="Line options"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: theme.color.textFaint, flexShrink: 0 }}>
            {index + 1}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={label}
          >
            {label}
          </span>
          {chain.locked && (
            <span style={{ marginLeft: "auto", display: "flex" }}>
              <IconLock size={10} color={theme.color.locked} />
            </span>
          )}
        </div>
        <ChainStrip members={members} size={34} max={7} currentId={chain.current} />
      </Focusable>

      <Focusable
        ref={dotsRef}
        className="dtb-dots"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, flexShrink: 0 }}
        onActivate={openMenu}
        onGamepadFocus={select}
        onButtonDown={exitRight(onExitRight)}
        onOKActionDescription="Line options"
        aria-label={`Options for line ${index + 1}`}
      >
        <IconDots size={16} />
      </Focusable>
    </Focusable>
  );
}
