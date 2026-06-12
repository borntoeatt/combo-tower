import { BALANCE, FIELD_H, W } from "../config/balance";
import type { Particle } from "./types";
import type { World } from "./world";

/** Visual-effect helpers + per-frame lifetime bookkeeping. */

export function makeParticle(
  world: World, x: number, y: number, color: string, life: number, speed: number,
): Particle {
  const a = world.rng.range(0, Math.PI * 2);
  const s = speed * (0.5 + world.rng.next());
  return {
    x, y,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    t: life * (0.6 + world.rng.range(0, 0.8)),
    color,
  };
}

export function burst(world: World, x: number, y: number, n: number, color: string): void {
  for (let i = 0; i < n; i++) world.particles.push(makeParticle(world, x, y, color, 0.5, 120));
}

export function explode(world: World, x: number, y: number, radius: number, color: string): void {
  world.rings.push({ x, y, r: 8, max: radius, color, t: 0.3, dur: 0.3 });
  world.rings.push({ x, y, r: 4, max: radius * 0.55, color: "#ffffff", t: 0.18, dur: 0.18 });
  burst(world, x, y, 18, color);
  burst(world, x, y, 8, "#ffe9a0");
  for (let i = 0; i < 4; i++) {
    const a = world.rng.range(0, Math.PI * 2);
    world.smokes.push({
      x: x + Math.cos(a) * 8,
      y: y + Math.sin(a) * 8,
      vx: Math.cos(a) * 18,
      vy: Math.sin(a) * 18 - 8,
      r: 6 + world.rng.range(0, 6),
      t: 0.7 + world.rng.range(0, 0.4),
      dur: 1.1,
    });
  }
  world.shake = Math.max(world.shake, 4);
}

export function stepEffects(world: World, dt: number): void {
  for (const p of world.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.94; p.vy *= 0.94;
    p.t -= dt;
  }
  world.particles = world.particles.filter(p => p.t > 0);
  if (world.particles.length > BALANCE.maxParticles) {
    world.particles.splice(0, world.particles.length - BALANCE.maxParticles);
  }

  for (const s of world.smokes) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.r += 26 * dt; s.t -= dt;
  }
  world.smokes = world.smokes.filter(s => s.t > 0);

  for (const f of world.floatTexts) { f.y -= 34 * dt; f.t -= dt; }
  world.floatTexts = world.floatTexts.filter(f => f.t > 0);

  for (const b of world.beams) b.t -= dt;
  world.beams = world.beams.filter(b => b.t > 0);

  for (const r of world.rings) r.t -= dt;
  world.rings = world.rings.filter(r => r.t > 0);

  for (const em of world.embers) {
    em.p += dt;
    em.x += em.vx * dt + Math.sin(em.p) * 6 * dt;
    em.y += em.vy * dt;
    if (em.y < -6) { em.y = FIELD_H + 6; em.x = world.rng.range(0, W); }
    if (em.x < -6) em.x = W + 6;
    if (em.x > W + 6) em.x = -6;
  }
}
