import { Focusable } from "@decky/ui";
import type { GamepadEvent } from "@decky/ui";
import type { CSSProperties } from "react";

import { attributeIconUrl, spriteUrl } from "../data/assets";
import type { Digimon } from "../data/types";
import { attributeColor, generationShort, theme } from "../ui/theme";

export type PortraitSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<PortraitSize, { box: number; label: number; badge: number }> = {
  xs: { box: 34, label: 0, badge: 0 },
  sm: { box: 48, label: 0, badge: 9 },
  md: { box: 64, label: 11, badge: 9 },
  lg: { box: 88, label: 12, badge: 10 },
};

interface Props {
  digimon: Digimon;
  size?: PortraitSize;
  /** Renders as a Focusable gamepad target. Omit for decorative portraits. */
  onActivate?: () => void;
  /** Shown in the footer legend while this tile has focus. */
  actionLabel?: string;
  onFocus?: () => void;
  /** Used to hand focus to another panel on a d-pad press. See ui/nav.ts. */
  onButtonDown?: (evt: GamepadEvent) => void;
  onSecondaryButton?: (evt: GamepadEvent) => void;
  /** Footer legend text for the secondary button while this tile has focus. */
  secondaryLabel?: string;
  showName?: boolean;
  showGeneration?: boolean;
  /** Badges this tile as the stage the line has reached. */
  current?: boolean;
  /** Ring emphasis for line members vs. candidate options. */
  emphasis?: "member" | "option";
  style?: CSSProperties;
}

export function DigimonPortrait({
  digimon,
  size = "md",
  onActivate,
  actionLabel,
  onFocus,
  onButtonDown,
  onSecondaryButton,
  secondaryLabel,
  showName = false,
  showGeneration = false,
  current = false,
  emphasis = "option",
  style,
}: Props) {
  const dims = SIZES[size];
  const accent = attributeColor(digimon.attribute);

  const frame = (
    <div
      style={{
        position: "relative",
        width: dims.box,
        height: dims.box,
        borderRadius: theme.radius.md,
        // Attribute-tinted wash so Vaccine/Virus/Data read at a glance.
        background:
          emphasis === "member"
            ? `linear-gradient(160deg, ${accent}38, rgba(10, 15, 22, 0.9))`
            : "rgba(255, 255, 255, 0.05)",
        border: `1px solid ${emphasis === "member" ? accent : theme.color.border}`,
        boxSizing: "border-box",
        overflow: "hidden",
        // Deliberately not the attribute colour: the mark has to stand out from the
        // tint every tile already carries.
        outline: current ? `2px solid ${theme.color.accent}` : undefined,
        outlineOffset: -1,
      }}
    >
      <img
        className="dtb-sprite"
        src={spriteUrl(digimon)}
        alt={digimon.name}
        width={dims.box - 2}
        height={dims.box - 2}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      {current && dims.badge > 0 && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            padding: "1px 4px",
            fontSize: dims.badge,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: "#04121a",
            background: theme.color.accent,
            borderBottomLeftRadius: theme.radius.sm,
          }}
        >
          NOW
        </div>
      )}
      {showGeneration && dims.badge > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            padding: "1px 3px",
            fontSize: dims.badge,
            fontWeight: 700,
            letterSpacing: 0.3,
            color: "#04121a",
            background: accent,
            borderTopRightRadius: theme.radius.sm,
          }}
        >
          {generationShort(digimon.generation)}
        </div>
      )}
    </div>
  );

  const body = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: dims.box }}>
      {frame}
      {showName && dims.label > 0 && (
        <div
          style={{
            fontSize: dims.label,
            lineHeight: 1.2,
            textAlign: "center",
            color: theme.color.textDim,
            maxWidth: dims.box + 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={digimon.name}
        >
          {digimon.name}
        </div>
      )}
    </div>
  );

  if (!onActivate) {
    return <div style={{ padding: 2, ...style }}>{body}</div>;
  }

  return (
    <Focusable
      className="dtb-tile"
      style={{ padding: 2, ...style }}
      onActivate={onActivate}
      onGamepadFocus={onFocus}
      onButtonDown={onButtonDown}
      onSecondaryButton={onSecondaryButton}
      onOKActionDescription={actionLabel}
      onSecondaryActionDescription={secondaryLabel}
    >
      {body}
    </Focusable>
  );
}

/** The small attribute glyph used next to a Digimon's name in detail headers. */
export function AttributeIcon({ digimon, size = 16 }: { digimon: Digimon; size?: number }) {
  return (
    <img
      src={attributeIconUrl(digimon.attribute)}
      alt={digimon.attribute}
      width={size}
      height={size}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}
