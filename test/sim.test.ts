import { describe, expect, it } from "vitest";
import { EventBus } from "../src/core/eventBus";
import { Rng } from "../src/core/rng";
import { BestScoreRepository } from "../src/core/storage";
import { GameController } from "../src/game/controller";
import { buildTower, sellTower, towerStats, tryUpgrade } from "../src/game/economy";
import { World } from "../src/game/world";
import { Renderer } from "../src/render/renderer";
import type { PointerState } from "../src/render/renderer";
import { makeStrictCtx, makeStubCanvas } from "./strictCanvas";
import type { TowerTypeId } from "../src/config/towers";
import { waveComposition } from "../src/game/waves";

const DT = 1 / 60;
const POINTER: PointerState = { x: -100, y: -100, hoverBtn: null };

function makeGame(seed: number) {
  const world = new World(new EventBus(), new Rng(seed));
  const store = new Map<string, string>();
  const controller = new GameController(
    world,
    new BestScoreRepository({
      get: k => store.get(k) ?? null,
      set: (k, v) => void store.set(k, v),
    }),
    () => world.time * 1000,
  );
  const renderer = new Renderer(makeStrictCtx(), () => makeStubCanvas(), 2);
  return { world, controller, renderer };
}

describe("Rng", () => {
  it("is deterministic per seed", () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe("wave composition", () => {
  it("introduces enemy breeds on schedule", () => {
    expect(waveComposition(1)).not.toContain("runner");
    expect(waveComposition(3)).toContain("runner");
    expect(waveComposition(6)).toContain("tank");
    expect(waveComposition(9)).toContain("splitter");
  });
  it("makes every 5th wave a boss wave", () => {
    expect(waveComposition(5)).toContain("boss");
    expect(waveComposition(10)).toContain("boss");
    expect(waveComposition(4)).not.toContain("boss");
  });
});

describe("economy", () => {
  it("builds, upgrades and sells with correct gold flow", () => {
    const { world, controller } = makeGame(7);
    controller.startGame();
    const before = world.gold;
    expect(buildTower(world, "gunner", 2, 2)).toBe(true);
    expect(world.gold).toBe(before - 50);
    expect(buildTower(world, "gunner", 2, 2)).toBe(false); // occupied

    const t = world.towers[0]!;
    world.gold = 1000;
    const dmgBefore = towerStats(t).dmg;
    expect(tryUpgrade(world, t)).toBe(true);
    expect(towerStats(t).dmg).toBeGreaterThan(dmgBefore);

    const goldBefore = world.gold;
    sellTower(world, t);
    expect(world.gold).toBe(goldBefore + Math.round(t.spent * 0.7));
    expect(world.towers).toHaveLength(0);
  });

  it("refuses to build on the path", () => {
    const { world, controller } = makeGame(7);
    controller.startGame();
    expect(buildTower(world, "gunner", 4, 5)).toBe(false); // path column
  });
});

describe("attract-mode demo", () => {
  it("plays itself: builds towers and fights waves, rendering every frame", () => {
    const { world, controller, renderer } = makeGame(1234);
    controller.startDemo();
    renderer.render(world, POINTER); // menu frame before anything moves
    for (let i = 0; i < 60 * 90; i++) {
      controller.update(DT);
      if (i % 7 === 0) renderer.render(world, POINTER);
    }
    expect(world.state).toBe("menu");
    expect(world.towers.length).toBeGreaterThan(0);
    expect(world.wave).toBeGreaterThan(0);
    expect(world.kills).toBeGreaterThan(0);
  });
});

describe("full game simulation", () => {
  it("survives a long bot-played game exercising every mechanic", () => {
    const { world, controller, renderer } = makeGame(99);
    controller.startGame();

    const spots: Array<[number, number]> = [
      [2, 2], [5, 4], [3, 4], [5, 2], [8, 12], [10, 12], [8, 5], [10, 5],
      [13, 7], [15, 7], [13, 12], [15, 12], [18, 4], [20, 4], [18, 2],
    ];
    const types: TowerTypeId[] = ["gunner", "frost", "cannon", "venom", "tesla", "sniper"];
    let si = 0;
    let upgraded = false, sold = false;
    let sawSplit = false, sawBoss = false, sawTesla = false, sawPoison = false, sawSlowmo = false;

    for (let i = 0; i < 60 * 900 && world.state === "playing"; i++) {
      controller.update(DT);
      if (i % 11 === 0) renderer.render(world, POINTER);
      if (si < spots.length && world.gold >= 150) {
        const [c, r] = spots[si]!;
        if (buildTower(world, types[si % types.length]!, c, r)) si++;
      } else if (world.gold >= 300) {
        const t = world.towers.find(t => t.level < 4);
        if (t) upgraded = tryUpgrade(world, t) || upgraded;
      }
      if (!sold && world.towers.length > 8 && i > 60 * 90) {
        sellTower(world, world.towers[world.towers.length - 1]!);
        sold = true;
      }
      sawSplit ||= world.enemies.some(e => e.type === "mini");
      sawBoss ||= world.enemies.some(e => e.boss);
      sawTesla ||= world.beams.some(b => b.jagged);
      sawPoison ||= world.enemies.some(e => e.poisonT > 0);
      sawSlowmo ||= world.slowmoT > 0;
    }

    expect(world.state).toBe("gameover");
    expect(world.wave).toBeGreaterThanOrEqual(10);
    expect(world.kills).toBeGreaterThan(100);
    expect(upgraded).toBe(true);
    expect(sold).toBe(true);
    expect(sawSplit).toBe(true);
    expect(sawBoss).toBe(true);
    expect(sawTesla).toBe(true);
    expect(sawPoison).toBe(true);
    expect(sawSlowmo).toBe(true);

    renderer.render(world, POINTER); // game-over frame
    expect(world.best).toBe(world.score);

    // restart works
    controller.startGame();
    for (let i = 0; i < 600; i++) controller.update(DT);
    expect(world.state).toBe("playing");
    expect(world.wave).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed seed", () => {
    const run = (seed: number) => {
      const { world, controller } = makeGame(seed);
      controller.startGame();
      buildTower(world, "gunner", 2, 2);
      buildTower(world, "cannon", 5, 4);
      for (let i = 0; i < 60 * 60; i++) controller.update(DT);
      return { gold: world.gold, kills: world.kills, lives: world.lives, wave: world.wave };
    };
    expect(run(555)).toEqual(run(555));
  });
});
