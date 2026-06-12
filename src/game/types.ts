import type { EnemyTypeId } from "../config/enemies";
import type { TowerTypeId } from "../config/towers";

export interface EnemySpec {
  type: EnemyTypeId;
  hp: number;
  speed: number;
  reward: number;
  r: number;
  armor: number;
  regen: number;
  splits: number;
  boss: boolean;
}

export interface Enemy extends EnemySpec {
  maxHp: number;
  wpIndex: number;
  x: number;
  y: number;
  slowT: number;
  poisonT: number;
  poisonDps: number;
  dist: number;
  wob: number;
  leaked: boolean;
  credited: boolean;  // kill already attributed to a tower
}

export interface Tower {
  type: TowerTypeId;
  c: number;
  r: number;
  x: number;
  y: number;
  level: number;
  cooldown: number;
  spent: number;
  angle: number;
  recoil: number;
  mode: number;       // index into TARGET_MODES
  flash: number;
  born: number;
  kills: number;      // lifetime kill credit — drives veteran ranks
}

/** Effective (level-scaled) combat stats for a tower. */
export interface TowerStats {
  dmg: number;
  range: number;
  rate: number;
  poison: number;
  splash: number;
  slow: number;
  slowDur: number;
  poisonDur: number;
  chain: number;
  chainRange: number;
  pierce: boolean;
  color: string;
  glow: string;
  name: string;
}

export interface Bullet {
  x: number;
  y: number;
  target: Enemy;
  dmg: number;
  color: string;
  glow: string;
  speed: number;
  splash: number;
  slow: number;
  slowDur: number;
  poison: number;
  poisonDur: number;
  big: boolean;
  t: number;
  trail: Array<readonly [number, number]>;
  source: Tower | null; // for kill credit; may outlive the tower (sold)
}

export interface Beam {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  t: number;
  dur: number;
  width: number;
  jagged: boolean;
}

export interface Ring {
  x: number; y: number;
  r: number;
  max: number;
  color: string;
  t: number;
  dur: number;
}

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  t: number;
  color: string;
  g: number;     // gravity px/s² — debris arcs, 0 for sparks
  size: number;
}

export interface Smoke {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  t: number;
  dur: number;
}

export interface FloatText {
  x: number; y: number;
  msg: string;
  color: string;
  t: number;
  size: number;
}

export interface Ember {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  p: number;
}

export interface Banner {
  text: string;
  sub: string | null;
  color: string;
  t: number;
  dur: number;
}

export type GameState = "menu" | "playing" | "gameover";
