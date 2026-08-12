export interface DigimonBaseStats {
  lv1: Record<string, number>;
  lv99: Record<string, number>;
}

export type EvolutionConditionType = "simple" | "stats" | "jogress" | "item";

export interface EvolutionCondition {
  type: EvolutionConditionType;
  /** e.g. { "Agent Rank": "≥ 2", "ATK": "≥ 140" } */
  requirements: Record<string, string>;
}

export interface Digimon {
  id: number;
  slug: string;
  name: string;
  generation: Generation;
  attribute: Attribute;
  type: string;
  ridable: boolean;
  base_personality: string;
  base_stats: DigimonBaseStats;
  evolution_conditions: EvolutionCondition[];
  /** Digimon ids */
  pre_evolutions: number[];
  /** Digimon ids */
  evolutions: number[];
}

/** One evolution line in the team: an ordered list of Digimon ids. */
export interface Chain {
  ids: number[];
  locked: boolean;
  /**
   * The stage the player has actually reached, as a Digimon id rather than a position:
   * prepending a pre-evolution shifts every position but not the id. Unset means the
   * line hasn't been marked, and everything that reads it falls back to the head.
   */
  current?: number;
}

export interface TeamState {
  chains: Chain[];
  selected: number;
}

export const GENERATIONS = [
  "In-Training I",
  "In-Training II",
  "Rookie",
  "Champion",
  "Ultimate",
  "Mega",
  "Mega +",
  "Armor",
  "Hybrid",
] as const;

export type Generation = (typeof GENERATIONS)[number];

export const ATTRIBUTES = ["Vaccine", "Data", "Virus", "Free", "Variable", "Unknown", "No Data"] as const;

export type Attribute = (typeof ATTRIBUTES)[number];

/** The team size the game allows, and what "Random Team" fills. */
export const TEAM_SIZE = 6;

export const STAT_KEYS = ["HP", "SP", "ATK", "DEF", "INT", "SPI", "SPD"] as const;
