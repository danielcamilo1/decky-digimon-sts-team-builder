import { spriteUrl } from "../data/assets";
import type { Digimon } from "../data/types";
import { attributeColor, theme } from "../ui/theme";

interface Props {
  members: Digimon[];
  size?: number;
  /** Truncates with a "+N" chip so long lines stay on one row in narrow surfaces. */
  max?: number;
  /** Off when the sprites are alternatives (e.g. "evolves into any of these")
   * rather than an ordered line. */
  arrows?: boolean;
}

/**
 * Read-only summary of an evolution line: sprite › sprite › sprite. Used in the team
 * sidebar and the Quick Access panel, where there is no room for the full editor.
 */
export function ChainStrip({ members, size = 34, max, arrows = true }: Props) {
  const shown = max ? members.slice(0, max) : members;
  const hidden = members.length - shown.length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
      {shown.map((digimon, i) => (
        <div key={`${digimon.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {i > 0 && arrows && <Arrow />}
          <img
            className="dtb-sprite"
            src={spriteUrl(digimon)}
            alt={digimon.name}
            width={size}
            height={size}
            title={digimon.name}
            style={{
              display: "block",
              borderRadius: theme.radius.sm,
              background: `linear-gradient(160deg, ${attributeColor(digimon.attribute)}30, rgba(10, 15, 22, 0.75))`,
              flexShrink: 0,
            }}
          />
        </div>
      ))}
      {hidden > 0 && (
        <span style={{ marginLeft: 4, fontSize: 11, color: theme.color.textFaint, flexShrink: 0 }}>+{hidden}</span>
      )}
    </div>
  );
}

export function Arrow({ color = theme.color.textFaint, size = 12 }: { color?: string; size?: number }) {
  return (
    <span aria-hidden style={{ color, fontSize: size, lineHeight: 1, flexShrink: 0 }}>
      ›
    </span>
  );
}
