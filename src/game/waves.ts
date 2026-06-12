import { BALANCE, DIFFICULTIES, W } from "../config/balance";
import { ENEMY_TYPES, type EnemyTypeId } from "../config/enemies";
import type { EnemySpec } from "./types";
import type { World } from "./world";

export function waveComposition(n: number): EnemyTypeId[] {
  const comp: EnemyTypeId[] = [];
  const push = (type: EnemyTypeId, count: number) => {
    for (let i = 0; i < count; i++) comp.push(type);
  };
  if (n % BALANCE.bossEvery === 0) {
    push("grunt", 4 + n);
    push("boss", 1 + Math.floor(n / 25));
  } else {
    push("grunt", 6 + n);
    if (n >= 3) push("runner", 2 + Math.floor(n * 0.8));
    if (n >= 5) push("tank", 1 + Math.floor(n / 4));
    if (n >= 7) push("regen", 1 + Math.floor(n / 5));
    if (n >= 9) push("splitter", 1 + Math.floor(n / 6));
    if (n >= 11) push("healer", 1 + Math.floor(n / 9));
    if (n >= 13) push("wasp", 2 + Math.floor(n / 6));
  }
  return comp;
}

export function buildWave(world: World, n: number): EnemySpec[] {
  const hpGrowth = DIFFICULTIES[world.difficulty].hpGrowth;
  const baseHp = BALANCE.baseHp * Math.pow(hpGrowth, n - 1);
  const baseSpeed = Math.min(BALANCE.maxSpeed, BALANCE.baseSpeed + n * BALANCE.speedPerWave);
  const baseReward = BALANCE.baseReward + n * BALANCE.rewardPerWave;
  const specs = waveComposition(n).map((type): EnemySpec => {
    const d = ENEMY_TYPES[type];
    return {
      type,
      hp: Math.round(baseHp * d.hpM),
      speed: baseSpeed * d.spdM,
      reward: Math.max(1, Math.round(baseReward * d.reward)),
      r: d.r,
      armor: d.armor,
      regen: d.regen ?? 0,
      splits: d.splits ?? 0,
      boss: type === "boss",
      flies: d.flies ?? false,
    };
  });
  return world.rng.shuffle(specs);
}

export function sendWave(world: World, early: boolean): void {
  world.wave++;
  world.waveQueue = buildWave(world, world.wave);
  world.waveTotal = world.waveQueue.length;
  world.waveLeaks = 0;
  world.spawnTimer = 0;
  world.waveActive = true;
  const isBossWave = world.wave % BALANCE.bossEvery === 0;
  world.bus.emit("waveStarted", { wave: world.wave, boss: isBossWave });
  if (!world.isDemo) {
    if (isBossWave) {
      world.bossWarnT = 2.2;
      world.showBanner("⚠ BOSS INCOMING ⚠", "wave " + world.wave, "#ff6b6b");
      world.bus.emit("sfx", "warn");
    } else if (world.wave > 1) {
      world.showBanner("WAVE " + world.wave, null, "#9ad0ff");
    }
  }
  if (early && world.wave > 1) {
    const bonus = BALANCE.earlyBonusBase + world.wave * BALANCE.earlyBonusPerWave;
    world.gold += bonus;
    world.addText(W / 2, 120, "EARLY BONUS +" + bonus + "g", "#ffd700", 15);
  }
}

/** Spawning, wave-clear detection, inter-wave countdown. */
export function stepWaves(world: World, dt: number): void {
  if (world.waveActive) {
    if (world.waveQueue.length > 0) {
      world.spawnTimer -= dt;
      if (world.spawnTimer <= 0) {
        const spec = world.waveQueue.shift()!;
        world.spawnEnemy(spec);
        world.spawnTimer = spec.boss ? BALANCE.bossSpawnInterval : BALANCE.spawnInterval;
      }
    } else if (world.enemies.length === 0) {
      world.waveActive = false;
      world.interTimer = BALANCE.interWaveDelay;
      const interest = Math.min(BALANCE.interestCap, Math.floor(world.gold * BALANCE.interestRate));
      const perfect = world.waveLeaks === 0
        ? BALANCE.perfectBonusBase + world.wave * BALANCE.perfectBonusPerWave
        : 0;
      const bonus = BALANCE.waveClearBase + world.wave * BALANCE.waveClearPerWave + interest + perfect;
      world.gold += bonus;
      world.score += world.wave * 60 + (perfect ? world.wave * 40 : 0);
      world.bus.emit("waveCleared", { wave: world.wave, bonus });
      if (!world.isDemo) {
        world.addText(
          W / 2, 130,
          "WAVE " + world.wave + " CLEAR  +" + bonus + "g" +
            (interest ? " (incl. " + interest + " interest)" : ""),
          "#7bed9f", 15,
        );
        if (perfect) world.addText(W / 2, 155, "PERFECT — no leaks  +" + perfect + "g", "#ffd700", 13);
        world.bus.emit("sfx", "clear");
      }
      // beating the victory wave wins the run; play continues endless
      if (!world.won && world.wave >= BALANCE.victoryWave && !world.isDemo) {
        world.won = true;
        world.score += 2000;
        world.showBanner("★ VICTORY ★", "endless mode — how far can you go?", "#ffd700");
        world.bus.emit("sfx", "clear");
      }
    }
  } else {
    world.interTimer -= dt;
    if (world.interTimer <= 0) sendWave(world, false);
  }
}
