import { UI_Y, W, H } from "../config/balance";
import { TOWER_TYPES, TYPE_ORDER, TARGET_MODES } from "../config/towers";
import type { GameController } from "../game/controller";
import { buildTower, canBuildAt, cellAt, sellTower, towerAt, tryUpgrade } from "../game/economy";
import { sendWave } from "../game/waves";
import type { World } from "../game/world";
import type { PointerState } from "../render/renderer";
import {
  inRect, panelSellRect, panelTargetRect, panelUpgradeRect, selectedPanelRect,
  uiActionRect, uiButtonAt, uiDeselectRect, uiPauseRect, uiSendWaveRect, uiSpeedRect,
} from "../render/layout";

/** Wires DOM mouse/keyboard events to game intents. */
export class InputController {
  readonly pointer: PointerState = { x: -100, y: -100, hoverBtn: null, pendingCell: null };

  /** Coarse pointers (fingers) get a two-tap build confirmation. */
  private readonly coarse =
    typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

  constructor(
    private canvas: HTMLCanvasElement,
    private world: World,
    private controller: GameController,
    private onUserGesture: () => void,
    private now: () => number = () => performance.now(),
  ) {
    canvas.addEventListener("mousemove", e => this.onMove(e));
    canvas.addEventListener("click", e => this.onClick(e));
    addEventListener("keydown", e => this.onKey(e));
  }

  private toCanvas(e: MouseEvent): readonly [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * (W / rect.width),
      (e.clientY - rect.top) * (H / rect.height),
    ] as const;
  }

  private onMove(e: MouseEvent): void {
    const [x, y] = this.toCanvas(e);
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.hoverBtn = y >= UI_Y ? uiButtonAt(x, y) : null;
  }

  private onClick(e: MouseEvent): void {
    this.onUserGesture();
    const [px, py] = this.toCanvas(e);
    const w = this.world;

    if (w.state === "menu") { this.controller.startGame(); return; }
    if (w.state === "gameover") {
      if (this.now() - w.gameOverAt > 800) this.controller.startGame();
      return;
    }

    if (py >= UI_Y) {
      if (w.selected) {
        // bar shows big tower actions while something is selected
        const t = w.selected;
        if (inRect(px, py, uiActionRect(0))) { tryUpgrade(w, t); return; }
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
      const panel = selectedPanelRect(w.selected.x, w.selected.y);
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

    const cell = cellAt(px, py);
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
      if (w.gold < def.cost) w.addText(px, py, "Need " + def.cost + "g", "#ff6b6b");
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
    if (e.code === "KeyU" && w.selected) tryUpgrade(w, w.selected);
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
