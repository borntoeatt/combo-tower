import { BALANCE } from "../config/balance";
import { ENEMY_TYPES } from "../config/enemies";
import { WP } from "../config/path";
import { makeParticle } from "./effects";
import type { World } from "./world";

/** Healers mend wounded allies (not themselves) inside their aura. */
function stepHealers(world: World, dt: number): void {
  for (const h of world.enemies) {
    const def = ENEMY_TYPES[h.type];
    if (!def.heals || h.hp <= 0) continue;
    const range = def.healRange ?? 60;
    for (const e of world.enemies) {
      if (e === h || e.hp <= 0 || e.hp >= e.maxHp) continue;
      const dx = e.x - h.x, dy = e.y - h.y;
      if (dx * dx + dy * dy > range * range) continue;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * def.heals * dt);
      if (world.rng.chance(dt * 4)) {
        world.particles.push(makeParticle(world, e.x, e.y - e.r, "#2bcbba", 0.5, 16));
      }
    }
  }
}

/** Walks enemies along the path, applies status effects and leaks. */
export function stepEnemies(world: World, dt: number): void {
  const [endX, endY] = WP[WP.length - 1]!;
  stepHealers(world, dt);
  for (const e of world.enemies) {
    e.wob += dt * 6;
    if (e.regen > 0 && e.hp > 0) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);
    }
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      e.hp -= e.poisonDps * dt; // poison bypasses armor by design
      if (world.rng.chance(dt * 8)) {
        world.particles.push(makeParticle(world, e.x, e.y, "#a3e635", 0.4, 30));
      }
    }
    const slowFactor = e.slowT > 0 ? 0.5 : 1;
    if (e.slowT > 0 && world.rng.chance(dt * 6)) {
      world.particles.push(makeParticle(world, e.x, e.y - e.r, "#cfe8ff", 0.5, 12));
    }
    e.slowT = Math.max(0, e.slowT - dt);

    let leakedNow = false;
    if (e.flies) {
      // wasps cut straight across from spawn portal to exit portal
      const [sx, sy] = WP[0]!;
      const flightLen = Math.hypot(endX - sx, endY - sy);
      e.dist += e.speed * slowFactor * dt;
      const f = Math.min(1, e.dist / flightLen);
      e.x = sx + (endX - sx) * f;
      e.y = sy + (endY - sy) * f + Math.sin(e.wob * 1.5) * 8; // lazy weave
      leakedNow = e.dist >= flightLen;
    } else {
      let remaining = e.speed * slowFactor * dt;
      while (remaining > 0 && e.wpIndex < WP.length - 1) {
        const [tx, ty] = WP[e.wpIndex + 1]!;
        const dx = tx - e.x, dy = ty - e.y;
        const d = Math.hypot(dx, dy);
        if (d <= remaining) {
          e.x = tx; e.y = ty; e.wpIndex++;
          remaining -= d; e.dist += d;
        } else {
          e.x += (dx / d) * remaining;
          e.y += (dy / d) * remaining;
          e.dist += remaining;
          remaining = 0;
        }
      }
      leakedNow = e.wpIndex >= WP.length - 1;
    }

    if (leakedNow && e.hp > 0) {
      e.hp = 0;
      e.leaked = true;
      world.waveLeaks++;
      world.lives -= e.boss ? BALANCE.bossLivesCost : 1;
      world.shake = 8;
      world.damageFlash = 1;
      world.addText(endX - 40, endY, e.boss ? "-5 ♥" : "-1 ♥", "#ff6b6b", 16);
      world.bus.emit("enemyLeaked", { boss: e.boss });
      world.bus.emit("sfx", "leak");
    }
  }
}
