import { BALANCE } from "../config/balance";
import { WP } from "../config/path";
import { makeParticle } from "./effects";
import type { World } from "./world";

/** Walks enemies along the path, applies status effects and leaks. */
export function stepEnemies(world: World, dt: number): void {
  const [endX, endY] = WP[WP.length - 1]!;
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

    if (e.wpIndex >= WP.length - 1 && e.hp > 0) {
      e.hp = 0;
      e.leaked = true;
      world.lives -= e.boss ? BALANCE.bossLivesCost : 1;
      world.shake = 8;
      world.damageFlash = 1;
      world.addText(endX - 40, endY, e.boss ? "-5 ♥" : "-1 ♥", "#ff6b6b", 16);
      world.bus.emit("enemyLeaked", { boss: e.boss });
      world.bus.emit("sfx", "leak");
    }
  }
}
