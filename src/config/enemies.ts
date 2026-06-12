export type EnemyTypeId =
  "grunt" | "runner" | "tank" | "regen" | "splitter" | "mini" | "healer" | "wasp" | "boss";

export type EnemyShape = "circle" | "tri" | "square" | "penta" | "boss";

export interface EnemyDef {
  readonly hpM: number;     // hp multiplier vs wave base
  readonly spdM: number;    // speed multiplier
  readonly r: number;       // body radius
  readonly armor: number;   // flat damage reduction
  readonly reward: number;  // gold multiplier
  readonly color: string;
  readonly shape: EnemyShape;
  readonly regen?: number;  // fraction of max hp healed per second
  readonly splits?: number; // minis spawned on death
  readonly heals?: number;  // fraction of allies' max hp healed per second
  readonly healRange?: number;
  readonly flies?: boolean; // crosses the map in a straight line, ignoring the path
}

export const ENEMY_TYPES: Readonly<Record<EnemyTypeId, EnemyDef>> = {
  grunt:    { hpM: 1.0,  spdM: 1.0,  r: 11, armor: 0, reward: 1.0, color: "#e55039", shape: "circle" },
  runner:   { hpM: 0.55, spdM: 1.9,  r: 8,  armor: 0, reward: 0.8, color: "#fa983a", shape: "tri" },
  tank:     { hpM: 3.6,  spdM: 0.55, r: 15, armor: 4, reward: 2.2, color: "#8395a7", shape: "square" },
  regen:    { hpM: 1.7,  spdM: 0.9,  r: 12, armor: 0, reward: 1.6, color: "#78e08f", shape: "circle", regen: 0.05 },
  splitter: { hpM: 1.3,  spdM: 1.0,  r: 13, armor: 0, reward: 1.4, color: "#f8a5c2", shape: "penta", splits: 2 },
  mini:     { hpM: 0.35, spdM: 1.5,  r: 7,  armor: 0, reward: 0.4, color: "#f8a5c2", shape: "penta" },
  healer:   { hpM: 1.5,  spdM: 0.8,  r: 12, armor: 0, reward: 1.8, color: "#2bcbba", shape: "circle", heals: 0.04, healRange: 70 },
  wasp:     { hpM: 0.7,  spdM: 1.1,  r: 9,  armor: 0, reward: 1.3, color: "#ffd86b", shape: "tri", flies: true },
  boss:     { hpM: 16,   spdM: 0.5,  r: 22, armor: 5, reward: 14,  color: "#c44569", shape: "boss", regen: 0.01 },
};
