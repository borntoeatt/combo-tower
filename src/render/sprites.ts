import { ENEMY_TYPES } from "../config/enemies";
import { TOWER_TYPES } from "../config/towers";
import { towerStats, veteranRank } from "../game/economy";
import { makeParticle } from "../game/effects";
import type { Enemy, Tower } from "../game/types";
import type { World } from "../game/world";
import { shade } from "./helpers";
import { MUZZLE_X, type TowerSprites } from "./towerSprites";

export function drawPortal(
  ctx: CanvasRenderingContext2D, world: World, x: number, y: number, color: string,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  const pulse = 1 + Math.sin(world.time * 4) * 0.12;
  ctx.beginPath();
  ctx.ellipse(x, y, 7 * pulse, 19 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(x, y, 3 * pulse, 11 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawTower(
  ctx: CanvasRenderingContext2D, world: World, t: Tower, sprites: TowerSprites,
): void {
  const def = TOWER_TYPES[t.type];
  const sel = t === world.selected;
  const age = Math.min(1, (world.time - t.born) * 4);
  const scl = 0.5 + age * 0.5;

  if (sel) {
    const s = towerStats(t);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath(); ctx.arc(t.x, t.y, s.range, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = -world.time * 18;
    ctx.beginPath(); ctx.arc(t.x, t.y, s.range, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(scl, scl);

  if (sprites.plate) ctx.drawImage(sprites.plate, -32, -32, 64, 64);

  // idle specialty effects
  if (t.type === "frost") {
    ctx.globalAlpha = 0.16 + Math.sin(world.time * 3 + t.x) * 0.08;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (world.rng.chance(0.04)) {
      // drifting snowflake
      world.particles.push(makeParticle(
        world, t.x + world.rng.range(-12, 12), t.y - 14, "#dff0ff", 0.8, 8, 26,
      ));
    }
  } else if (t.type === "tesla") {
    const a1 = world.time * 4 + t.y;
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 2; i++) {
      const a = a1 + i * Math.PI;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (t.type === "venom" && world.rng.chance(0.05)) {
    world.particles.push(makeParticle(world, t.x, t.y - 12, def.color, 0.5, 14));
  }

  const rec = t.recoil * 4;
  ctx.save();
  ctx.rotate(t.angle);
  ctx.translate(-rec, 0);
  const barrelSprite = sprites.barrel[t.type];
  if (barrelSprite) ctx.drawImage(barrelSprite, -32, -24, 96, 48);
  if (t.flash > 0.45) {
    ctx.globalAlpha = (t.flash - 0.45) * 1.8;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(MUZZLE_X[t.type], 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  const domeSprite = sprites.dome[t.type];
  if (domeSprite) ctx.drawImage(domeSprite, -16, -16, 32, 32);

  for (let i = 0; i < t.level; i++) {
    ctx.fillStyle = i === 3 ? "#ff6b9d" : "#ffd700";
    ctx.fillRect(-13 + i * 8, 17, 6, 3);
  }

  // veteran stars above the base
  const rank = veteranRank(t);
  if (rank > 0) {
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("★".repeat(rank), 0, -19);
  }
  ctx.restore();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, world: World, e: Enemy): void {
  const d = ENEMY_TYPES[e.type];
  const frosty = e.slowT > 0, poisoned = e.poisonT > 0;
  const bodyColor = frosty ? "#74b9ff" : poisoned ? "#a3e635" : d.color;
  const squish = 1 + Math.sin(e.wob) * 0.07;

  ctx.save();
  ctx.translate(e.x, e.y);
  if (d.flies) {
    // hovering: shadow cast well below, flapping wings
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(0, e.r * 2.2, e.r * 0.8, e.r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    const flap = Math.sin(e.wob * 5) * 0.5;
    ctx.fillStyle = "rgba(255,240,200,0.5)";
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.4, 0); ctx.lineTo(-e.r - 8, -5 - flap * 7); ctx.lineTo(-e.r * 0.4, 4);
    ctx.moveTo(e.r * 0.4, 0); ctx.lineTo(e.r + 8, -5 - flap * 7); ctx.lineTo(e.r * 0.4, 4);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, e.r * 0.85, e.r * 0.9, e.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }

  if (e.boss) {
    // menacing ground ring
    const pr = e.r * (1.45 + 0.15 * Math.sin(world.time * 4));
    ctx.strokeStyle = "rgba(196,69,105,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, e.r * 0.85, pr, pr * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 18 + Math.sin(world.time * 5) * 6;
  }
  const g = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.3, e.r * 0.15, 0, 0, e.r);
  g.addColorStop(0, shade(bodyColor, 50));
  g.addColorStop(1, shade(bodyColor, -35));
  ctx.fillStyle = g;

  ctx.scale(squish, 2 - squish);
  ctx.beginPath();
  if (d.shape === "tri") {
    ctx.moveTo(e.r, 0);
    ctx.lineTo(-e.r * 0.8, -e.r * 0.8);
    ctx.lineTo(-e.r * 0.8, e.r * 0.8);
  } else if (d.shape === "square") {
    ctx.rect(-e.r * 0.85, -e.r * 0.85, e.r * 1.7, e.r * 1.7);
  } else if (d.shape === "penta") {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const px = Math.cos(a) * e.r, py = Math.sin(a) * e.r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
  } else if (d.shape === "boss") {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + world.time;
      const rr = e.r * (i % 2 ? 0.8 : 1);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
  } else {
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  if (e.armor > 0) {
    ctx.strokeStyle = "rgba(220,230,255,0.65)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath(); ctx.arc(e.r * 0.25, -e.r * 0.2, e.r * 0.24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath(); ctx.arc(e.r * 0.32, -e.r * 0.2, e.r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // healer aura: pulsing ring + cross badge
  if (d.heals) {
    const pulse = (world.time * 0.7 + e.wob) % 1;
    ctx.strokeStyle = "rgba(43,203,186," + (0.45 * (1 - pulse)).toFixed(2) + ")";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + pulse * ((d.healRange ?? 60) - e.r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(e.x - 1.5, e.y + 2, 3, 9);
    ctx.fillRect(e.x - 4.5, e.y + 5, 9, 3);
  }

  // hp bar only once blooded — keeps the field clean
  if (e.hp < e.maxHp - 0.5) {
    const w = e.r * 2.1;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4.5);
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = frac > 0.5 ? "#7bed9f" : frac > 0.25 ? "#ffb347" : "#ff6b6b";
    ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * frac, 4.5);
  }
  if (e.regen > 0) {
    const w = e.r * 2.1;
    ctx.fillStyle = "#78e08f";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("+", e.x + w / 2 + 5, e.y - e.r - 5);
  }
}
