import { AudioEngine } from "./audio/audio";
import { H, W } from "./config/balance";
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
canvas.width = W * dpr;
canvas.height = H * dpr;

// scale the canvas down to fit small screens (phones); input maps
// through getBoundingClientRect, so coordinates stay correct.
// visualViewport tracks the area iOS/Android browser chrome leaves us.
function fitCanvas(): void {
  const vv = window.visualViewport;
  const vw = vv?.width ?? window.innerWidth;
  const vh = vv?.height ?? window.innerHeight;
  const scale = Math.min(1, vw / W, vh / H);
  canvas.style.width = Math.round(W * scale) + "px";
  canvas.style.height = Math.round(H * scale) + "px";
}
fitCanvas();
addEventListener("resize", fitCanvas);
addEventListener("orientationchange", fitCanvas);
window.visualViewport?.addEventListener("resize", fitCanvas);
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2D canvas not supported");
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
