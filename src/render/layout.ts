import { UI_Y, W } from "../config/balance";
import { TYPE_ORDER } from "../config/towers";

export interface Rect { x: number; y: number; w: number; h: number; }

export function inRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function uiButtonRect(i: number): Rect {
  return { x: 10 + i * 106, y: UI_Y + 9, w: 98, h: 66 };
}

export function uiButtonAt(px: number, py: number): number | null {
  for (let i = 0; i < TYPE_ORDER.length; i++) {
    if (inRect(px, py, uiButtonRect(i))) return i;
  }
  return null;
}

export function uiSendWaveRect(): Rect { return { x: 654, y: UI_Y + 9, w: 104, h: 66 }; }
export function uiSpeedRect(): Rect    { return { x: 766, y: UI_Y + 9, w: 44, h: 31 }; }
export function uiPauseRect(): Rect    { return { x: 766, y: UI_Y + 44, w: 44, h: 31 }; }

/** Info panel for a selected tower at (tx, ty) — drawn by hud, hit-tested by input. */
export function selectedPanelRect(tx: number, ty: number): Rect {
  return { x: Math.min(W - 210, Math.max(8, tx - 100)), y: Math.max(8, ty - 118), w: 200, h: 86 };
}

/** Tappable rows inside the panel (touch screens have no U/X/T keys). */
export function panelTargetRect(p: Rect): Rect  { return { x: p.x, y: p.y + 39, w: p.w, h: 15 }; }
export function panelUpgradeRect(p: Rect): Rect { return { x: p.x, y: p.y + 54, w: p.w, h: 15 }; }
export function panelSellRect(p: Rect): Rect    { return { x: p.x, y: p.y + 69, w: p.w, h: 17 }; }

export const STATS_RIGHT_X = W - 14;
