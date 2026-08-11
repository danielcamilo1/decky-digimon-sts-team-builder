import { formatRequirements } from "../data/digimon";
import type { Digimon, EvolutionCondition } from "../data/types";
import { STAT_KEYS } from "../data/types";
import { attributeColor, theme } from "../ui/theme";
import { AttributeIcon } from "./DigimonPortrait";

/** Highest lv99 value across the dex, used to scale the stat bars. Roughly 4000 for
 * HP; per-stat maxima keep short bars from looking broken. */
const STAT_SCALE: Record<string, number> = {
  HP: 4200,
  SP: 2400,
  ATK: 1800,
  DEF: 1600,
  INT: 1800,
  SPI: 1600,
  SPD: 1500,
};

export function DigimonHeader({ digimon }: { digimon: Digimon }) {
  const accent = attributeColor(digimon.attribute);
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: theme.color.text }}>{digimon.name}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: accent }}>
        <AttributeIcon digimon={digimon} size={14} />
        {digimon.attribute}
      </span>
      <span style={{ fontSize: 12, color: theme.color.textDim }}>
        {digimon.generation} · {digimon.type}
      </span>
      {digimon.ridable && (
        <span style={{ fontSize: 11, color: theme.color.textFaint, border: `1px solid ${theme.color.border}`, borderRadius: 999, padding: "1px 7px" }}>
          Ridable
        </span>
      )}
    </div>
  );
}

export function StatBars({ digimon, level }: { digimon: Digimon; level: "lv1" | "lv99" }) {
  const stats = digimon.base_stats?.[level] ?? {};
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 16, rowGap: 5 }}>
      {STAT_KEYS.map((key) => {
        const value = stats[key] ?? 0;
        const pct = Math.min(100, (value / (STAT_SCALE[key] ?? 2000)) * 100);
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 30, fontSize: 11, color: theme.color.textDim, flexShrink: 0 }}>{key}</span>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: attributeColor(digimon.attribute), borderRadius: 3 }} />
            </div>
            <span style={{ width: 38, fontSize: 11, textAlign: "right", color: theme.color.text, flexShrink: 0 }}>
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const CONDITION_LABEL: Record<EvolutionCondition["type"], string> = {
  simple: "Requires",
  stats: "Stat requirements",
  jogress: "Jogress",
  item: "Item evolution",
};

/**
 * How you evolve *into* `digimon`. Shown for the Digimon on the right of an arrow,
 * which is what the player needs to plan around.
 */
export function EvolutionRequirements({ digimon }: { digimon: Digimon }) {
  const conditions = digimon.evolution_conditions ?? [];
  if (!conditions.length) {
    return <div style={{ fontSize: 12, color: theme.color.textFaint }}>No recorded evolution requirements.</div>;
  }

  const lines = formatRequirements(conditions);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {conditions.map((condition, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: theme.color.textFaint,
              width: 92,
              flexShrink: 0,
            }}
          >
            {CONDITION_LABEL[condition.type]}
          </span>
          <span style={{ fontSize: 12, color: theme.color.text }}>{lines[i]}</span>
        </div>
      ))}
      {conditions.length > 1 && (
        <div style={{ fontSize: 11, color: theme.color.textFaint }}>Any one of the above paths works.</div>
      )}
    </div>
  );
}
