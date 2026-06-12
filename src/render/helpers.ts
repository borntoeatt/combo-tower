/** Small canvas drawing utilities shared across render modules. */

export function pathRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  pathRoundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

/** Lighten (+amt) or darken (−amt) a #rrggbb color. */
export function shade(hex: string, amt: number): string {
  const p = [1, 3, 5].map(i =>
    Math.max(0, Math.min(255, parseInt(hex.substring(i, i + 2), 16) + amt)),
  );
  return "rgb(" + p.join(",") + ")";
}
