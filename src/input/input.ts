import { FIELD_H, UI_Y, W } from "../config/balance";
import { canvasH, clampCamera, fieldToScreen, makeCamera, screenToField } from "../render/viewport";
import { TOWER_TYPES, TYPE_ORDER, TARGET_MODES } from "../config/towers";
import type { GameController } from "../game/controller";
import { buildTower, canBuildAt, cellAt, sellTower, towerAt, tryUpgrade } from "../game/economy";
import { sendWave } from "../game/waves";
import type { World } from "../game/world";
import type { PointerState } from "../render/renderer";
import {
  inRect, menuDiffRect, panelSellRect, panelTargetRect, panelUpgradeRect,
  selectedPanelRect, uiActionRect, uiButtonAt, uiDeselectRect, uiPauseRect,
  uiSendWaveRect, uiSpeedRect,
} from "../render/layout";
import { BALANCE, DIFFICULTY_ORDER } from "../config/balance";

/** Wires DOM mouse/keyboard events to game intents. */
export class InputController {
  readonly pointer: PointerState = {
    x: -100, y: -100, hoverBtn: null, pendingCell: null, cam: makeCamera(),
  };

  /** Coarse pointers (fingers) get a two-tap build confirmation. */
  private readonly coarse =
    typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

  /** One-finger gesture bookkeeping: tap vs pan discrimination. */
  private touch: {
    mode: "tap" | "pan" | "pinch";
    x: number; y: number;        // canvas coords of gesture start
    t: number;
    dist: number; z0: number;    // pinch baseline
    wx0: number; wy0: number;    // world point under the pinch midpoint
  } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private world: World,
    private controller: GameController,
    private onUserGesture: () => void,
    private now: () => number = () => performance.now(),
  ) {
    canvas.addEventListener("mousemove", e => this.onMove(e));
    canvas.addEventListener("click", e => this.onClick(e));
    canvas.addEventListener("touchstart", e => this.onTouchStart(e), { passive: false });
    canvas.addEventListener("touchmove", e => this.onTouchMove(e), { passive: false });
    canvas.addEventListener("touchend", e => this.onTouchEnd(e), { passive: false });
    canvas.addEventListener("touchcancel", () => { this.touch = null; });
    addEventListener("keydown", e => this.onKey(e));
  }

  private clientToCanvas(clientX: number, clientY: number): readonly [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [
      (clientX - rect.left) * (W / rect.width),
      (clientY - rect.top) * (canvasH() / rect.height),
    ] as const;
  }

  private toCanvas(e: MouseEvent): readonly [number, number] {
    return this.clientToCanvas(e.clientX, e.clientY);
  }

  /** Canvas coords → world coords for the field, identity for the UI bar. */
  private unproject(px: number, py: number): readonly [number, number] {
    if (py >= FIELD_H) return [px, py] as const;
    return screenToField(this.pointer.cam, px, py);
  }

  private onMove(e: MouseEvent): void {
    const [sx, sy] = this.toCanvas(e);
    const [x, y] = this.unproject(sx, sy);
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.hoverBtn = sy >= UI_Y ? uiButtonAt(sx, sy) : null;
  }

  // ---------- touch gestures: tap / pan / pinch ----------

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault(); // suppress emulated mouse events and page gestures
    this.onUserGesture();
    const cam = this.pointer.cam;
    if (e.touches.length >= 2) {
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      const [ax, ay] = this.clientToCanvas(a.clientX, a.clientY);
      const [bx, by] = this.clientToCanvas(b.clientX, b.clientY);
      const [wx0, wy0] = screenToField(cam, (ax + bx) / 2, (ay + by) / 2);
      this.touch = {
        mode: "pinch", x: (ax + bx) / 2, y: (ay + by) / 2, t: this.now(),
        dist: Math.max(1, Math.hypot(bx - ax, by - ay)), z0: cam.z, wx0, wy0,
      };
      return;
    }
    const t0 = e.touches[0]!;
    const [x, y] = this.clientToCanvas(t0.clientX, t0.clientY);
    this.touch = { mode: "tap", x, y, t: this.now(), dist: 0, z0: cam.z, wx0: 0, wy0: 0 };
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const ts = this.touch;
    if (!ts) return;
    const cam = this.pointer.cam;
    if (ts.mode === "pinch" && e.touches.length >= 2) {
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      const [ax, ay] = this.clientToCanvas(a.clientX, a.clientY);
      const [bx, by] = this.clientToCanvas(b.clientX, b.clientY);
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      cam.z = ts.z0 * (Math.hypot(bx - ax, by - ay) / ts.dist);
      clampCamera(cam);
      // keep the world point that started under the fingers under them
      cam.cx = ts.wx0 - (mx - W / 2) / cam.z;
      cam.cy = ts.wy0 - (my - FIELD_H / 2) / cam.z;
      clampCamera(cam);
      return;
    }
    const t0 = e.touches[0];
    if (!t0) return;
    const [x, y] = this.clientToCanvas(t0.clientX, t0.clientY);
    if (ts.mode === "tap" && Math.hypot(x - ts.x, y - ts.y) > 14 &&
        cam.z > 1.001 && ts.y < FIELD_H) {
      ts.mode = "pan";
    }
    if (ts.mode === "pan") {
      cam.cx -= (x - ts.x) / cam.z;
      cam.cy -= (y - ts.y) / cam.z;
      clampCamera(cam);
      ts.x = x; ts.y = y;
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    const ts = this.touch;
    this.touch = null;
    if (!ts || ts.mode !== "tap") return;
    if (this.now() - ts.t > 600) return;
    this.handleTap(ts.x, ts.y);
  }

  private onClick(e: MouseEvent): void {
    this.onUserGesture();
    const [px, py] = this.toCanvas(e);
    this.handleTap(px, py);
  }

  /** Shared mouse-click / touch-tap dispatch. Coords are canvas-space. */
  private handleTap(px: number, py: number): void {
    const w = this.world;

    if (w.state === "menu") {
      for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
        if (inRect(px, py, menuDiffRect(i))) {
          w.difficulty = DIFFICULTY_ORDER[i]!;
          return;
        }
      }
      this.controller.startGame();
      return;
    }
    if (w.state === "gameover") {
      if (this.now() - w.gameOverAt > 800) this.controller.startGame();
      return;
    }

    if (py >= UI_Y) {
      if (w.selected) {
        // bar shows big tower actions while something is selected
        const t = w.selected;
        if (inRect(px, py, uiActionRect(0))) {
          // the final level splits slot 0 into two spec halves
          if (t.level === BALANCE.maxTowerLevel - 1) {
            const base = uiActionRect(0);
            tryUpgrade(w, t, px < base.x + base.w / 2 ? 0 : 1);
          } else {
            tryUpgrade(w, t);
          }
          return;
        }
        if (inRect(px, py, uiActionRect(1))) { sellTower(w, t); return; }
        if (inRect(px, py, uiActionRect(2))) {
          t.mode = (t.mode + 1) % TARGET_MODES.length;
          w.addText(t.x, t.y - 24, "target: " + (TARGET_MODES[t.mode] ?? "first"), "#9ad0ff");
          return;
        }
        if (inRect(px, py, uiDeselectRect())) { w.selected = null; return; }
      } else {
        const idx = uiButtonAt(px, py);
        if (idx !== null) {
          w.buildType = TYPE_ORDER[idx] ?? null;
          w.selected = null;
          this.pointer.pendingCell = null;
          return;
        }
      }
      if (inRect(px, py, uiSendWaveRect())) {
        if (!w.waveActive) sendWave(w, true);
        return;
      }
      if (inRect(px, py, uiSpeedRect())) { w.gameSpeed = w.gameSpeed === 1 ? 2 : 1; return; }
      if (inRect(px, py, uiPauseRect())) { w.paused = !w.paused; return; }
      return;
    }

    // taps on the selected tower's panel act on its rows (touch has no U/X/T)
    if (w.selected) {
      const [tsx, tsy] = fieldToScreen(this.pointer.cam, w.selected.x, w.selected.y);
      const panel = selectedPanelRect(tsx, tsy);
      if (inRect(px, py, panel)) {
        const t = w.selected;
        if (inRect(px, py, panelTargetRect(panel))) {
          t.mode = (t.mode + 1) % TARGET_MODES.length;
          w.addText(t.x, t.y - 24, "target: " + (TARGET_MODES[t.mode] ?? "first"), "#9ad0ff");
        } else if (inRect(px, py, panelUpgradeRect(panel))) {
          tryUpgrade(w, t);
        } else if (inRect(px, py, panelSellRect(panel))) {
          sellTower(w, t);
        }
        return;
      }
    }

    const [wx, wy] = this.unproject(px, py);
    const cell = cellAt(wx, wy);
    if (!cell) return;
    const existing = towerAt(w, cell.c, cell.r);
    if (existing) {
      w.selected = existing === w.selected ? null : existing;
      this.pointer.pendingCell = null;
      return;
    }
    w.selected = null;
    if (!w.buildType) return;

    // fingers can't hover a preview — first tap parks a ghost,
    // a second tap on the same cell confirms the build
    if (this.coarse) {
      const p = this.pointer.pendingCell;
      if (!p || p.c !== cell.c || p.r !== cell.r) {
        this.pointer.pendingCell = canBuildAt(w, cell.c, cell.r) ? cell : null;
        return;
      }
      this.pointer.pendingCell = null;
    }

    if (!buildTower(w, w.buildType, cell.c, cell.r)) {
      const def = TOWER_TYPES[w.buildType];
      if (w.gold < def.cost) w.addText(wx, wy, "Need " + def.cost + "g", "#ff6b6b");
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === "Space") e.preventDefault();
    this.onUserGesture();
    const w = this.world;

    if (w.state === "menu" && (e.code === "Space" || e.code === "Enter")) {
      this.controller.startGame();
      return;
    }
    if (w.state === "gameover" && e.code === "KeyR") { this.controller.startGame(); return; }
    if (w.state !== "playing") return;

    const type = TYPE_ORDER.find(k => TOWER_TYPES[k].key === e.key);
    if (type) { w.buildType = type; w.selected = null; this.pointer.pendingCell = null; }
    if (e.code === "Space" && !w.waveActive && !w.paused) sendWave(w, true);
    if (e.code === "KeyU" && w.selected) tryUpgrade(w, w.selected, 0);
    if (e.code === "KeyI" && w.selected) tryUpgrade(w, w.selected, 1);
    if (e.code === "KeyX" && w.selected) sellTower(w, w.selected);
    if (e.code === "KeyT" && w.selected) {
      w.selected.mode = (w.selected.mode + 1) % TARGET_MODES.length;
      w.addText(
        w.selected.x, w.selected.y - 24,
        "target: " + (TARGET_MODES[w.selected.mode] ?? "first"), "#9ad0ff",
      );
    }
    if (e.code === "KeyF") w.gameSpeed = w.gameSpeed === 1 ? 2 : 1;
    if (e.code === "KeyP") w.paused = !w.paused;
    if (e.code === "KeyM") w.muted = !w.muted;
    if (e.code === "Escape") { w.selected = null; this.pointer.pendingCell = null; }
  }
}
