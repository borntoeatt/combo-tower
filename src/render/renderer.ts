import { actForWave } from "../config/acts";
import { CELL, FIELD_H, H, W } from "../config/balance";
import { pathLength, pointAtDist, WP } from "../config/path";
import { TOWER_TYPES } from "../config/towers";
import { canBuildAt, cellAt, towerAt, towerStats } from "../game/economy";
import type { Beam } from "../game/types";
import type { World } from "../game/world";
import { buildBackground, type CanvasFactory } from "./background";
import { drawGameOver, drawMenu, drawUI } from "./hud";
import { drawEnemy, drawPortal, drawTower } from "./sprites";

export interface PointerState {
  x: number;
  y: number;
  hoverBtn: number | null;
}

/**
 * Owns the 2D context and the full frame composition:
 * background blit → entities → additive glow pass → overlays → HUD.
 */
export class Renderer {
  private bg: HTMLCanvasElement | null;

  constructor(
    private ctx: CanvasRenderingContext2D,
    createCanvas: CanvasFactory,
    dpr: number,
  ) {
    this.bg = buildBackground(createCanvas, dpr);
  }

  render(world: World, pointer: PointerState): void {
    const ctx = this.ctx;
    const act = actForWave(world.wave);
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (world.shake > 0) {
      ctx.translate(
        (world.rng.next() - 0.5) * world.shake,
        (world.rng.next() - 0.5) * world.shake,
      );
    }

    if (this.bg) ctx.drawImage(this.bg, 0, 0, W, FIELD_H);
    else { ctx.fillStyle = "#11182b"; ctx.fillRect(0, 0, W, FIELD_H); }

    if (act.tint !== "rgba(0,0,0,0)") {
      ctx.fillStyle = act.tint;
      ctx.fillRect(0, 0, W, FIELD_H);
    }

    // path glow + animated chevrons
    ctx.save();
    ctx.strokeStyle = act.path;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.shadowColor = act.path;
    ctx.shadowBlur = 6;
    this.tracePath();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = act.chevron;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 26]);
    ctx.lineDashOffset = -world.time * 46;
    ctx.lineCap = "round";
    this.tracePath();
    ctx.stroke();
    ctx.restore();

    const [sx, sy] = WP[0]!;
    const [ex, ey] = WP[WP.length - 1]!;
    drawPortal(ctx, world, sx - CELL / 2 + 4, sy, "#7bed9f");
    drawPortal(ctx, world, ex + CELL / 2 - 4, ey, "#ff6b6b");

    for (const t of world.towers) drawTower(ctx, world, t);
    this.drawHoverRange(world, pointer);
    for (const e of world.enemies) drawEnemy(ctx, world, e);

    this.additivePass(world, act.ember);

    // smoke (normal blending)
    for (const s of world.smokes) {
      ctx.globalAlpha = Math.max(0, s.t / s.dur) * 0.3;
      ctx.fillStyle = "#202736";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (world.state === "menu") {
      this.drawFloatTexts(world);
      drawMenu(ctx, world);
      ctx.restore();
      return;
    }

    this.drawBuildPreview(world, pointer);
    this.drawFloatTexts(world);
    this.drawOverlays(world);
    drawUI(ctx, world, pointer.hoverBtn);

    if (world.paused && world.state === "playing") {
      ctx.fillStyle = "rgba(5,8,18,0.55)";
      ctx.fillRect(0, 0, W, FIELD_H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 40px monospace";
      ctx.fillText("PAUSED", W / 2, FIELD_H / 2);
      ctx.font = "14px monospace";
      ctx.fillText("[P] resume", W / 2, FIELD_H / 2 + 34);
    }
    if (world.state === "gameover") drawGameOver(ctx, world);
    ctx.restore();
  }

  private tracePath(): void {
    const ctx = this.ctx;
    ctx.beginPath();
    WP.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  }

  /** Everything luminous, blended additively for a bloom-like look. */
  private additivePass(world: World, emberColor: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const b of world.bullets) {
      for (let i = 0; i < b.trail.length; i++) {
        const [tx, ty] = b.trail[i]!;
        ctx.globalAlpha = (i / b.trail.length) * 0.35;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(tx, ty, (b.big ? 5 : 3) * (i / b.trail.length), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.big ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.big ? 6.5 : 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const bm of world.beams) {
      const a = bm.t / bm.dur;
      ctx.globalAlpha = a;
      ctx.shadowColor = bm.color;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = bm.color;
      ctx.lineWidth = bm.width * 3 * a;
      this.strokeBeam(world, bm);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = bm.width * a;
      this.strokeBeam(world, bm);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    for (const r of world.rings) {
      const f = 1 - r.t / r.dur;
      ctx.globalAlpha = (1 - f) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3.5 * (1 - f) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + (r.max - r.r) * f, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const p of world.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.t * 2.4)) * 0.9;
      ctx.fillStyle = p.color;
      const half = p.size / 2;
      ctx.fillRect(p.x - half, p.y - half, p.size, p.size);
    }

    // energy pulses coursing along the path
    for (let i = 0; i < 3; i++) {
      const d = (world.time * 90 + (i * pathLength) / 3) % pathLength;
      const [px, py] = pointAtDist(d);
      const fade = Math.min(1, d / 60, (pathLength - d) / 60); // ease in/out at portals
      ctx.globalAlpha = 0.55 * fade;
      ctx.shadowColor = emberColor;
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = emberColor;
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    for (const em of world.embers) {
      ctx.globalAlpha = 0.25 + Math.sin(em.p * 2) * 0.15;
      ctx.fillStyle = emberColor;
      ctx.beginPath(); ctx.arc(em.x, em.y, em.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private strokeBeam(world: World, bm: Beam): void {
    const ctx = this.ctx;
    ctx.beginPath();
    if (bm.jagged) {
      const segs = 5;
      ctx.moveTo(bm.x1, bm.y1);
      for (let i = 1; i < segs; i++) {
        const f = i / segs;
        ctx.lineTo(
          bm.x1 + (bm.x2 - bm.x1) * f + world.rng.range(-5.5, 5.5),
          bm.y1 + (bm.y2 - bm.y1) * f + world.rng.range(-5.5, 5.5),
        );
      }
      ctx.lineTo(bm.x2, bm.y2);
    } else {
      ctx.moveTo(bm.x1, bm.y1);
      ctx.lineTo(bm.x2, bm.y2);
    }
    ctx.stroke();
  }

  /** Faint range ring when the cursor rests on a built tower. */
  private drawHoverRange(world: World, pointer: PointerState): void {
    if (world.state !== "playing" || pointer.y >= FIELD_H) return;
    const cell = cellAt(pointer.x, pointer.y);
    if (!cell) return;
    const t = towerAt(world, cell.c, cell.r);
    if (!t || t === world.selected) return;
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, towerStats(t).range, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawBuildPreview(world: World, pointer: PointerState): void {
    const ctx = this.ctx;
    if (world.state !== "playing" || !world.buildType || pointer.y >= FIELD_H || world.selected) return;
    const cell = cellAt(pointer.x, pointer.y);
    if (!cell) return;
    const def = TOWER_TYPES[world.buildType];
    const ok = canBuildAt(world, cell.c, cell.r) && world.gold >= def.cost;
    ctx.fillStyle = ok ? "rgba(120,255,150,0.16)" : "rgba(255,90,90,0.16)";
    ctx.fillRect(cell.c * CELL, cell.r * CELL, CELL, CELL);
    if (ok) {
      const cx = cell.c * CELL + CELL / 2, cy = cell.r * CELL + CELL / 2;
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -world.time * 16;
      ctx.beginPath(); ctx.arc(cx, cy, def.range, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawFloatTexts(world: World): void {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    for (const f of world.floatTexts) {
      ctx.globalAlpha = Math.min(1, f.t * 1.6);
      ctx.font = "bold " + f.size + "px monospace";
      ctx.fillStyle = f.color;
      ctx.fillText(f.msg, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawOverlays(world: World): void {
    const ctx = this.ctx;
    // a living boss presses red into the field edges
    if (world.enemies.some(e => e.boss && e.hp > 0)) {
      const pulse = 0.05 + 0.03 * Math.sin(world.time * 3);
      const v = ctx.createRadialGradient(W / 2, FIELD_H / 2, FIELD_H * 0.4, W / 2, FIELD_H / 2, W * 0.62);
      v.addColorStop(0, "rgba(200,30,60,0)");
      v.addColorStop(1, "rgba(200,30,60," + pulse.toFixed(3) + ")");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, FIELD_H);
    }
    if (world.damageFlash > 0) {
      const v = ctx.createRadialGradient(W / 2, FIELD_H / 2, FIELD_H * 0.3, W / 2, FIELD_H / 2, W * 0.6);
      v.addColorStop(0, "rgba(255,0,40,0)");
      v.addColorStop(1, "rgba(255,0,40," + (0.32 * world.damageFlash).toFixed(3) + ")");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, FIELD_H);
    }
    if (world.bossWarnT > 0 && Math.floor(world.time * 5) % 2 === 0) {
      ctx.fillStyle = "rgba(255,60,60,0.08)";
      ctx.fillRect(0, 0, W, FIELD_H);
    }
    if (world.banner) {
      const b = world.banner;
      const f = b.t / b.dur;
      const pop = f > 0.85 ? (1 - f) / 0.15 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, f * 3);
      ctx.textAlign = "center";
      ctx.translate(W / 2, 160);
      ctx.scale(0.7 + pop * 0.3, 0.7 + pop * 0.3);
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 26;
      ctx.fillStyle = b.color;
      ctx.font = "bold 42px monospace";
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "15px monospace";
        ctx.fillText(b.sub, 0, 30);
      }
      ctx.restore();
    }
  }
}
