import { BALANCE, DIFFICULTIES, DIFFICULTY_ORDER, H, UI_Y, W } from "../config/balance";
import { TARGET_MODES, TOWER_TYPES, TYPE_ORDER } from "../config/towers";
import { towerStats, upgradeCost, veteranRank } from "../game/economy";
import { waveComposition } from "../game/waves";
import type { World } from "../game/world";
import { pathRoundRect, roundRect } from "./helpers";
import {
  menuDiffRect, selectedPanelRect, STATS_RIGHT_X, uiActionRect, uiButtonRect,
  uiDeselectRect, uiPauseRect, uiSendWaveRect, uiSpeedRect, type Rect,
} from "./layout";

export function drawUI(
  ctx: CanvasRenderingContext2D, world: World, hoverBtn: number | null,
): void {
  const barG = ctx.createLinearGradient(0, UI_Y, 0, H);
  barG.addColorStop(0, "#0c1122");
  barG.addColorStop(1, "#070a14");
  ctx.fillStyle = barG;
  ctx.fillRect(0, UI_Y, W, H - UI_Y);
  ctx.fillStyle = "rgba(120,150,255,0.3)";
  ctx.fillRect(0, UI_Y, W, 2);

  // wave progress along the top edge of the bar
  if (world.waveActive && world.waveTotal > 0) {
    const remaining = world.enemies.length + world.waveQueue.length;
    const frac = Math.max(0, Math.min(1, 1 - remaining / world.waveTotal));
    ctx.fillStyle = "#7bed9f";
    ctx.fillRect(0, UI_Y, W * frac, 2);
  }

  if (world.selected) {
    drawActionButtons(ctx, world, world.selected);
  } else {
    drawBuildButtons(ctx, world, hoverBtn);
  }
  drawWaveControls(ctx, world);
  drawStats(ctx, world);
  drawSelectedPanel(ctx, world);
}

function drawBuildButtons(
  ctx: CanvasRenderingContext2D, world: World, hoverBtn: number | null,
): void {
  TYPE_ORDER.forEach((key, i) => {
    const def = TOWER_TYPES[key];
    const r = uiButtonRect(i);
    const active = world.buildType === key;
    const hover = hoverBtn === i;
    const affordable = world.gold >= def.cost;
    ctx.fillStyle = active ? "rgba(120,150,255,0.22)" : hover ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.045)";
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    if (active) {
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); pathRoundRect(ctx, r.x, r.y, r.w, r.h, 8); ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(r.x + 16, r.y + 18, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.textAlign = "left";
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = affordable ? "#fff" : "rgba(255,255,255,0.35)";
    ctx.fillText(def.name, r.x + 28, r.y + 16);
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = affordable ? "#ffd700" : "rgba(255,215,0,0.35)";
    ctx.fillText(def.cost + "g", r.x + 28, r.y + 30);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px monospace";
    ctx.fillText(def.desc, r.x + 8, r.y + 47);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText("[" + def.key + "]", r.x + 8, r.y + 60);
  });
}

