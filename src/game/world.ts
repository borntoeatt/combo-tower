import { EventBus } from "../core/eventBus";
import { Rng } from "../core/rng";
import { BALANCE, FIELD_H, W } from "../config/balance";
import type {
  Banner, Beam, Bullet, Ember, Enemy, EnemySpec, FloatText,
  GameState, Particle, Ring, Smoke, Tower,
} from "./types";
import type { TowerTypeId } from "../config/towers";
import { distAtWaypoint, WP } from "../config/path";

/**
 * The single source of truth for all mutable game state.
 * Systems are pure-ish functions over this container; nothing else
 * owns state. Construction is cheap, so tests can spin up many.
 */
export class World {
  readonly bus: EventBus;
  readonly rng: Rng;

  state: GameState = "menu";
  isDemo = true;

  towers: Tower[] = [];
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  beams: Beam[] = [];
  rings: Ring[] = [];
  particles: Particle[] = [];
  smokes: Smoke[] = [];
  floatTexts: FloatText[] = [];
  embers: Ember[] = [];

  gold = 0;
  lives = 0;
  wave = 0;
  score = 0;
  kills = 0;
  best = 0;

  waveQueue: EnemySpec[] = [];
  spawnTimer = 0;
  waveActive = false;
  interTimer = 0;

  buildType: TowerTypeId | null = null;
  selected: Tower | null = null;

  time = 0;
  shake = 0;
  gameSpeed: 1 | 2 = 1;
  paused = false;
  muted = false;

  banner: Banner | null = null;
  bossWarnT = 0;
  damageFlash = 0;
  slowmoT = 0;
  aiTimer = 0;
  gameOverAt = 0;

  constructor(bus: EventBus = new EventBus(), rng: Rng = new Rng()) {
    this.bus = bus;
    this.rng = rng;
    this.initEmbers();
  }

  reset(): void {
    this.towers = []; this.enemies = []; this.bullets = []; this.beams = [];
    this.rings = []; this.particles = []; this.smokes = []; this.floatTexts = [];
    this.gold = BALANCE.startingGold;
    this.lives = BALANCE.startingLives;
    this.wave = 0; this.score = 0; this.kills = 0;
    this.waveQueue = []; this.spawnTimer = 0; this.waveActive = false;
    this.interTimer = 4;
    this.buildType = "gunner"; this.selected = null;
    this.time = 0; this.shake = 0; this.gameSpeed = 1; this.paused = false;
    this.banner = null; this.bossWarnT = 0; this.damageFlash = 0;
    this.slowmoT = 0; this.aiTimer = 0;
  }

  spawnEnemy(spec: EnemySpec, atX?: number, atY?: number, wpIndex = 0): void {
    const [sx, sy] = WP[0]!;
    this.enemies.push({
      ...spec,
      maxHp: spec.hp,
      wpIndex,
      x: atX ?? sx,
      y: atY ?? sy,
      slowT: 0, poisonT: 0, poisonDps: 0,
      dist: distAtWaypoint(wpIndex),
      wob: this.rng.range(0, Math.PI * 2),
      leaked: false,
    });
  }

  addText(x: number, y: number, msg: string, color: string, size = 12, dur = 1.2): void {
    this.floatTexts.push({ x, y, msg, color, t: dur, size });
  }

  showBanner(text: string, sub: string | null, color: string): void {
    this.banner = { text, sub, color, t: 2.2, dur: 2.2 };
    this.bus.emit("bannerShown", { text, sub, color });
  }

  private initEmbers(): void {
    for (let i = 0; i < 36; i++) {
      this.embers.push({
        x: this.rng.range(0, W),
        y: this.rng.range(0, FIELD_H),
        vx: this.rng.range(-4, 4),
        vy: -6 - this.rng.range(0, 14),
        r: 0.8 + this.rng.range(0, 1.8),
        p: this.rng.range(0, Math.PI * 2),
      });
    }
  }
}
