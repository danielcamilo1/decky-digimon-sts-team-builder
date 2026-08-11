import { Focusable, NavEntryPositionPreferences, showModal } from "@decky/ui";
import type { GamepadEvent } from "@decky/ui";
import type { RefObject } from "react";
import { useEffect, useState } from "react";

import { EvolutionRequirements } from "../components/DigimonDetails";
import { DigimonPortrait } from "../components/DigimonPortrait";
import type { Dex } from "../data/digimon";
import { chainMembers, evolutionsOf, prependOptions } from "../data/digimon";
import type { Chain, Digimon } from "../data/types";
import { ChooseEvolutionModal } from "../modals/ChooseEvolutionModal";
import { DigimonDetailModal } from "../modals/DigimonDetailModal";
import { teamStore } from "../state/teamStore";
import { IconEdit, IconLock, IconPlus } from "../ui/icons";
import { exitLeft } from "../ui/nav";
import { Divider, SectionLabel } from "../ui/primitives";
import { attributeColor, theme } from "../ui/theme";

const TILE = 88;
/** Column width shared by both rows so a chip sits directly under its tile. */
const CELL = TILE + 24;
const ARROW = 22;
/** Room for the focus ring. The strip scrolls horizontally, and a box with
 * overflow-x also clips vertically, so the ring needs padding on every side. */
const STRIP_PAD = 28;

type Cell =
  | { kind: "add"; key: string }
  | { kind: "arrow"; key: string }
  | { kind: "tile"; key: string; digimon: Digimon; position: number };

interface Props {
  chain: Chain;
  index: number;
  dex: Dex;
  /** Focused by the sidebar when a line is opened. */
  stripRef?: RefObject<HTMLDivElement | null>;
  /** Target for d-pad left off the first cell — back to the team sidebar. */
  onExitLeft?: () => HTMLElement | null;
}

/**
 * The selected line laid out left-to-right, the way an evolution reads.
 *
 * The tiles and the edit chips are two sibling rows rather than one row of stacked
 * columns, so d-pad left/right walks along the line and down/up switches between
 * "which Digimon" and "which branch" — matching how they're placed on screen.
 */
