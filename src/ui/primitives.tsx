import { Focusable, TextField } from "@decky/ui";
import type { GamepadEvent, NavEntryPositionPreferences, TextFieldProps } from "@decky/ui";
import type { CSSProperties, FC, ReactNode, RefObject } from "react";

import { theme } from "./theme";

/**
 * DFL types TextField's props as HTMLAttributes, which omits `placeholder` even
 * though the underlying Steam component forwards it to the input.
 */
export const TextInput = TextField as FC<TextFieldProps & { placeholder?: string }>;

interface ActionButtonProps {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
  /** Footer legend text shown while focused. */
  actionLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  /** Used to hand focus to another panel on a d-pad press. See ui/nav.ts. */
  onButtonDown?: (evt: GamepadEvent) => void;
}

export function ActionButton({
  children,
  onClick,
  icon,
  actionLabel,
  danger,
  disabled,
  style,
  onButtonDown,
}: ActionButtonProps) {
  return (
    <Focusable
      className={`dtb-action${danger ? " dtb-danger" : ""}${disabled ? " dtb-disabled" : ""}`}
      style={{ opacity: disabled ? 0.45 : 1, ...style }}
      onActivate={disabled ? undefined : onClick}
      onOKActionDescription={disabled ? undefined : actionLabel}
      onButtonDown={onButtonDown}
    >
      {icon && <span style={{ display: "flex", fontSize: 14 }}>{icon}</span>}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {children}
      </span>
    </Focusable>
  );
}

interface ScrollAreaProps {
  children: ReactNode;
  style?: CSSProperties;
  /** Which child Steam should land on when focus enters from outside. */
  navEntryPreferPosition?: NavEntryPositionPreferences;
  containerRef?: RefObject<HTMLDivElement | null>;
}

/**
 * A plain overflow container rather than DFL's ScrollPanelGroup, which is resolved out
 * of the Steam bundle by signature and can go missing across Steam updates. Rows keep
 * themselves visible by calling scrollIntoView from onGamepadFocus.
 */
export function ScrollArea({ children, style, navEntryPreferPosition, containerRef }: ScrollAreaProps) {
  return (
    <Focusable
      ref={containerRef}
      className="dtb-scroll"
      noFocusRing
      navEntryPreferPosition={navEntryPreferPosition}
      style={{ display: "flex", flexDirection: "column", overflowY: "auto", flex: 1, minHeight: 0, ...style }}
    >
      {children}
    </Focusable>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          color: theme.color.textFaint,
        }}
      >
        {children}
      </span>
      {right}
    </div>
  );
}

export function Divider({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      style={
        vertical
          ? { width: 1, alignSelf: "stretch", background: theme.color.border }
          : { height: 1, background: theme.color.border }
      }
    />
  );
}

/** Bottom-of-screen button hints, mirroring Steam's own footer legend. */
export function ButtonHints({ hints }: { hints: [glyph: string, label: string][] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      {hints.map(([glyph, label]) => (
        <span key={`${glyph}${label}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: theme.color.text,
              background: "rgba(255,255,255,0.13)",
              border: `1px solid ${theme.color.border}`,
            }}
          >
            {glyph}
          </span>
          <span style={{ fontSize: 11, color: theme.color.textDim }}>{label}</span>
        </span>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: 32,
        textAlign: "center",
        height: "100%",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: theme.color.text }}>{title}</div>
      <div style={{ fontSize: 13, color: theme.color.textDim, maxWidth: 420 }}>{body}</div>
      {action}
    </div>
  );
}
