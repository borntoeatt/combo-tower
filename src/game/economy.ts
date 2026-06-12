import { BALANCE, CELL, COLS, FIELD_H, ROWS } from "../config/balance";
import { pathCells } from "../config/path";
import { TOWER_TYPES, type TowerTypeId } from "../config/towers";
import { burst } from "./effects";
import type { Tower, TowerStats } from "./types";
import type { World } from "./world";

export function cellAt(px: number, py: number): { c: number; r: number } | null {
  if (py >= FIELD_H || py < 0) return null;
  return { c: Math.floor(px / CELL), r: Math.floor(py / CELL) };
}

export function towerAt(world: World, c: number, r: number): Tower | null {
  return world.towers.find(t => t.c === c && t.r === r) ?? null;
}

export function canBuildAt(world: World, c: number, r: number): boolean {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS &&
    !pathCells.has(c + "," + r) && !towerAt(world, c, r);
}

export function buildTower(world: World, type: TowerTypeId, c: number, r: number): boolean {
  const def = TOWER_TYPES[type];
  if (world.gold < def.cost || !canBuildAt(world, c, r)) return false;
  world.gold -= def.cost;
  const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
  world.towers.push({
    type, c, r, x, y,
    level: 1, cooldown: 0, spent: def.cost,
    angle: world.rng.range(0, Math.PI * 2),
    recoil: 0, mode: 0, flash: 0, born: world.time,
  });
  burst(world, x, y, 12, def.color);
  world.rings.push({ x, y, r: 4, max: 30, color: def.color, t: 0.35, dur: 0.35 });
  world.bus.emit("sfx", "build");
  return true;
}

export function towerStats(t: Tower): TowerStats {
  const def = TOWER_TYPES[t.type];
  const m = 1 + (t.level - 1) * BALANCE.upgradeDmgPerLevel;
  return {
    name: def.name,
    color: def.color,
    glow: def.glow,
    dmg: def.dmg * m,
    poison: (def.poison ?? 0) * m,
    range: def.range * (1 + (t.level - 1) * BALANCE.upgradeRangePerLevel),
    rate: def.rate * (1 + (t.level - 1) * BALANCE.upgradeRatePerLevel),
    splash: def.splash ?? 0,
    slow: def.slow ?? 0,
    slowDur: def.slowDur ?? 0,
    poisonDur: def.poisonDur ?? 0,
    chain: def.chain ?? 0,
    chainRange: def.chainRange ?? 0,
    pierce: def.pierce ?? false,
  };
}

export function upgradeCost(t: Tower): number {
  return Math.round(TOWER_TYPES[t.type].cost * BALANCE.upgradeCostFactor * t.level);
}

export function tryUpgrade(world: World, t: Tower): boolean {
  if (t.level >= BALANCE.maxTowerLevel) return false;
  const cost = upgradeCost(t);
  if (world.gold < cost) {
    world.addText(t.x, t.y - 24, "Need " + cost + "g", "#ff6b6b");
    return false;
  }
  world.gold -= cost;
  t.spent += cost;
  t.level++;
  world.addText(t.x, t.y - 24, "LEVEL " + t.level, "#7bed9f");
  world.rings.push({ x: t.x, y: t.y, r: 6, max: 46, color: TOWER_TYPES[t.type].color, t: 0.4, dur: 0.4 });
  burst(world, t.x, t.y, 8, TOWER_TYPES[t.type].color);
  world.bus.emit("sfx", "upgrade");
  return true;
}

export function sellTower(world: World, t: Tower): void {
  const refund = Math.round(t.spent * BALANCE.sellRefund);
  world.gold += refund;
  world.towers = world.towers.filter(x => x !== t);
  world.addText(t.x, t.y, "+" + refund + "g", "#ffd700");
  world.selected = null;
  world.bus.emit("sfx", "sell");
}