/** Big touch-friendly actions for the selected tower. */
function drawActionButtons(ctx: CanvasRenderingContext2D, world: World, t: NonNullable<World["selected"]>): void {
  const def = TOWER_TYPES[t.type];
  const maxed = t.level >= BALANCE.maxTowerLevel;
  const finalNext = !maxed && t.level === BALANCE.maxTowerLevel - 1;
  const cost = upgradeCost(t);
  const canUp = !maxed && world.gold >= cost;

  if (finalNext) {
    // the last upgrade is a choice: two half-width spec buttons
    const base = uiActionRect(0);
    const halves: Rect[] = [
      { x: base.x, y: base.y, w: (base.w - 6) / 2, h: base.h },
      { x: base.x + (base.w + 6) / 2, y: base.y, w: (base.w - 6) / 2, h: base.h },
    ];
    def.specs.forEach((spec, i) => {
      const r = halves[i]!;
      ctx.fillStyle = canUp ? "rgba(255,215,0,0.14)" : "rgba(255,255,255,0.04)";
      roundRect(ctx, r.x, r.y, r.w, r.h, 8);
      ctx.textAlign = "center";
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = canUp ? "#ffd700" : "rgba(255,255,255,0.35)";
      ctx.fillText(spec.name.toUpperCase(), r.x + r.w / 2, r.y + 20);
      ctx.font = "9px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(spec.desc, r.x + r.w / 2, r.y + 36);
      ctx.fillText(cost + "g [" + (i === 0 ? "U" : "I") + "]", r.x + r.w / 2, r.y + 52);
    });
  }

  const buttons = [
    ...(finalNext ? [] : [{
      r: uiActionRect(0),
      title: maxed ? "MAX LEVEL" : "UPGRADE",
      sub: maxed ? "fully upgraded" : cost + "g   [U]",
      color: canUp ? "#7bed9f" : "rgba(255,255,255,0.35)",
      bg: canUp ? "rgba(123,237,159,0.16)" : "rgba(255,255,255,0.04)",
    }]),
    {
      r: uiActionRect(1),
      title: "SELL",
      sub: "+" + Math.round(t.spent * BALANCE.sellRefund) + "g   [X]",
      color: "#ffb347",
      bg: "rgba(255,179,71,0.13)",
    },
    {
      r: uiActionRect(2),
      title: "TARGET",
      sub: (TARGET_MODES[t.mode] ?? "first") + "   [T]",
      color: "#9ad0ff",
      bg: "rgba(154,208,255,0.13)",
    },
  ];
  for (const b of buttons) {
    ctx.fillStyle = b.bg;
    roundRect(ctx, b.r.x, b.r.y, b.r.w, b.r.h, 8);
    ctx.textAlign = "center";
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = b.color;
    ctx.fillText(b.title, b.r.x + b.r.w / 2, b.r.y + 28);
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(b.sub, b.r.x + b.r.w / 2, b.r.y + 47);
  }
  if (!finalNext) {
    // tower identity chip on the upgrade button row
    ctx.save();
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(buttons[0]!.r.x + 16, buttons[0]!.r.y + 14, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const dr = uiDeselectRect();
  ctx.fillStyle = "rgba(255,107,107,0.12)";
  roundRect(ctx, dr.x, dr.y, dr.w, dr.h, 8);
  ctx.textAlign = "center";
  ctx.font = "bold 20px monospace";
  ctx.fillStyle = "#ff6b6b";
  ctx.fillText("✕", dr.x + dr.w / 2, dr.y + 40);
}

function drawWaveControls(ctx: CanvasRenderingContext2D, world: World): void {
  const sw = uiSendWaveRect();
  ctx.fillStyle = world.waveActive ? "rgba(255,255,255,0.04)" : "rgba(123,237,159,0.16)";
  roundRect(ctx, sw.x, sw.y, sw.w, sw.h, 8);
  ctx.textAlign = "center";
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = world.waveActive ? "rgba(255,255,255,0.35)" : "#7bed9f";
  ctx.fillText(world.waveActive ? "WAVE " + world.wave : "SEND WAVE", sw.x + sw.w / 2, sw.y + 22);
  ctx.font = "10px monospace";
  if (world.waveActive) {
    ctx.fillText(
      world.enemies.length + world.waveQueue.length + " left",
      sw.x + sw.w / 2, sw.y + 38,
    );
  } else {
    ctx.fillText("[SPACE] +bonus", sw.x + sw.w / 2, sw.y + 38);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("auto in " + Math.ceil(world.interTimer) + "s", sw.x + sw.w / 2, sw.y + 52);
  }
  if (!world.waveActive && world.wave > 0) {
    const counts: Record<string, number> = {};
    for (const t of waveComposition(world.wave + 1)) counts[t] = (counts[t] ?? 0) + 1;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px monospace";
    const summary = Object.entries(counts).map(([k, v]) => v + " " + k).join(", ").slice(0, 26);
    ctx.fillText("next: " + summary, sw.x + sw.w / 2, sw.y + 63);
  }

  const sp = uiSpeedRect();
  ctx.fillStyle = world.gameSpeed === 2 ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.05)";
  roundRect(ctx, sp.x, sp.y, sp.w, sp.h, 6);
  ctx.fillStyle = world.gameSpeed === 2 ? "#ffd700" : "rgba(255,255,255,0.6)";
  ctx.font = "bold 13px monospace";
  ctx.fillText(world.gameSpeed + "x", sp.x + sp.w / 2, sp.y + 20);

  const pp = uiPauseRect();
  ctx.fillStyle = world.paused ? "rgba(255,107,107,0.2)" : "rgba(255,255,255,0.05)";
  roundRect(ctx, pp.x, pp.y, pp.w, pp.h, 6);
  ctx.fillStyle = world.paused ? "#ff6b6b" : "rgba(255,255,255,0.6)";
  ctx.fillText(world.paused ? "▶" : "❚❚", pp.x + pp.w / 2, pp.y + 21);
}

function drawStats(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.textAlign = "right";
  ctx.font = "bold 17px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.fillText(Math.floor(world.gold) + "g", STATS_RIGHT_X, UI_Y + 26);
  ctx.fillStyle = world.lives > 5 ? "#ff6b6b" : (Math.floor(world.time * 4) % 2 ? "#ff6b6b" : "#fff");
  ctx.fillText("♥ " + Math.max(0, world.lives), STATS_RIGHT_X, UI_Y + 48);
  ctx.fillStyle = "#9ad0ff";
  ctx.font = "bold 12px monospace";
  ctx.fillText("score " + world.score, STATS_RIGHT_X, UI_Y + 68);
}

function drawSelectedPanel(ctx: CanvasRenderingContext2D, world: World): void {
  const t = world.selected;
  if (!t) return;
  const s = towerStats(t);
  const def = TOWER_TYPES[t.type];
  const rect = selectedPanelRect(t.x, t.y);
  const px = rect.x, py = rect.y;
  ctx.fillStyle = "rgba(8,12,26,0.94)";
  roundRect(ctx, px, py, rect.w, rect.h, 8);
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 1;
  ctx.beginPath(); pathRoundRect(ctx, px, py, rect.w, rect.h, 8); ctx.stroke();
  ctx.textAlign = "left";
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = def.color;
  const maxed = t.level >= BALANCE.maxTowerLevel;
  const rank = veteranRank(t);
  ctx.fillText(s.name + "  Lv" + t.level + (maxed ? " MAX" : ""), px + 10, py + 18);
  if (rank > 0) {
    ctx.fillStyle = "#ffd700";
    ctx.textAlign = "right";
    ctx.fillText("★".repeat(rank), px + 190, py + 18);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "11px monospace";
  ctx.fillText(
    "dmg " + Math.round(s.dmg) + "  rng " + Math.round(s.range) + "  spd " + s.rate.toFixed(1) + "/s" +
      "  ☠" + t.kills,
    px + 10, py + 34,
  );
  ctx.fillStyle = "#9ad0ff";
  ctx.fillText("[T] target: " + (TARGET_MODES[t.mode] ?? "first"), px + 10, py + 49);
  ctx.fillStyle = maxed ? "rgba(255,255,255,0.35)" : "#7bed9f";
  ctx.fillText(maxed ? "fully upgraded" : "[U] upgrade  " + upgradeCost(t) + "g", px + 10, py + 64);
  ctx.fillStyle = "#ffb347";
  ctx.fillText("[X] sell  +" + Math.round(t.spent * BALANCE.sellRefund) + "g", px + 10, py + 79);
}

export function drawMenu(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.fillStyle = "rgba(4,7,16,0.66)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  const breathe = 1 + Math.sin(world.time * 1.6) * 0.02;
  ctx.save();
  ctx.translate(W / 2, 150);
  ctx.scale(breathe, breathe);
  ctx.shadowColor = "rgba(123,237,159,0.9)";
  ctx.shadowBlur = 30 + Math.sin(world.time * 2.4) * 10;
  ctx.fillStyle = "#7bed9f";
  ctx.font = "bold 60px monospace";
  ctx.fillText("GRID DEFENSE", 0, 0);
  ctx.restore();
  ctx.fillStyle = "#9ad0ff";
  ctx.font = "15px monospace";
  ctx.fillText("Six towers. Five breeds of creep. One path. Hold it.", W / 2, 192);

  ctx.font = "13px monospace";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const lines = [
    "CLICK a tower (or 1-6), then CLICK open ground to build.",
    "CLICK a built tower:  [U] upgrade · [X] sell · [T] targeting mode",
    "[SPACE] send wave early (+gold) · [F] 2x speed · [P] pause · [M] mute",
    "",
    "Gunner rapid · Cannon splash · Frost slow · Venom poison · Tesla chain · Sniper rail",
    "Tanks have ARMOR (snipers pierce, poison ignores). Regens heal. Splitters split.",
    "HEALERS mend their kin — cut them down first.",
    "Unspent gold earns 6% INTEREST each wave. Boss every 5th.",
    "No leaks = PERFECT bonus. Towers earn ★ veteran ranks with kills.",
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 256 + i * 27));

  if (world.best > 0) {
    ctx.fillStyle = "#ffd700";
    ctx.fillText("BEST SCORE: " + world.best, W / 2, 516);
  }
  ctx.fillStyle = Math.floor(world.time * 2) % 2 ? "#7bed9f" : "#4ecdc4";
  ctx.font = "bold 22px monospace";
  ctx.fillText("CLICK OR PRESS SPACE TO START", W / 2, 578);

  DIFFICULTY_ORDER.forEach((d, i) => {
    const r = menuDiffRect(i);
    const active = world.difficulty === d;
    ctx.fillStyle = active ? "rgba(123,237,159,0.18)" : "rgba(255,255,255,0.06)";
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    if (active) {
      ctx.strokeStyle = "#7bed9f";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); pathRoundRect(ctx, r.x, r.y, r.w, r.h, 8); ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = active ? "#7bed9f" : "rgba(255,255,255,0.6)";
    ctx.fillText(DIFFICULTIES[d].label, r.x + r.w / 2, r.y + 17);
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(DIFFICULTIES[d].lives + " lives", r.x + r.w / 2, r.y + 31);
  });
}

export function drawGameOver(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.fillStyle = "rgba(4,7,16,0.84)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.save();
  if (world.won) {
    ctx.shadowColor = "rgba(255,215,0,0.85)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 48px monospace";
    ctx.fillText("A VICTORIOUS LAST STAND", W / 2, 220);
  } else {
    ctx.shadowColor = "rgba(255,107,107,0.85)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#ff6b6b";
    ctx.font = "bold 48px monospace";
    ctx.fillText("THE BASE HAS FALLEN", W / 2, 220);
  }
  ctx.restore();
  ctx.fillStyle = "#9ad0ff";
  ctx.font = "16px monospace";
  ctx.fillText(
    "Survived " + Math.max(0, world.wave - 1) + " waves on " +
      DIFFICULTIES[world.difficulty].label + "  ·  " + world.kills + " kills" +
      (world.won ? "  ·  ★ won at wave " + BALANCE.victoryWave : ""),
    W / 2, 268,
  );
  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 28px monospace";
  ctx.fillText(
    "SCORE " + world.score + (world.score >= world.best && world.score > 0 ? "  ★ NEW BEST!" : ""),
    W / 2, 318,
  );

  // tower hall of fame: top 3 by damage dealt
  const mvps = [...world.towers]
    .filter(t => t.dmgDealt > 0)
    .sort((a, b) => b.dmgDealt - a.dmgDealt)
    .slice(0, 3);
  if (mvps.length > 0) {
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("— TOWER HALL OF FAME —", W / 2, 366);
    ctx.font = "13px monospace";
    mvps.forEach((t, i) => {
      const s = towerStats(t);
      ctx.fillStyle = TOWER_TYPES[t.type].color;
      ctx.fillText(
        (i === 0 ? "★ MVP  " : "       ") + s.name + " Lv" + t.level +
          "  ·  " + Math.round(t.dmgDealt).toLocaleString() + " dmg  ·  " + t.kills + " kills",
        W / 2, 392 + i * 22,
      );
    });
  }

  ctx.fillStyle = "#7bed9f";
  ctx.font = "bold 18px monospace";
  ctx.fillText("[R] or CLICK to play again", W / 2, 488);
}
