import { Dropdown, Focusable, ModalRoot } from "@decky/ui";
import { useMemo, useState } from "react";

import { ChainStrip } from "../components/ChainStrip";
import { DigimonPortrait } from "../components/DigimonPortrait";
import type { Dex } from "../data/digimon";
import { evolutionsOf, preEvolutionsOf, searchDigimon } from "../data/digimon";
import type { Digimon, Generation } from "../data/types";
import { GENERATIONS } from "../data/types";
import { GlobalStyles } from "../ui/GlobalStyles";
import { ButtonHints, Divider, SectionLabel, TextInput } from "../ui/primitives";
import { theme } from "../ui/theme";

/** Rendering the whole dex at once stutters on the Deck's APU; this is plenty to
 * browse and the search field narrows anything beyond it. */
const MAX_RESULTS = 150;

interface Props {
  dex: Dex;
  title: string;
  onPick: (digimon: Digimon) => void;
  actionLabel?: string;
  closeModal?: () => void;
}

export function AddDigimonModal({ dex, title, onPick, actionLabel = "Add", closeModal }: Props) {
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState<Generation | "All">("All");
  const [preview, setPreview] = useState<Digimon | null>(null);

  const results = useMemo(() => searchDigimon(dex, query, generation), [dex, query, generation]);
  const shown = results.slice(0, MAX_RESULTS);
  const plural = results.length === 1 ? "" : "s";
  const resultSummary =
    results.length > shown.length
      ? `Showing ${shown.length} of ${results.length} — keep typing to narrow`
      : `${results.length} result${plural}`;

  const generationOptions = useMemo(
    () => [
      { data: "All" as const, label: "All stages" },
      ...GENERATIONS.map((g) => ({ data: g, label: g })),
    ],
    [],
  );

  return (
    <ModalRoot closeModal={closeModal} onCancel={closeModal} bAllowFullSize>
      <GlobalStyles />
      <div className="dtb-root" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 520 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>

        <Focusable style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextInput
              label="Search"
              placeholder="Agumon, Dragon, greymon…"
              value={query}
              focusOnMount
              bShowClearAction
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ width: 200, flexShrink: 0 }}>
            <Dropdown
              rgOptions={generationOptions}
              selectedOption={generation}
              strDefaultLabel="All stages"
              onChange={(option) => setGeneration(option.data)}
            />
          </div>
        </Focusable>

        <Divider />

        <SectionLabel
          right={<span style={{ fontSize: 11, color: theme.color.textFaint }}>{resultSummary}</span>}
        >
          Results
        </SectionLabel>

        <Focusable
          className="dtb-scroll"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignContent: "flex-start",
            overflowY: "auto",
            height: 300,
            padding: 2,
          }}
        >
          {shown.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: theme.color.textDim }}>
              No Digimon match that search.
            </div>
          )}
          {shown.map((digimon) => (
            <DigimonPortrait
              key={digimon.id}
              digimon={digimon}
              size="md"
              showName
              showGeneration
              emphasis="option"
              actionLabel={actionLabel}
              onFocus={() => setPreview(digimon)}
              onActivate={() => {
                onPick(digimon);
                closeModal?.();
              }}
            />
          ))}
        </Focusable>

        <Divider />
        <PreviewBar digimon={preview} dex={dex} />
        <ButtonHints
          hints={[
            ["A", actionLabel],
            ["B", "Cancel"],
          ]}
        />
      </div>
    </ModalRoot>
  );
}

/** Context for the focused result so picking is an informed choice rather than a
 * guess from a 64px sprite. */
function PreviewBar({ digimon, dex }: { digimon: Digimon | null; dex: Dex }) {
  if (!digimon) {
    return <div style={{ height: 44, fontSize: 12, color: theme.color.textFaint }}>Highlight a Digimon to preview its evolution neighbours.</div>;
  }

  const from = preEvolutionsOf(digimon, dex.byId);
  const into = evolutionsOf(digimon, dex.byId);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, height: 44, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{digimon.name}</span>
      <span style={{ fontSize: 11, color: theme.color.textDim, flexShrink: 0 }}>
        {digimon.generation} · {digimon.attribute}
      </span>
      <NeighbourGroup label="From" members={from} />
      <NeighbourGroup label="Into" members={into} />
    </div>
  );
}

function NeighbourGroup({ label, members }: { label: string; members: Digimon[] }) {
  if (!members.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 10, letterSpacing: 0.6, color: theme.color.textFaint, textTransform: "uppercase" }}>
        {label}
      </span>
      <ChainStrip members={members} size={26} max={6} arrows={false} />
    </div>
  );
}
