import { toaster } from "@decky/api";
import { ButtonItem, Navigation, PanelSection, PanelSectionRow, showModal } from "@decky/ui";

import { ChainStrip } from "../components/ChainStrip";
import { chainMembers, randomTeam } from "../data/digimon";
import { TEAM_SIZE } from "../data/types";
import { ShareModal } from "../modals/ShareModal";
import { TEAM_BUILDER_ROUTE } from "../pages/TeamBuilderPage";
import { teamStore, useTeam } from "../state/teamStore";
import { useDex } from "../state/useDex";
import { GlobalStyles } from "../ui/GlobalStyles";
import { IconDice, IconShare } from "../ui/icons";
import { theme } from "../ui/theme";

/**
 * The Quick Access column is ~310px wide and shares the screen with a running game,
 * so this stays a summary plus the two actions worth doing without leaving the game.
 * The actual building happens on the full-screen route.
 */
export function QuickAccessPanel() {
  const { team, loaded } = useTeam();
  const { dex, error } = useDex();

  const openBuilder = () => {
    Navigation.CloseSideMenus();
    Navigation.Navigate(TEAM_BUILDER_ROUTE);
  };

  return (
    <div className="dtb-root">
      <GlobalStyles />

      <PanelSection title="Team">
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

        {!error && loaded && dex && team.chains.length === 0 && (
          <PanelSectionRow>
            <div style={{ fontSize: 12, color: theme.color.textDim, lineHeight: 1.45 }}>
              No evolution lines yet. Open the builder to plan one, or roll a random team below.
            </div>
          </PanelSectionRow>
        )}

        {!error &&
          loaded &&
          dex &&
          team.chains.map((chain, index) => {
            const members = chainMembers(chain, dex.byId);
            return (
              <PanelSectionRow key={index}>
                <ButtonItem
                  layout="below"
                  bottomSeparator="none"
                  onClick={() => {
                    teamStore.select(index);
                    openBuilder();
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 11, color: theme.color.textDim }}>
                      {members.at(-1)?.name ?? "Empty line"}
                      {chain.locked && " · locked"}
                    </span>
                    <ChainStrip members={members} size={28} max={5} />
                  </div>
                </ButtonItem>
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
