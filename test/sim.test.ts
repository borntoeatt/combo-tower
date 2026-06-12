import { describe, expect, it } from "vitest";
import { EventBus } from "../src/core/eventBus";
import { Rng } from "../src/core/rng";
import { BestScoreRepository } from "../src/core/storage";
import { damage } from "../src/game/combat";
import { GameController } from "../src/game/controller";
import { buildTower, sellTower, towerStats, tryUpgrade, veteranRank } from "../src/game/economy";
import { stepEnemies } from "../src/game/movement";
import { stepWaves } from "../src/game/waves";
import { World } from "../src/game/world";
import { Renderer } from "../src/render/renderer";
import type { PointerState } from "../src/render/renderer";
import { makeStrictCtx, makeStubCanvas } from "./strictCanvas";
import type { TowerTypeId } from "../src/config/towers";
import { waveComposition } from "../src/game/waves";

const DT = 1 / 60;
const POINTER: PointerState = {
  x: -100, y: -100, hoverBtn: null, pendingCell: null,
  cam: { z: 1, cx: 480, cy: 320 },
};

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
  it("introduces healers from wave 11", () => {
    expect(waveComposition(9)).not.toContain("healer");
    expect(waveComposition(11)).toContain("healer");
  });
  it("introduces wasps from wave 13", () => {
    expect(waveComposition(12)).not.toContain("wasp");
    expect(waveComposition(13)).toContain("wasp");
  });
});

describe("difficulty", () => {
  it("scales lives and starting gold", () => {
    const { world, controller } = makeGame(2);
    world.difficulty = "hard";
    controller.startGame();
    expect(world.lives).toBe(12);
    expect(world.gold).toBe(110);
    world.difficulty = "easy";
    controller.startGame();
    expect(world.lives).toBe(30);
    expect(world.gold).toBe(160);
  });
});

describe("specializations", () => {
  it("applies the chosen branch at max level", () => {
    const { world, controller } = makeGame(4);
    controller.startGame();
    world.gold = 100000;
    buildTower(world, "tesla", 2, 2);
    const t = world.towers[0]!;
    tryUpgrade(world, t); // 2
    tryUpgrade(world, t); // 3
    const before = towerStats(t);
    expect(t.spec).toBeNull();
    tryUpgrade(world, t, 0); // Superconductor: chains +2
    expect(t.level).toBe(4);
    expect(t.spec).toBe(0);
    const after = towerStats(t);
    expect(after.chain).toBe(before.chain + 2);
    expect(after.name).toContain("Superconductor");
  });
});

describe("flying wasps", () => {
  it("cross the map in a straight line and leak a life", () => {
    const { world, controller } = makeGame(6);
    controller.startGame();
    world.waveActive = true; // hold the auto-spawner off
    world.waveQueue = [];
    world.spawnEnemy({ type: "wasp", hp: 50, speed: 200, reward: 1, r: 9, armor: 0, regen: 0, splits: 0, boss: false, flies: true });
    const livesBefore = world.lives;
    let leftPathRow = false;
    for (let i = 0; i < 60 * 8 && world.enemies.length > 0; i++) {
      controller.update(DT);
      const e = world.enemies[0];
      if (e && e.x > 300 && e.x < 700) leftPathRow ||= Math.abs(e.y - 140) < 30;
    }
    expect(world.enemies).toHaveLength(0);          // flew off and leaked
    expect(world.lives).toBe(livesBefore - 1);
    expect(leftPathRow).toBe(true);                 // stayed on the straight lane
  });
});

