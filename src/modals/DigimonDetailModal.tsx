import { Focusable, ModalRoot } from "@decky/ui";
import { useEffect, useRef } from "react";

import { ChainStrip } from "../components/ChainStrip";
import { DigimonHeader, EvolutionRequirements, StatBars } from "../components/DigimonDetails";
import { spriteUrl } from "../data/assets";
import type { Dex } from "../data/digimon";
import { evolutionsOf, preEvolutionsOf } from "../data/digimon";
import type { Digimon } from "../data/types";
import { GlobalStyles } from "../ui/GlobalStyles";
import { IconFlag } from "../ui/icons";
import { ActionButton, ButtonHints, Divider, SectionLabel } from "../ui/primitives";
import { attributeColor, theme } from "../ui/theme";

export interface LineContext {
  /** Where this Digimon sits in the line, and how long the line is. */
  position: number;
  length: number;
  locked: boolean;
  /** Whether this is the stage the line is marked as having reached. */
  isCurrent: boolean;
  onRemove: () => void;
  onToggleCurrent: () => void;
}

interface Props {
  digimon: Digimon;
  dex: Dex;
  /** Omitted when the Digimon isn't part of a line (e.g. opened from a picker). */
  line?: LineContext;
  closeModal?: () => void;
}

/** Everything known about one Digimon, plus the line actions that apply to it. */
export function DigimonDetailModal({ digimon, dex, line, closeModal }: Props) {
  const from = preEvolutionsOf(digimon, dex.byId);
  const into = evolutionsOf(digimon, dex.byId);
  const accent = attributeColor(digimon.attribute);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Belt and braces alongside the pinned header: if Steam's mount-time focus does
  // scroll the body, put it back to the top.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      node.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <ModalRoot closeModal={closeModal} onCancel={closeModal} bAllowFullSize>
      <GlobalStyles />
      {/* The header and the action row sit outside the scroll region. Steam focuses the
          first focusable on mount and scrolls it into view, which would otherwise open
          the modal already scrolled down to the remove button. */}
      <div className="dtb-root" style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "78vh" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexShrink: 0 }}>
          <img
            className="dtb-sprite"
            src={spriteUrl(digimon)}
            alt={digimon.name}
            width={112}
            height={112}
            style={{
              borderRadius: theme.radius.lg,
              border: `1px solid ${accent}`,
              background: `linear-gradient(160deg, ${accent}38, rgba(10, 15, 22, 0.9))`,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DigimonHeader digimon={digimon} />
              </div>
              {/* The line action lives up here, not at the foot of the modal: it's the
                  only focusable, so Steam focuses it on mount and scrolls it into view.
                  At the bottom that opened the modal already scrolled past the header. */}
              {line && (
                <Focusable style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {/* Offered on locked lines too: the lock protects a line's members,
                      and where you've got to isn't one of them. Both actions close the
                      modal, which is rendered once with the values it was given. */}
                  <ActionButton
                    icon={<IconFlag />}
                    actionLabel={line.isCurrent ? "Clear the current-stage mark" : "Mark this as where you are"}
                    onClick={() => {
                      line.onToggleCurrent();
                      closeModal?.();
                    }}
                  >
                    {line.isCurrent ? "Clear current" : "I'm here"}
                  </ActionButton>
                  {!line.locked && (
                    <ActionButton
                      danger
                      actionLabel={removeLabel(line)}
                      onClick={() => {
                        line.onRemove();
                        closeModal?.();
                      }}
                    >
                      {shortRemoveLabel(line)}
                    </ActionButton>
                  )}
                </Focusable>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <SectionLabel>How to evolve into {digimon.name}</SectionLabel>
              <EvolutionRequirements digimon={digimon} />
            </div>
          </div>
        </div>

        <Divider />

        <div
          ref={scrollRef}
          className="dtb-scroll"
          style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SectionLabel>Base stats · Lv 1</SectionLabel>
              <StatBars digimon={digimon} level="lv1" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SectionLabel>Base stats · Lv 99</SectionLabel>
              <StatBars digimon={digimon} level="lv99" />
            </div>
          </div>

          <Divider />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <NeighbourRow label="Devolves from" members={from} empty="Nothing evolves into it." />
            <NeighbourRow label="Evolves into" members={into} empty="End of the line — it doesn't evolve further." />
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          <ButtonHints hints={[["B", "Close"]]} />
        </div>
      </div>
    </ModalRoot>
  );
}

/** Spelled out for the footer legend, where there's room to be unambiguous. */
function removeLabel({ position, length }: LineContext): string {
  if (length === 1) return "Remove this line";
  if (position === 0) return "Remove from the front of the line";
  if (position === length - 1) return "Remove from the end of the line";
  return "Cut the line here (drops everything after)";
}

/** Short enough to sit beside the Digimon's name. */
function shortRemoveLabel({ position, length }: LineContext): string {
  if (length === 1) return "Remove line";
  if (position === 0 || position === length - 1) return "Remove";
  return "Cut here";
}

function NeighbourRow({ label, members, empty }: { label: string; members: Digimon[]; empty: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <span style={{ width: 96, flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: theme.color.textFaint }}>
        {label}
      </span>
      {members.length ? (
        <ChainStrip members={members} size={34} arrows={false} />
      ) : (
        <span style={{ fontSize: 12, color: theme.color.textFaint }}>{empty}</span>
      )}
    </div>
  );
}
