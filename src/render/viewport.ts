import { FIELD_H, W } from "../config/balance";

/**
 * Orientation-aware canvas geometry. Landscape keeps the classic
 * single-row 84px bar; portrait doubles the bar into two rows of
 * finger-sized buttons and the canvas grows accordingly.
 */
export const LANDSCAPE_BAR_H = 84;
export const PORTRAIT_BAR_H = 148;

let portrait = false;

export function setPortraitLayout(on: boolean): void {
  portrait = on;
}

export function isPortraitLayout(): boolean {
  return portrait;
}

export function barH(): number {
  return portrait ? PORTRAIT_BAR_H : LANDSCAPE_BAR_H;
}

export function canvasH(): number {
  return FIELD_H + barH();
}

/**
 * Field camera for phones: pinch to zoom, drag to pan. z=1 with a
 * centered window is a no-op (the desktop default).
 */
export interface Camera {
  z: number;
  cx: number;
  cy: number;
}

export function makeCamera(): Camera {
  return { z: 1, cx: W / 2, cy: FIELD_H / 2 };
}

/** Field/world coords → canvas coords under the camera. */
export function fieldToScreen(cam: Camera, wx: number, wy: number): readonly [number, number] {
  return [(wx - cam.cx) * cam.z + W / 2, (wy - cam.cy) * cam.z + FIELD_H / 2] as const;
}

/** Canvas coords → field/world coords (field region only). */
export function screenToField(cam: Camera, sx: number, sy: number): readonly [number, number] {
  return [(sx - W / 2) / cam.z + cam.cx, (sy - FIELD_H / 2) / cam.z + cam.cy] as const;
}

/** Keep the zoom window inside the field. */
export function clampCamera(cam: Camera): void {
  cam.z = Math.max(1, Math.min(2.5, cam.z));
  const hw = W / 2 / cam.z, hh = FIELD_H / 2 / cam.z;
  cam.cx = Math.max(hw, Math.min(W - hw, cam.cx));
  cam.cy = Math.max(hh, Math.min(FIELD_H - hh, cam.cy));
}