describe("veterancy", () => {
  it("credits kills to the firing tower and raises its damage", () => {
    const { world, controller } = makeGame(3);
    controller.startGame();
    buildTower(world, "gunner", 2, 2);
    const t = world.towers[0]!;
    const baseDmg = towerStats(t).dmg;

    world.spawnEnemy({ type: "grunt", hp: 1, speed: 0, reward: 1, r: 11, armor: 0, regen: 0, splits: 0, boss: false, flies: false });
    damage(world, world.enemies[0]!, 999, false, t);
    expect(t.kills).toBe(1);

    t.kills = 100; // past every threshold
    expect(veteranRank(t)).toBe(3);
    expect(towerStats(t).dmg).toBeCloseTo(baseDmg * 1.3);
  });

  it("does not double-credit an already dead enemy", () => {
    const { world, controller } = makeGame(3);
    controller.startGame();
    buildTower(world, "gunner", 2, 2);
    const t = world.towers[0]!;
    world.spawnEnemy({ type: "grunt", hp: 1, speed: 0, reward: 1, r: 11, armor: 0, regen: 0, splits: 0, boss: false, flies: false });
    const e = world.enemies[0]!;
    damage(world, e, 999, false, t);
    damage(world, e, 999, false, t);
    expect(t.kills).toBe(1);
  });
});

describe("healers", () => {
  it("heal wounded allies in range but not themselves", () => {
    const { world, controller } = makeGame(5);
    controller.startGame();
    world.spawnEnemy({ type: "healer", hp: 100, speed: 0, reward: 1, r: 12, armor: 0, regen: 0, splits: 0, boss: false, flies: false });
    world.spawnEnemy({ type: "grunt", hp: 100, speed: 0, reward: 1, r: 11, armor: 0, regen: 0, splits: 0, boss: false, flies: false });
    const [healer, grunt] = world.enemies as [typeof world.enemies[0], typeof world.enemies[0]];
    healer.hp = 50;
    grunt.hp = 50;
    stepEnemies(world, 1);
    expect(grunt.hp).toBeGreaterThan(50);   // mended by the aura
    expect(healer.hp).toBe(50);             // no self-heal
  });
});

describe("perfect wave bonus", () => {
  function clearWave(world: World, leaks: number): number {
    world.wave = 3;
    world.waveActive = true;
    world.waveQueue = [];
    world.enemies = [];
    world.waveLeaks = leaks;
    const before = world.gold;
    stepWaves(world, 1 / 60);
    return world.gold - before;
  }

  it("pays extra gold only when nothing leaked", () => {
    const { world: a, controller: ca } = makeGame(9);
    ca.startGame();
    const { world: b, controller: cb } = makeGame(9);
    cb.startGame();
    const perfectGain = clearWave(a, 0);
    const leakyGain = clearWave(b, 1);
    expect(perfectGain - leakyGain).toBe(10 + 3 * 2); // perfectBonusBase + wave * perWave
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

  it("renders 1000 late-game frames without throwing (strict ctx)", () => {
    const { world, controller, renderer } = makeGame(31337);
    controller.startGame();
    world.gold = 100000;
    // a dense board with every tower type, fully specialized
    const spots: Array<[TowerTypeId, number, number]> = [
      ["gunner", 2, 2], ["cannon", 5, 4], ["frost", 8, 8], ["venom", 11, 8],
      ["tesla", 13, 4], ["sniper", 16, 4], ["gunner", 3, 4], ["cannon", 10, 5],
    ];
    for (const [type, c, r] of spots) buildTower(world, type, c, r);
    for (const t of world.towers) {
      while (t.level < 4) tryUpgrade(world, t, 1);
      t.kills = 100;
    }
    world.wave = 24; // late game: healers, wasps, bosses next wave
    world.interTimer = 0.01;
    const zoomed: PointerState = {
      x: 300, y: 200, hoverBtn: null, pendingCell: { c: 1, r: 1 },
      cam: { z: 1.8, cx: 400, cy: 300 },
    };
    for (let i = 0; i < 1000; i++) {
      controller.update(DT);
      renderer.render(world, i % 2 ? POINTER : zoomed);
    }
    expect(world.wave).toBeGreaterThanOrEqual(25);
    // also render the win/gameover paths through the strict ctx
    world.won = true;
    world.state = "gameover";
    renderer.render(world, POINTER);
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
