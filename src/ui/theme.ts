import type { Attribute, Generation } from "../data/types";

/**
 * Sized for the Steam Deck's 1280x800 screen in Game Mode. Everything here is in px
 * because Steam's Gamepad UI already scales the root font size per display.
 */
export const theme = {
  color: {
    bg: "#0b1017",
    panel: "rgba(20, 28, 38, 0.82)",
    panelRaised: "rgba(31, 42, 56, 0.92)",
    border: "rgba(255, 255, 255, 0.10)",
    borderStrong: "rgba(255, 255, 255, 0.22)",
    text: "#e9eef5",
    textDim: "#93a1b3",
    textFaint: "#63718a",
    accent: "#3fd0ff",
    accentDim: "rgba(63, 208, 255, 0.16)",
    danger: "#ff6b6b",
    locked: "#ffc65a",
  },
  radius: { sm: 4, md: 8, lg: 12 },
  space: (n: number) => n * 4,
} as const;

export const ATTRIBUTE_COLORS: Record<Attribute, string> = {
  Vaccine: "#5aa9ff",
  Data: "#3ddc97",
  Virus: "#b96bff",
  Free: "#ffc65a",
  Variable: "#ff7fb8",
  Unknown: "#8a94a6",
  "No Data": "#8a94a6",
};

export function attributeColor(attribute: Attribute): string {
  return ATTRIBUTE_COLORS[attribute] ?? ATTRIBUTE_COLORS.Unknown;
}

/** Short labels so a stage fits on a badge next to a 56px portrait. */
export const GENERATION_SHORT: Record<Generation, string> = {
  "In-Training I": "IT-I",
  "In-Training II": "IT-II",
  Rookie: "ROOKIE",
  Champion: "CHAMP",
  Ultimate: "ULT",
  Mega: "MEGA",
  "Mega +": "MEGA+",
  Armor: "ARMOR",
  Hybrid: "HYBRID",
};

export function generationShort(generation: Generation): string {
  return GENERATION_SHORT[generation] ?? generation.toUpperCase();
}
