import { Focusable } from "@decky/ui";

import { RequirementPills } from "../components/DigimonDetails";
import { spriteUrl } from "../data/assets";
import type { LineProgress } from "../data/digimon";
import { IconFlag } from "../ui/icons";
import { attributeColor, generationShort, theme } from "../ui/theme";

interface Props {
  index: number;
  progress: LineProgress;
  /** Opens this line in the full-screen builder. */
  onOpen: () => void;
  /** Moves the line's mark on to the next stage. */
  onAdvance: () => void;
}

/**
 * One line's answer to "what am I working towards, and what does it need".
 *
 * This is the view you read mid-battle, so it leads with the requirements rather than
 * the line: the current stage is a small sprite on the left and everything after it
 * describes the next one.
 */
export function NextStepRow({ index, progress, onOpen, onAdvance }: Props) {
  const { current, next, marked } = progress;
  if (!current) return null;

  const accent = next ? attributeColor(next.attribute) : theme.color.textFaint;

  return (
    <Focusable
      className="dtb-row"
      focusWithinClassName="gpfocuswithin"
      style={{ display: "flex", flexDirection: "column", gap: 6, padding: "7px 9px", minWidth: 0 }}
      onActivate={onOpen}
      onSecondaryButton={next ? onAdvance : undefined}
      onOKActionDescription="Open this line in the builder"
      onSecondaryActionDescription={next ? `Mark ${next.name} as reached` : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.color.textFaint, flexShrink: 0 }}>{index + 1}</span>
        <img
          className="dtb-sprite"
          src={spriteUrl(current)}
          alt={current.name}
          width={22}
          height={22}
          style={{ borderRadius: theme.radius.sm, flexShrink: 0, opacity: 0.85 }}
        />
        <span
          style={{
            fontSize: 11,
            color: theme.color.textDim,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={current.name}
        >
          {current.name}
        </span>
        {/* An unmarked line is being read as "from the start", which is a guess worth
            owning rather than presenting as the player's own position. */}
        {marked ? (
          <span style={{ display: "flex", flexShrink: 0, marginLeft: "auto" }} title="Marked as where you are">
            <IconFlag size={10} color={theme.color.accent} />
          </span>
        ) : (
          <span style={{ fontSize: 10, color: theme.color.textFaint, flexShrink: 0, marginLeft: "auto" }}>
            unmarked
          </span>
        )}
      </div>

      {next ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span aria-hidden style={{ fontSize: 16, color: theme.color.textFaint, flexShrink: 0, lineHeight: 1 }}>
              ↳
            </span>
            <img
              className="dtb-sprite"
              src={spriteUrl(next)}
              alt={next.name}
              width={36}
              height={36}
              style={{
                borderRadius: theme.radius.sm,
                border: `1px solid ${accent}`,
                background: `linear-gradient(160deg, ${accent}38, rgba(10, 15, 22, 0.9))`,
                flexShrink: 0,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={next.name}
              >
                {next.name}
              </span>
              <span style={{ fontSize: 10, color: theme.color.textFaint }}>
                {generationShort(next.generation)} · {next.attribute}
              </span>
            </div>
          </div>
          <RequirementPills digimon={next} />
        </>
      ) : (
        <div style={{ fontSize: 11, color: theme.color.textFaint, paddingLeft: 2 }}>
          {progress.members.length === 1
            ? "Nothing planned after this one — add an evolution in the builder."
            : "Final stage of this line."}
        </div>
      )}
    </Focusable>
  );
}
