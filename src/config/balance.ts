/** Global layout + tuning constants. One file to rule the balance. */
export const W = 960;
export const H = 724;
export const CELL = 40;
export const COLS = 24;
export const ROWS = 16;
export const FIELD_H = ROWS * CELL;
export const UI_Y = FIELD_H;

export const BALANCE = {
  startingGold: 130,
  startingLives: 20,
  demoStartingGold: 220,
  demoGoldTrickle: 14,          // gold/sec the attract-mode AI receives
  maxTowerLevel: 4,
  upgradeDmgPerLevel: 0.45,
  upgradeRangePerLevel: 0.10,
  upgradeRatePerLevel: 0.12,
  upgradeCostFactor: 0.85,
  sellRefund: 0.7,
  interestRate: 0.06,
  interestCap: 120,
  waveClearBase: 20,
  waveClearPerWave: 3,
  earlyBonusBase: 15,
  earlyBonusPerWave: 3,
  interWaveDelay: 7,
  hpGrowth: 1.19,
  baseHp: 18,
  baseSpeed: 55,
  speedPerWave: 2.2,
  maxSpeed: 160,
  baseReward: 4,
  rewardPerWave: 0.35,
  bossEvery: 5,
  bossLivesCost: 5,
  spawnInterval: 0.55,
  bossSpawnInterval: 1.6,
  armorMinDamageFraction: 0.25, // armor can never reduce a hit below this
  splitterMiniSpeedFactor: 1.4,
  maxParticles: 450,
  veteranKillThresholds: [10, 30, 60], // kills needed for each ★ rank
  veteranDmgPerRank: 0.1,
  perfectBonusBase: 10,         // extra gold for clearing a wave with zero leaks
  perfectBonusPerWave: 2,
} as const;
