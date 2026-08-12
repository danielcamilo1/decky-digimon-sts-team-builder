import { Focusable, ModalRoot } from "@decky/ui";

import { DigimonPortrait } from "../components/DigimonPortrait";
import { formatRequirements } from "../data/digimon";
import type { Digimon } from "../data/types";
import { GlobalStyles } from "../ui/GlobalStyles";
import { ButtonHints, Divider, SectionLabel } from "../ui/primitives";
import { attributeColor, theme } from "../ui/theme";

interface Props {
  /** The Digimon the branch is being chosen from. */
  source: Digimon;
  options: Digimon[];
  /** The option currently taken in the line, if any. */
  currentId?: number;
  direction: "evolve" | "devolve";
  onPick: (digimon: Digimon) => void;
  closeModal?: () => void;
}

/**
 * Picks one branch of the evolution graph. Deliberately not the search browser: there
 * are at most six options here, so each gets a full row with its requirements spelled
 * out — that's the information you actually need to choose.
 */
export function ChooseEvolutionModal({ source, options, currentId, direction, onPick, closeModal }: Props) {
  const evolving = direction === "evolve";

  return (
    <ModalRoot closeModal={closeModal} onCancel={closeModal} bAllowFullSize>
      <GlobalStyles />
      <div className="dtb-root" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {evolving ? `Evolve ${source.name} into…` : `${source.name} devolves from…`}
        </div>
        <div style={{ fontSize: 12, color: theme.color.textDim }}>
          {evolving
            ? "Picking a different branch replaces everything after this Digimon in the line."
            : "The chosen Digimon is added to the front of the line."}
        </div>

        <Divider />
        <SectionLabel>{options.length} option{options.length === 1 ? "" : "s"}</SectionLabel>

        <Focusable
          className="dtb-scroll"
          style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto", padding: 2 }}
        >
          {options.map((option) => {
            const current = option.id === currentId;
            const requirements = formatRequirements(option.evolution_conditions ?? []);
            return (
              <Focusable
                key={option.id}
                className="dtb-row"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: 8 }}
                onActivate={() => {
                  onPick(option);
                  closeModal?.();
                }}
                onOKActionDescription={current ? "Keep" : "Choose"}
              >
                <DigimonPortrait digimon={option} size="md" showGeneration emphasis={current ? "member" : "option"} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{option.name}</span>
                    <span style={{ fontSize: 11, color: attributeColor(option.attribute) }}>{option.attribute}</span>
                    <span style={{ fontSize: 11, color: theme.color.textDim }}>
                      {option.generation} · {option.type}
                    </span>
                    {/* The personality each branch arrives with is part of choosing one,
                        so it's on the row rather than a modal deeper. */}
                    {option.base_personality && (
                      <span style={{ fontSize: 11, color: theme.color.textDim }}>
                        <span style={{ color: theme.color.textFaint }}>personality </span>
                        {option.base_personality}
                      </span>
                    )}
                    {current && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          color: "#04121a",
                          background: theme.color.accent,
                          borderRadius: 999,
                          padding: "1px 7px",
                        }}
                      >
                        IN LINE
                      </span>
                    )}
                  </div>
                  {requirements.length > 0 && (
                    <span style={{ fontSize: 11, color: theme.color.textDim }}>{requirements.join("   |   ")}</span>
                  )}
                </div>
              </Focusable>
            );
          })}
        </Focusable>

        <Divider />
        <ButtonHints
          hints={[
            ["A", "Choose"],
            ["B", "Cancel"],
          ]}
        />
      </div>
    </ModalRoot>
  );
}
