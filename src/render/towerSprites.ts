import { TOWER_TYPES, TYPE_ORDER, type TowerTypeId } from "../config/towers";
import type { CanvasFactory } from "./background";
import { pathRoundRect, roundRect, shade } from "./helpers";

/**
 * Pre-rendered tower artwork. ctx.shadowBlur is the most expensive
 * canvas op there is; baking it into sprites at startup removes it
 * from the hot render loop entirely. Sprites are rasterized at 2x
 * and drawn scaled down, so they stay crisp on retina displays.
 */
export interface TowerSprites {
  /** 64×64 logical px, centered: shadow + base plate (shared). */
  plate: HTMLCanvasElement | null;
  /** 32×32 logical px, centered: glowing dome (sits above the barrel). */
  dome: Record<TowerTypeId, HTMLCanvasElement | null>;
  /** 96×48 logical px, pivot at (32,24), barrel pointing +x. */
  barrel: Record<TowerTypeId, HTMLCanvasElement | null>;
  /** 32×32 logical px glowing projectile, keyed by tower color. */
  bullet: Record<string, HTMLCanvasElement | null>;
}

/** Muzzle x-offset per type, for placing the flash at the barrel tip. */
export const MUZZLE_X: Readonly<Record<TowerTypeId, number>> = {
  gunner: 18, cannon: 19, frost: 20, venom: 21, tesla: 19, sniper: 26,
};

const RES = 2; // sprite supersampling

function makeLayer(
  createCanvas: CanvasFactory, w: number, h: number,
): { cnv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const cnv = createCanvas();
  if (!cnv) return null;
  cnv.width = w * RES;
  cnv.height = h * RES;
  const ctx = cnv.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  return { cnv, ctx };
}

/** Type-specific turret silhouette, drawn pointing +x around (0,0). */
export function traceTurret(ctx: CanvasRenderingContext2D, type: TowerTypeId, color: string): void {
  switch (type) {
    case "gunner": // twin rapid-fire barrels
      roundRect(ctx, -4, -6.5, 20, 5, 2);
      roundRect(ctx, -4, 1.5, 20, 5, 2);
      break;
    case "cannon": // fat mortar tube with a muzzle band
      roundRect(ctx, -5, -6.5, 22, 13, 5);
      ctx.fillStyle = shade(color, -55);
      ctx.fillRect(12, -7, 4, 14);
      break;
    case "frost": // crystal spike
      ctx.beginPath();
      ctx.moveTo(-3, -7); ctx.lineTo(20, 0); ctx.lineTo(-3, 7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(2, -2.5); ctx.lineTo(14, 0); ctx.lineTo(2, 2.5);
      ctx.closePath(); ctx.fill();
      break;
    case "venom": // injector tube ending in a toxin orb
      roundRect(ctx, -4, -3.5, 15, 7, 3);
      ctx.beginPath(); ctx.arc(15, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath(); ctx.arc(13.5, -2, 2, 0, Math.PI * 2); ctx.fill();
      break;
    case "tesla": // coil rod with discs and a tip sphere
      roundRect(ctx, -4, -2.5, 19, 5, 2);
      ctx.fillRect(5, -7, 3, 14);
      ctx.fillRect(10, -5.5, 3, 11);
      ctx.beginPath(); ctx.arc(17, 0, 3.5, 0, Math.PI * 2); ctx.fill();
      break;
    case "sniper": // long rail with scope and muzzle brake
      roundRect(ctx, -6, -2.5, 30, 5, 2);
      ctx.fillRect(21, -4.5, 3, 9);
      ctx.beginPath(); ctx.arc(3, -5, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
  }
}

export function buildTowerSprites(createCanvas: CanvasFactory): TowerSprites {
  const dome = {} as TowerSprites["dome"];
  const barrel = {} as TowerSprites["barrel"];
  const bullet: TowerSprites["bullet"] = {};

  // --- shared shadow + base plate (drawn centered at 32,32) ---
  const p = makeLayer(createCanvas, 64, 64);
  if (p) {
    const c = p.ctx;
    c.translate(32, 32);
    c.fillStyle = "rgba(0,0,0,0.4)";
    c.beginPath(); c.ellipse(0, 13, 15, 5, 0, 0, Math.PI * 2); c.fill();
    const baseG = c.createLinearGradient(-15, -15, 15, 15);
    baseG.addColorStop(0, "#4a5480");
    baseG.addColorStop(1, "#272e4d");
    c.fillStyle = baseG;
    roundRect(c, -15, -15, 30, 30, 7);
    c.strokeStyle = "rgba(255,255,255,0.12)";
    c.lineWidth = 1;
    c.beginPath(); pathRoundRect(c, -15, -15, 30, 30, 7); c.stroke();
  }
  const plate = p?.cnv ?? null;

  for (const type of TYPE_ORDER) {
    const def = TOWER_TYPES[type];

    // --- glowing dome (centered at 16,16) ---
    const d = makeLayer(createCanvas, 32, 32);
    if (d) {
      const c = d.ctx;
      c.translate(16, 16);
      c.shadowColor = def.glow;
      c.shadowBlur = 8;
      const domeG = c.createRadialGradient(-3, -3, 1, 0, 0, 9);
      domeG.addColorStop(0, "#ffffff");
      domeG.addColorStop(0.25, def.color);
      domeG.addColorStop(1, shade(def.color, -40));
      c.fillStyle = domeG;
      c.beginPath(); c.arc(0, 0, 8.5, 0, Math.PI * 2); c.fill();
    }
    dome[type] = d?.cnv ?? null;

    // --- barrel, pivot at (32,24), glow baked ---
    const r = makeLayer(createCanvas, 96, 48);
    if (r) {
      const c = r.ctx;
      c.translate(32, 24);
      c.shadowColor = def.glow;
      c.shadowBlur = 7;
      c.fillStyle = def.color;
      traceTurret(c, type, def.color);
    }
    barrel[type] = r?.cnv ?? null;

    // --- projectile glow (centered at 16,16) ---
    if (!(def.color in bullet)) {
      const p = makeLayer(createCanvas, 32, 32);
      if (p) {
        const c = p.ctx;
        c.translate(16, 16);
        c.shadowColor = def.color;
        c.shadowBlur = 10;
        c.fillStyle = def.color;
        c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 6;
        c.fillStyle = "#ffffff";
        c.beginPath(); c.arc(0, 0, 2.6, 0, Math.PI * 2); c.fill();
      }
      bullet[def.color] = p?.cnv ?? null;
    }
  }

  return { plate, dome, barrel, bullet };
}
