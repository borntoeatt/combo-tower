import { CELL, COLS, FIELD_H, ROWS, W } from "../config/balance";
import { pathCells, WP } from "../config/path";

export type CanvasFactory = () => HTMLCanvasElement | null;

/**
 * Pre-renders the static field (gradient, tiles, speckle noise,
 * path bed, vignette) into an offscreen canvas once, so the hot
 * render loop just blits it.
 */
export function buildBackground(createCanvas: CanvasFactory, dpr: number): HTMLCanvasElement | null {
  const cnv = createCanvas();
  if (!cnv) return null;
  cnv.width = W * dpr;
  cnv.height = FIELD_H * dpr;
  const b = cnv.getContext("2d");
  if (!b) return null;
  b.setTransform(dpr, 0, 0, dpr, 0, 0);

  const grad = b.createLinearGradient(0, 0, W, FIELD_H);
  grad.addColorStop(0, "#15203a");
  grad.addColorStop(1, "#0d1322");
  b.fillStyle = grad;
  b.fillRect(0, 0, W, FIELD_H);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (pathCells.has(c + "," + r)) continue;
      if ((c + r) % 2 === 0) {
        b.fillStyle = "rgba(255,255,255,0.022)";
        b.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
  }
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * W, y = Math.random() * FIELD_H;
    const cc = Math.floor(x / CELL), rr = Math.floor(y / CELL);
    if (pathCells.has(cc + "," + rr)) continue;
    b.fillStyle = "rgba(255,255,255," + (0.015 + Math.random() * 0.03) + ")";
    b.fillRect(x, y, 1.5, 1.5);
  }

  b.lineCap = "round";
  b.lineJoin = "round";
  b.strokeStyle = "#070a14";
  b.lineWidth = CELL - 4;
  strokePath(b);
  b.strokeStyle = "#1c2747";
  b.lineWidth = CELL - 10;
  strokePath(b);

  const v = b.createRadialGradient(W / 2, FIELD_H / 2, FIELD_H * 0.45, W / 2, FIELD_H / 2, W * 0.72);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  b.fillStyle = v;
  b.fillRect(0, 0, W, FIELD_H);

  return cnv;
}

export function strokePath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  WP.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
}
