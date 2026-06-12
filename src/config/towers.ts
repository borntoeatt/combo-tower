export type TowerTypeId = "gunner" | "cannon" | "frost" | "venom" | "tesla" | "sniper";

export interface TowerDef {
  readonly name: string;
  readonly key: string;
  readonly cost: number;
  readonly range: number;
  readonly rate: number;      // shots per second
  readonly dmg: number;
  readonly color: string;
  readonly glow: string;
  readonly desc: string;
  readonly splash?: number;   // splash radius (cannon)
  readonly slow?: number;     // slow multiplier (frost)
  readonly slowDur?: number;
  readonly poison?: number;   // poison dps (venom)
  readonly poisonDur?: number;
  readonly chain?: number;    // chain count (tesla)
  readonly chainRange?: number;
  readonly pierce?: boolean;  // ignores armor (sniper)
}

export const TOWER_TYPES: Readonly<Record<TowerTypeId, TowerDef>> = {
  gunner: { name: "Gunner", key: "1", cost: 50,  range: 120, rate: 3.2, dmg: 8,
            color: "#4ecdc4", glow: "rgba(78,205,196,0.55)", desc: "Rapid fire" },
  cannon: { name: "Cannon", key: "2", cost: 100, range: 135, rate: 0.75, dmg: 30,
            color: "#ffb347", glow: "rgba(255,179,71,0.55)", desc: "Splash dmg", splash: 70 },
  frost:  { name: "Frost",  key: "3", cost: 70,  range: 110, rate: 1.5, dmg: 4,
            color: "#9ad0ff", glow: "rgba(154,208,255,0.55)", desc: "Slows 50%", slow: 0.5, slowDur: 1.8 },
  venom:  { name: "Venom",  key: "4", cost: 90,  range: 125, rate: 1.1, dmg: 6,
            color: "#a3e635", glow: "rgba(163,230,53,0.55)", desc: "Poison DoT", poison: 14, poisonDur: 3 },
  tesla:  { name: "Tesla",  key: "5", cost: 130, range: 130, rate: 1.3, dmg: 18,
            color: "#c084fc", glow: "rgba(192,132,252,0.6)", desc: "Chains x3", chain: 3, chainRange: 95 },
  sniper: { name: "Sniper", key: "6", cost: 150, range: 330, rate: 0.5, dmg: 60,
            color: "#ff6b9d", glow: "rgba(255,107,157,0.55)", desc: "Pierces armor", pierce: true },
};

export const TYPE_ORDER: ReadonlyArray<TowerTypeId> =
  ["gunner", "cannon", "frost", "venom", "tesla", "sniper"];

export const TARGET_MODES = ["first", "strong", "close", "weak"] as const;
export type TargetMode = (typeof TARGET_MODES)[number];
