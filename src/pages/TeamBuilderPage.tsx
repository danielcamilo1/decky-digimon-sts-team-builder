import { Focusable, NavEntryPositionPreferences, showModal } from "@decky/ui";
import { useEffect, useRef } from "react";

import { ChainStrip } from "../components/ChainStrip";
import { TeamLineRow } from "../components/TeamLineRow";
import { chainMembers, randomTeam } from "../data/digimon";
import { TEAM_SIZE } from "../data/types";
import { AddDigimonModal } from "../modals/AddDigimonModal";
import { ShareModal } from "../modals/ShareModal";
import { teamStore, useTeam } from "../state/teamStore";
import { useDex } from "../state/useDex";
import { GlobalStyles } from "../ui/GlobalStyles";
import { IconDice, IconPlus, IconShare, IconTrash } from "../ui/icons";
import { ActionButton, ButtonHints, Divider, EmptyState, ScrollArea, SectionLabel } from "../ui/primitives";
import { theme } from "../ui/theme";
import { ChainEditor } from "./ChainEditor";

export const TEAM_BUILDER_ROUTE = "/digimon-time-stranger-team-builder";

export function TeamBuilderPage() {
  const { team, loaded } = useTeam();
  const { dex, error } = useDex();
  // Lets the sidebar hand focus to the line strip when a line is opened. If Steam
  // declines the focus call the selection has still changed, so nothing is lost.
  const stripRef = useRef<HTMLDivElement>(null);

  // The page can be closed by the system (Steam button, game launch), so don't wait
  // on the debounce timer to persist the last edit.
  useEffect(() => () => teamStore.flush(), []);

  const selected = team.chains[team.selected];

  const openAdd = () => {
    if (!dex) return;
    showModal(
      <AddDigimonModal
        dex={dex}
        title="Start a new evolution line"
        actionLabel="Start line"
        onPick={(digimon) => teamStore.addChain(digimon.id)}
      />,
    );
  };

  const openShare = () => {
    showModal(<ShareModal chains={team.chains} onImport={(chains) => teamStore.setChains(chains, 0)} />);
  };

  const rollRandom = () => {
    if (!dex) return;
    // Locked lines survive a reroll — that's the point of the lock.
    teamStore.setChains(randomTeam(dex, TEAM_SIZE, team.chains.filter((c) => c.locked)), 0);
  };

  return (
    <div
      className="dtb-root"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: `radial-gradient(120% 100% at 0% 0%, #16283a 0%, ${theme.color.bg} 60%)`,
        padding: "16px 20px 12px",
        boxSizing: "border-box",
      }}
    >
      <GlobalStyles />

      <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>Team Builder</span>
        <span style={{ fontSize: 12, color: theme.color.textDim }}>Digimon Story: Time Stranger</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: theme.color.textDim }}>
          {team.chains.length} / {TEAM_SIZE} lines
          {team.chains.length > TEAM_SIZE && " (over the in-game limit)"}
        </span>
      </header>

      <div style={{ height: 12, flexShrink: 0 }} />

      {error && (
        <EmptyState
          title="Couldn't load the Digimon data"
          body={`The plugin's bundled dataset didn't load (${error}). Reinstalling the plugin usually fixes this.`}
        />
      )}

      {!error && (!dex || !loaded) && <EmptyState title="Loading Digimon…" body="Reading the bundled dataset." />}

      {!error && dex && loaded && (
        <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
          {/* --- team sidebar ------------------------------------------------ */}
          <div style={{ width: 400, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
            <SectionLabel>Your team</SectionLabel>

            {team.chains.length === 0 ? (
              <div style={{ fontSize: 12, color: theme.color.textFaint, lineHeight: 1.5, padding: "4px 2px" }}>
                No evolution lines yet. Add one below, or roll a random team to start from something.
              </div>
            ) : (
              <ScrollArea style={{ gap: 6, paddingRight: 4 }} navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_Y}>
                {team.chains.map((chain, index) => (
                  <TeamLineRow
                    key={index}
                    chain={chain}
                    index={index}
                    total={team.chains.length}
                    members={chainMembers(chain, dex.byId)}
                    selected={index === team.selected}
                    onOpen={() => stripRef.current?.focus()}
                  />
                ))}
              </ScrollArea>
            )}

            {/* Two columns of two, not a 2x2 grid of siblings: nesting each column in
                its own Focusable makes "down" mean the button below (Add → Share),
                and "right" from the right-hand column leave the sidebar entirely. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              <Divider />
              <Focusable
                navEntryPreferPosition={NavEntryPositionPreferences.MAINTAIN_X}
                style={{ display: "flex", gap: 6 }}
              >
                <Focusable style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <ActionButton icon={<IconPlus />} onClick={openAdd} actionLabel="Add">
                    Add line
                  </ActionButton>
                  <ActionButton icon={<IconShare />} onClick={openShare} actionLabel="Share">
                    Share
                  </ActionButton>
                </Focusable>
                <Focusable style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <ActionButton icon={<IconDice />} onClick={rollRandom} actionLabel="Roll">
                    Random
                  </ActionButton>
                  <ActionButton
                    icon={<IconTrash />}
                    danger
                    disabled={team.chains.length === 0}
                    onClick={() => teamStore.clear()}
                    actionLabel="Clear"
                  >
                    Clear
                  </ActionButton>
                </Focusable>
              </Focusable>
            </div>
          </div>

          <div style={{ width: 1, background: theme.color.border, flexShrink: 0 }} />

          {/* --- editor ------------------------------------------------------ */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            {selected ? (
              <ChainEditor chain={selected} index={team.selected} dex={dex} stripRef={stripRef} />
            ) : (
              <EmptyState
                title="Build your Time Stranger team"
                body="An evolution line is one Digimon and the path it grows along. Add a line to see what it can devolve from and evolve into, with the requirements for each step."
                action={
                  <div style={{ marginTop: 6, opacity: 0.75 }}>
                    <ChainStrip members={dex.sorted.slice(0, 5)} size={40} />
                  </div>
                }
              />
            )}
          </div>
        </div>
      )}

      <div style={{ flexShrink: 0, paddingTop: 10 }}>
        {/* Only the hints whose glyph is unambiguous. Per-element actions (line
            options, lock) publish their own descriptions through Focusable, so Steam
            renders them in its footer with the correct button glyph. */}
        <ButtonHints
          hints={[
            ["A", "Select"],
            ["B", "Back"],
            ["→", "Move from the team list into the line"],
            ["←", "Back to the team list"],
          ]}
        />
      </div>
    </div>
  );
}
