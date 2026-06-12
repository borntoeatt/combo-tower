import type { World } from "./game/world";

/**
 * Developer overlay (toggle with backquote `). Frame timing,
 * entity counts, and live world state — because an overengineered
 * game deserves observability.
 */
export class DebugOverlay {
  enabled = false;
  private samples: number[] = [];

  constructor() {
    addEventListener("keydown", e => {
      if (e.code === "Backquote") this.enabled = !this.enabled;
    });
  }

  recordFrame(dtMs: number): void {
    this.samples.push(dtMs);
    if (this.samples.length > 60) this.samples.shift();
  }

  draw(ctx: CanvasRenderingContext2D, world: World): void {
    if (!this.enabled) return;
    const avg = this.samples.reduce((a, b) => a + b, 0) / Math.max(1, this.samples.length);
    const fps = avg > 0 ? 1000 / avg : 0;
    const lines = [
      `fps      ${fps.toFixed(1)} (${avg.toFixed(2)}ms)`,
      `state    ${world.state}${world.isDemo ? " (demo)" : ""}${world.paused ? " paused" : ""}`,
      `wave     ${world.wave} ${world.waveActive ? "active" : "idle"} queue=${world.waveQueue.length}`,
      `enemies  ${world.enemies.length}`,
      `towers   ${world.towers.length}`,
      `bullets  ${world.bullets.length}  beams ${world.beams.length}`,
      `particles ${world.particles.length}  smoke ${world.smokes.length}`,
      `gold     ${Math.floor(world.gold)}  lives ${world.lives}  score ${world.score}`,
    ];
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(8, 8, 250, lines.length * 16 + 14);
    ctx.fillStyle = "#7bed9f";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    lines.forEach((l, i) => ctx.fillText(l, 16, 26 + i * 16));
    ctx.restore();
  }
}
