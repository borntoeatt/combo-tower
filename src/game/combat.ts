import { BALANCE } from "../config/balance";
import { ENEMY_TYPES } from "../config/enemies";
import { TARGET_MODES } from "../config/towers";
import { towerStats } from "./economy";
import { burst, explode } from "./effects";
import type { Enemy, EnemySpec, Tower, TowerStats } from "./types";
import type { World } from "./world";

export function pickTarget(world: World, t: Tower, s: TowerStats): Enemy | null {
  let target: Enemy | null = null;
  let bestVal = -Infinity;
  const mode = TARGET_MODES[t.mode] ?? "first";
  for (const e of world.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - t.x, dy = e.y - t.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > s.range * s.range) continue;
    const val =
      mode === "first" ? e.dist :
      mode === "strong" ? e.hp :
      mode === "weak" ? -e.hp : -d2;
    if (val > bestVal) { bestVal = val; target = e; }
  }
  return target;
}

export function nearestEnemy(
  world: World, x: number, y: number, range: number, exclude: ReadonlySet<Enemy>,
): Enemy | null {
  let bestE: Enemy | null = null;
  let bestD = range * range;
  for (const e of world.enemies) {
    if (e.hp <= 0 || exclude.has(e)) continue;
    const dx = e.x - x, dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; bestE = e; }
  }
  return bestE;
}

export function damage(
  world: World, e: Enemy, dmg: number, pierce: boolean, source: Tower | null = null,
): void {
  const eff = pierce ? dmg : Math.max(dmg * BALANCE.armorMinDamageFraction, dmg - e.armor);
  e.hp -= eff;
  if (e.hp <= 0 && !e.credited && !e.leaked && source) {
    e.credited = true;
    source.kills++;
  }
  if (!world.isDemo) {
    world.addText(
      e.x + world.rng.range(-7, 7), e.y - e.r - 4,
      String(Math.round(eff)), "rgba(255,255,255,0.85)", 10, 0.5,
    );
  }
}

/** Tower acquisition + firing. */
export function stepTowers(world: World, dt: number): void {
  for (const t of world.towers) {
    t.cooldown -= dt;
    t.recoil = Math.max(0, t.recoil - dt * 5);
    t.flash = Math.max(0, t.flash - dt * 8);
    if (t.cooldown > 0) continue;
    const s = towerStats(t);
    const target = pickTarget(world, t, s);
    if (!target) continue;
    t.cooldown = 1 / s.rate;
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    t.recoil = 1;
    t.flash = 1;

    if (t.type === "sniper") {
      world.beams.push({
        x1: t.x, y1: t.y, x2: target.x, y2: target.y,
        color: s.color, t: 0.14, dur: 0.14, width: 3, jagged: false,
      });
      damage(world, target, s.dmg, true, t);
      burst(world, target.x, target.y, 8, s.color);
      world.bus.emit("sfx", "rail");
    } else if (t.type === "tesla") {
      let cur: Enemy | null = target;
      let dmgLeft = s.dmg;
      let px = t.x, py = t.y;
      const hitSet = new Set<Enemy>();
      for (let i = 0; i < s.chain && cur; i++) {
        world.beams.push({
          x1: px, y1: py, x2: cur.x, y2: cur.y,
          color: s.color, t: 0.11, dur: 0.11, width: 2, jagged: true,
        });
        damage(world, cur, dmgLeft, false, t);
        burst(world, cur.x, cur.y, 5, s.color);
        hitSet.add(cur);
        px = cur.x; py = cur.y;
        dmgLeft *= 0.7;
        cur = nearestEnemy(world, px, py, s.chainRange, hitSet);
      }
      world.bus.emit("sfx", "zap");
    } else {
      world.bullets.push({
        x: t.x + Math.cos(t.angle) * 16,
        y: t.y + Math.sin(t.angle) * 16,
        target,
        dmg: s.dmg,
        color: s.color,
        glow: s.glow,
        speed: t.type === "cannon" ? 420 : 560,
        splash: s.splash > 0 ? s.splash * (1 + (t.level - 1) * 0.08) : 0,
        slow: s.slow,
        slowDur: s.slowDur,
        poison: s.poison,
        poisonDur: s.poisonDur,
        big: t.type === "cannon",
        t: 2.5,
        trail: [],
        source: t,
      });
      world.bus.emit("sfx", "shoot");
    }
  }
}

