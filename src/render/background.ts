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

  // deterministic per-tile hash so the plating looks fixed, not noisy
  const hash = (c: number, r: number) =>
    ((Math.sin(c * 127.1 + r * 311.7) * 43758.5453) % 1 + 1) % 1;

  // beveled deck plates with brightness variation, rivets and circuit traces
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (pathCells.has(c + "," + r)) continue;
      const x = c * CELL, y = r * CELL;
      const h = hash(c, r);

      const lum = 0.012 + h * 0.03 + ((c + r) % 2 === 0 ? 0.014 : 0);
      b.fillStyle = "rgba(255,255,255," + lum.toFixed(3) + ")";
      b.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);

      // bevel: lit top/left edge, shaded bottom/right edge
      b.fillStyle = "rgba(255,255,255,0.045)";
      b.fillRect(x + 1, y + 1, CELL - 2, 1);
      b.fillRect(x + 1, y + 1, 1, CELL - 2);
      b.fillStyle = "rgba(0,0,0,0.22)";
      b.fillRect(x + 1, y + CELL - 2, CELL - 2, 1);
      b.fillRect(x + CELL - 2, y + 1, 1, CELL - 2);

      // corner rivets on roughly half the plates
      if (h > 0.45) {
        b.fillStyle = "rgba(255,255,255,0.08)";
        for (const [rx, ry] of [[5, 5], [CELL - 6, 5], [5, CELL - 6], [CELL - 6, CELL - 6]]) {
          b.beginPath(); b.arc(x + rx!, y + ry!, 1.2, 0, Math.PI * 2); b.fill();
        }
      }
      // occasional circuit trace: a glowing L through the plate
      if (h > 0.86) {
        const midX = x + 8 + Math.floor(h * 100) % (CELL - 16);
        b.strokeStyle = "rgba(110,150,255,0.10)";
        b.lineWidth = 1.5;
        b.beginPath();
        b.moveTo(x + 4, y + CELL / 2);
        b.lineTo(midX, y + CELL / 2);
        b.lineTo(midX, h > 0.93 ? y + 4 : y + CELL - 4);
        b.stroke();
        b.fillStyle = "rgba(150,190,255,0.25)";
        b.fillRect(midX - 1, (h > 0.93 ? y + 3 : y + CELL - 5), 2, 2);
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

  // path: dark trench with an inner bed, lit rims and a soft floor glow
  b.lineCap = "round";
  b.lineJoin = "round";
  b.strokeStyle = "#070a14";
  b.lineWidth = CELL - 2;
  strokePath(b);
  b.strokeStyle = "#10182e";
  b.lineWidth = CELL - 8;
  strokePath(b);
  b.strokeStyle = "#1c2747";
  b.lineWidth = CELL - 14;
  strokePath(b);
  b.save();
  b.strokeStyle = "rgba(90,125,220,0.18)";
  b.lineWidth = 4;
  b.shadowColor = "rgba(110,150,255,0.6)";
  b.shadowBlur = 10;
  strokePath(b);
  b.restore();
  // rim lines hugging the trench edges
  b.strokeStyle = "rgba(150,180,255,0.12)";
  b.lineWidth = CELL - 4;
  b.setLineDash([2, 9]);
  strokePath(b);
  b.setLineDash([]);

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