export function ChainEditor({ chain, index, dex, stripRef, onExitLeft }: Props) {
  const members = chainMembers(chain, dex.byId);
  const before = chain.locked ? [] : prependOptions(chain, dex.byId);

  const tail = members.at(-1) ?? null;
  const [inspected, setInspected] = useState<Digimon | null>(tail);

  // Follow the selection when the user switches lines or edits this one.
  useEffect(() => {
    setInspected((current) => (current && members.some((m) => m.id === current.id) ? current : tail));
  }, [chain.ids.join(","), index]);

  const openDetails = (digimon: Digimon, position: number) => {
    showModal(
      <DigimonDetailModal
        digimon={digimon}
        dex={dex}
        line={{
          position,
          length: members.length,
          locked: chain.locked,
          onRemove: () => teamStore.trimAt(index, digimon.id),
        }}
      />,
    );
  };

  const openBranchPicker = (digimon: Digimon, position: number) => {
    showModal(
      <ChooseEvolutionModal
        source={digimon}
        options={evolutionsOf(digimon, dex.byId)}
        currentId={chain.ids[position + 1]}
        direction="evolve"
        onPick={(picked) => teamStore.chooseBranch(index, position, picked.id)}
      />,
    );
  };

  const openPrependPicker = () => {
    const head = members[0];
    if (!head) return;
    showModal(
      <ChooseEvolutionModal
        source={head}
        options={before}
        direction="devolve"
        onPick={(picked) => teamStore.prepend(index, picked.id)}
      />,
    );
  };

  // One cell list drives both rows, which is what keeps the columns aligned.
  const cells: Cell[] = [];
  if (before.length > 0) {
    cells.push({ kind: "add", key: "add" }, { kind: "arrow", key: "arrow-add" });
  }
  members.forEach((digimon, position) => {
    if (position > 0) cells.push({ kind: "arrow", key: `arrow-${position}` });
    cells.push({ kind: "tile", key: `${digimon.id}-${position}`, digimon, position });
  });

  const branchesFor = (digimon: Digimon) => (chain.locked ? [] : evolutionsOf(digimon, dex.byId));
  const showChips = members.some((d) => branchesFor(d).length > 0);

  // Only the leftmost target in each row hands focus back to the sidebar; the rest
  // navigate normally along the line.
  const goBack = onExitLeft ? exitLeft(onExitLeft) : undefined;
  const firstChipKey = cells.find((c) => c.kind === "tile" && branchesFor(c.digimon).length > 0)?.key;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SectionLabel>Evolution line {index + 1}</SectionLabel>
        {chain.locked && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: theme.color.locked }}>
            <IconLock size={10} /> Locked — unlock from the line's ⋮ menu to edit it
          </span>
        )}
      </div>

      <div
        className="dtb-scroll"
        style={{
          borderRadius: theme.radius.lg,
          background: theme.color.panel,
          border: `1px solid ${theme.color.border}`,
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        <Focusable
          ref={stripRef}
          navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: STRIP_PAD,
            width: "fit-content",
            minWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Row 1 — the Digimon themselves. */}
          <Focusable
            navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
            style={{ display: "flex", alignItems: "flex-start" }}
          >
            {cells.map((cell) => {
              if (cell.kind === "arrow") return <ArrowCell key={cell.key} />;
              if (cell.kind === "add") {
                return (
                  <AddNode
                    key={cell.key}
                    hint={`Add a pre-evolution before ${members[0]?.name ?? "this line"}`}
                    onActivate={openPrependPicker}
                    onButtonDown={cell.key === cells[0].key ? goBack : undefined}
                  />
                );
              }
              return (
                <div key={cell.key} style={{ width: CELL, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                  <DigimonPortrait
                    digimon={cell.digimon}
                    size="lg"
                    showName
                    showGeneration
                    emphasis="member"
                    onActivate={() => openDetails(cell.digimon, cell.position)}
                    actionLabel="Details"
                    onFocus={() => setInspected(cell.digimon)}
                    onButtonDown={cell.key === cells[0].key ? goBack : undefined}
                  />
                </div>
              );
            })}
          </Focusable>

          {/* Row 2 — which branch the line takes from each Digimon. Empty cells keep
              the chips lined up under their tiles. */}
          {showChips && (
            <Focusable
              navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
              style={{ display: "flex", alignItems: "flex-start" }}
            >
              {cells.map((cell) => {
                if (cell.kind === "arrow") return <div key={cell.key} style={{ width: ARROW, flexShrink: 0 }} />;
                if (cell.kind === "add") return <div key={cell.key} style={{ width: CELL, flexShrink: 0 }} />;

                const branches = branchesFor(cell.digimon);
                const isLast = cell.position === members.length - 1;
                return (
                  <div key={cell.key} style={{ width: CELL, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                    {branches.length > 0 && (
                      <Focusable
                        className="dtb-chip"
                        style={{ display: "flex", alignItems: "center", gap: 4 }}
                        onActivate={() => openBranchPicker(cell.digimon, cell.position)}
                        onGamepadFocus={() => setInspected(cell.digimon)}
                        onButtonDown={cell.key === firstChipKey ? goBack : undefined}
                        onOKActionDescription={isLast ? "Choose evolution" : "Change evolution"}
                        aria-label={`${isLast ? "Evolve" : "Change evolution of"} ${cell.digimon.name}`}
                      >
                        {isLast ? <IconPlus size={11} /> : <IconEdit size={11} />}
                        <span>{isLast ? "Evolve" : "Change"}</span>
                      </Focusable>
                    )}
                  </div>
                );
              })}
            </Focusable>
          )}
        </Focusable>
      </div>

      <Divider />

      <div className="dtb-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
        {inspected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{inspected.name}</span>
              <span style={{ fontSize: 12, color: attributeColor(inspected.attribute) }}>{inspected.attribute}</span>
              <span style={{ fontSize: 12, color: theme.color.textDim }}>
                {inspected.generation} · {inspected.type}
              </span>
              <span style={{ fontSize: 11, color: theme.color.textFaint }}>Select the tile for full details</span>
            </div>
            <SectionLabel>How to evolve into {inspected.name}</SectionLabel>
            <EvolutionRequirements digimon={inspected} />
          </div>
        ) : (
          <div style={{ fontSize: 12, color: theme.color.textFaint }}>Highlight a Digimon to see its details.</div>
        )}
      </div>
    </div>
  );
}

function ArrowCell() {
  return (
    <div
      style={{ width: ARROW, height: TILE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      <span aria-hidden style={{ fontSize: 20, color: theme.color.textDim, lineHeight: 1 }}>
        ›
      </span>
    </div>
  );
}

/** The leading "add a pre-evolution" cell, shaped like a tile so the row reads evenly. */
function AddNode({
  hint,
  onActivate,
  onButtonDown,
}: {
  hint: string;
  onActivate: () => void;
  onButtonDown?: (evt: GamepadEvent) => void;
}) {
  return (
    <div style={{ width: CELL, display: "flex", justifyContent: "center", flexShrink: 0 }}>
      <Focusable
        className="dtb-tile"
        style={{ padding: 2 }}
        onActivate={onActivate}
        onButtonDown={onButtonDown}
        onOKActionDescription={hint}
        aria-label={hint}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: TILE }}>
          <div
            style={{
              width: TILE,
              height: TILE,
              borderRadius: theme.radius.md,
              border: `1px dashed ${theme.color.borderStrong}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.color.textDim,
              boxSizing: "border-box",
            }}
          >
            <IconPlus size={24} />
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.2, color: theme.color.textDim }}>Devolve</div>
        </div>
      </Focusable>
    </div>
  );
}