/** Homing projectiles + impact resolution. */
export function stepBullets(world: World, dt: number): void {
  for (const b of world.bullets) {
    b.t -= dt;
    b.trail.push([b.x, b.y] as const);
    if (b.trail.length > 6) b.trail.shift();
    const tg = b.target;
    if (tg.hp <= 0) { b.t = 0; continue; }
    const dx = tg.x - b.x, dy = tg.y - b.y;
    const d = Math.hypot(dx, dy);
    const step = b.speed * dt;
    if (d <= step + tg.r) {
      if (b.splash > 0) {
        explode(world, tg.x, tg.y, b.splash, b.color);
        for (const e of world.enemies) {
          const ex = e.x - tg.x, ey = e.y - tg.y;
          if (ex * ex + ey * ey <= b.splash * b.splash) damage(world, e, b.dmg, false, b.source);
        }
        world.bus.emit("sfx", "boom");
      } else {
        damage(world, tg, b.dmg, false, b.source);
        burst(world, tg.x, tg.y, 3, b.color);
        world.bus.emit("sfx", "hit");
      }
      if (b.slow > 0) tg.slowT = Math.max(tg.slowT, b.slowDur);
      if (b.poison > 0) { tg.poisonT = b.poisonDur; tg.poisonDps = b.poison; }
      b.t = 0;
    } else {
      b.x += (dx / d) * step;
      b.y += (dy / d) * step;
    }
  }
  world.bullets = world.bullets.filter(b => b.t > 0);
}

/** Death bookkeeping: rewards, boss drama, splitter spawns. */
export function processDeaths(world: World): void {
  type PendingSpawn = readonly [EnemySpec, number, number, number];
  const spawnAfter: PendingSpawn[] = [];
  world.enemies = world.enemies.filter(e => {
    if (e.hp > 0) return true;
    if (!e.leaked) {
      world.kills++;
      world.gold += e.reward;
      world.score += e.reward * 10;
      world.addText(e.x, e.y - 12, "+" + e.reward + "g", "#ffd700");
      burst(world, e.x, e.y, e.boss ? 30 : 10, ENEMY_TYPES[e.type].color);
      world.bus.emit("enemyKilled", { type: e.type, boss: e.boss, reward: e.reward });
      if (e.boss) {
        explode(world, e.x, e.y, 100, "#c44569");
        world.shake = 10;
        world.slowmoT = 0.9;
        if (!world.isDemo) world.showBanner("BOSS DOWN", "+" + e.reward + " gold", "#ffd700");
        world.bus.emit("sfx", "boom");
      }
      if (e.splits > 0) {
        const miniDef = ENEMY_TYPES.mini;
        const parentDef = ENEMY_TYPES[e.type];
        const miniHp = Math.round(e.maxHp * miniDef.hpM / parentDef.hpM);
        for (let i = 0; i < e.splits; i++) {
          spawnAfter.push([
            {
              type: "mini",
              hp: miniHp,
              speed: e.speed * BALANCE.splitterMiniSpeedFactor,
              reward: Math.max(1, Math.round(e.reward * 0.3)),
              r: miniDef.r, armor: 0, regen: 0, splits: 0, boss: false,
            },
            e.x + (i ? 12 : -12), e.y, e.wpIndex,
          ] as const);
        }
      }
    }
    return false;
  });
  // spawned AFTER the filter — pushing into an array mid-filter loses elements
  for (const [spec, x, y, wp] of spawnAfter) world.spawnEnemy(spec, x, y, wp);
}
