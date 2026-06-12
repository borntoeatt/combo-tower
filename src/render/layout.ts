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

export const STATS_RIGHT_X = W - 14;
