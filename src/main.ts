import { AudioEngine } from "./audio/audio";
import { W } from "./config/balance";
import { canvasH, setPortraitLayout } from "./render/viewport";
import { EventBus } from "./core/eventBus";
import { Rng } from "./core/rng";
import { BestScoreRepository, createStore } from "./core/storage";
import { DebugOverlay } from "./debug";
import { GameController } from "./game/controller";
import { World } from "./game/world";
import { InputController } from "./input/input";
import { Renderer } from "./render/renderer";

// ---------- composition root ----------
const canvas = document.getElementById("game") as HTMLCanvasElement;
// cap at 2: 3x backing stores burn fill-rate for no visible gain
const dpr = Math.min(2, window.devicePixelRatio || 1);
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2D canvas not supported");

// orientation-aware canvas: portrait phones get a taller two-row UI
// bar; the canvas then scales down to fit the visual viewport (the
// area browser chrome actually leaves us). Input maps through
// getBoundingClientRect, so coordinates stay correct at any scale.
function applyLayout(): void {
  const vv = window.visualViewport;
  const vw = vv?.width ?? window.innerWidth;
  const vh = vv?.height ?? window.innerHeight;
  setPortraitLayout(vh > vw && vw < 900);
  const h = canvasH();
  const bw = W * dpr, bh = h * dpr;
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scale = Math.min(1, vw / W, vh / h);
  canvas.style.width = Math.round(W * scale) + "px";
  canvas.style.height = Math.round(h * scale) + "px";
}
applyLayout();
addEventListener("resize", applyLayout);
addEventListener("orientationchange", applyLayout);
window.visualViewport?.addEventListener("resize", applyLayout);

const bus = new EventBus();
const world = new World(bus, new Rng());
const controller = new GameController(world, new BestScoreRepository(createStore()));
const renderer = new Renderer(ctx, () => document.createElement("canvas"), dpr);
const audioEngine = new AudioEngine(world, bus);
const input = new InputController(canvas, world, controller, () => audioEngine.unlock());
const debug = new DebugOverlay();

// console access for debugging — pairs with the ` overlay
declare global {
  interface Window {
    __game?: { world: World; controller: GameController; input: InputController };
  }
}
window.__game = { world, controller, input };

// installable + offline after first visit (production only — the dev
// server must never be cached)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}

// haptics on phones: a thump when a creep leaks, a pattern on game over
const vibrate = (pattern: number | number[]): void => {
  if (!world.isDemo && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
};
bus.on("enemyLeaked", ({ boss }) => vibrate(boss ? [60, 40, 60] : 35));
bus.on("gameOver", () => vibrate([120, 60, 120]));

controller.startDemo();

// ---------- main loop ----------
let lastT = performance.now();
function frame(now: number): void {
  const rawDt = now - lastT;
  lastT = now;
  debug.recordFrame(rawDt);
  let dt = Math.min(0.033, rawDt / 1000);
  if (world.slowmoT > 0) {
    world.slowmoT -= dt;
    dt *= 0.3; // kill-cam
  }
  if (world.state === "menu") {
    controller.update(dt);
  } else if (world.state === "playing" && !world.paused) {
    for (let i = 0; i < world.gameSpeed; i++) controller.update(dt);
  }
  audioEngine.tick();
  renderer.render(world, input.pointer);
  debug.draw(ctx!, world);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
