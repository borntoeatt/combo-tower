import { BALANCE } from "../config/balance";
import { goodSpots } from "../config/path";
import { TOWER_TYPES, TYPE_ORDER } from "../config/towers";
import { buildTower, tryUpgrade, upgradeCost } from "./economy";
import type { World } from "./world";

/**
 * Attract-mode pilot: builds a semi-random defense behind the menu
 * so the title screen always has a battle raging on it.
 */
export function stepDemoAi(world: World, dt: number): void {
  world.aiTimer -= dt;
  world.gold += BALANCE.demoGoldTrickle * dt;
  if (world.aiTimer > 0) return;
  world.aiTimer = world.rng.range(0.5, 1.0);

  if (world.towers.length < 22) {
    const type = world.rng.pick(TYPE_ORDER);
    if (world.gold >= TOWER_TYPES[type].cost) {
      for (let tries = 0; tries < 8; tries++) {
        const [c, r] = world.rng.pick(goodSpots);
        if (buildTower(world, type, c, r)) break;
      }
    }
  } else {
    const t = world.rng.pick(world.towers);
    if (t.level < BALANCE.maxTowerLevel && world.gold >= upgradeCost(t)) {
      tryUpgrade(world, t, world.rng.next() < 0.5 ? 0 : 1);
    }
  }
}
