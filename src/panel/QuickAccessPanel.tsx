import { toaster } from "@decky/api";
import { ButtonItem, Focusable, Navigation, PanelSection, PanelSectionRow, showModal } from "@decky/ui";

import { ChainStrip } from "../components/ChainStrip";
import { chainLabel, chainMembers, lineProgress, randomTeam } from "../data/digimon";
import { TEAM_SIZE } from "../data/types";
import { ShareModal } from "../modals/ShareModal";
import { TEAM_BUILDER_ROUTE } from "../pages/TeamBuilderPage";
import { requestOpen } from "../state/openIntent";
import type { PanelView } from "../state/panelView";
import { setPanelView, usePanelView } from "../state/panelView";
import { teamStore, useTeam } from "../state/teamStore";
import { useDex } from "../state/useDex";
import { GlobalStyles } from "../ui/GlobalStyles";
import { IconCheck, IconDice, IconLock, IconShare } from "../ui/icons";
import { theme } from "../ui/theme";
import { NextStepRow } from "./NextStepRow";

const VIEWS: { value: PanelView; label: string; title: string }[] = [
  { value: "lines", label: "Lines", title: "Your team" },
  { value: "next", label: "Next up", title: "What's next" },
];

/**
 * The Quick Access column is ~310px wide and shares the screen with a running game, so
 * it holds the two things worth reading without leaving the game, on a switch:
 *
 * - *Lines* — the team at a glance, every evolution line and its sprites.
 * - *Next up* — for each line, the evolution it's working towards and what that needs,
 *   read from the stage you've marked in the builder.
 *
 * The actual building happens on the full-screen route, which a line opens straight into.
 */
export function QuickAccessPanel() {
  const { team, loaded } = useTeam();
  const { dex, error } = useDex();
  const view = usePanelView();

  const openBuilder = () => {
    Navigation.CloseSideMenus();
    Navigation.Navigate(TEAM_BUILDER_ROUTE);
  };

  /** Opening a specific line lands focus on the line itself, not the team list. */
  const openLine = (index: number) => {
    teamStore.select(index);
    requestOpen("line");
    openBuilder();
  };

  const ready = !error && loaded && !!dex;
  const section = VIEWS.find((v) => v.value === view) ?? VIEWS[0];

  return (
    <div className="dtb-root">
      <GlobalStyles />

      <PanelSection title={section.title}>
        <PanelSectionRow>
          <Focusable style={{ display: "flex", gap: 6 }}>
            {VIEWS.map((option) => (
              <Focusable
                key={option.value}
                className={`dtb-seg${option.value === view ? " dtb-seg-on" : ""}`}
                onActivate={() => setPanelView(option.value)}
                onOKActionDescription={`Show ${option.label}`}
                aria-label={`Show ${option.label}`}
              >
                {option.label}
              </Focusable>
            ))}
          </Focusable>
        </PanelSectionRow>

        {error && (
          <PanelSectionRow>
            <div style={{ fontSize: 12, color: theme.color.danger }}>Couldn't load the Digimon data.</div>
          </PanelSectionRow>
        )}

        {!error && (!loaded || !dex) && (
          <PanelSectionRow>
            <div style={{ fontSize: 12, color: theme.color.textDim }}>Loading…</div>
          </PanelSectionRow>
        )}

        {ready && team.chains.length === 0 && (
          <PanelSectionRow>
            <div style={{ fontSize: 12, color: theme.color.textDim, lineHeight: 1.45 }}>
              No evolution lines yet. Open the builder to plan one, or roll a random team below.
            </div>
          </PanelSectionRow>
        )}

        {ready && team.chains.length > 0 && (
          <PanelSectionRow>
            <div style={{ fontSize: 11, color: theme.color.textFaint, lineHeight: 1.45 }}>
              {view === "lines"
                ? `${team.chains.length} of ${TEAM_SIZE} evolution lines. Pick one to open it in the builder.`
                : "What each line evolves into next, and what it takes. Y marks one as reached."}
            </div>
          </PanelSectionRow>
        )}

        {ready &&
          view === "lines" &&
          team.chains.map((chain, index) => {
            const members = chainMembers(chain, dex.byId);
            return (
              <PanelSectionRow key={index}>
                <ButtonItem layout="below" bottomSeparator="none" onClick={() => openLine(index)}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "stretch", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: theme.color.textFaint, flexShrink: 0 }}>
                        {index + 1}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12,
                          fontWeight: 600,
                          textAlign: "left",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={chainLabel(members)}
                      >
                        {chainLabel(members)}
                      </span>
                      {chain.locked && (
                        <span style={{ display: "flex", flexShrink: 0 }}>
                          <IconLock size={10} color={theme.color.locked} />
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: theme.color.textFaint, flexShrink: 0 }}>
                        {members.length} stage{members.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ChainStrip members={members} size={28} max={5} currentId={chain.current} />
                  </div>
                </ButtonItem>
              </PanelSectionRow>
            );
          })}

        {/* Custom rows rather than ButtonItem: these carry a second action (advancing
            the mark), and ButtonItem takes no footer-legend props. */}
        {ready &&
          view === "next" &&
          team.chains.map((chain, index) => {
            const progress = lineProgress(chain, dex.byId);
            return (
              <PanelSectionRow key={index}>
                <NextStepRow
                  index={index}
                  progress={progress}
                  onOpen={() => openLine(index)}
                  onAdvance={() => {
                    // Advanced through the resolved line rather than through the raw
                    // ids, so the mark lands on exactly what the row is showing.
                    if (!progress.next) return;
                    teamStore.setCurrent(index, progress.next.id);
                    toaster.toast({
                      title: `Now on ${progress.next.name}`,
                      body: `Line ${index + 1}`,
                      icon: <IconCheck />,
                    });
                  }}
                />
              </PanelSectionRow>
            );
          })}
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={openBuilder}>
            Open Team Builder
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={!dex}
            onClick={() => {
              if (!dex) return;
              const kept = team.chains.filter((c) => c.locked);
              teamStore.setChains(randomTeam(dex, TEAM_SIZE, kept), 0);
              toaster.toast({
                title: "Rolled a random team",
                body: kept.length ? `${kept.length} locked line${kept.length === 1 ? "" : "s"} kept` : "6 evolution lines",
                icon: <IconDice />,
              });
            }}
          >
            Random Team
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => showModal(<ShareModal chains={team.chains} onImport={(chains) => teamStore.setChains(chains, 0)} />)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconShare /> Share / load a team
            </span>
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
}
