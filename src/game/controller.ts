import { BALANCE } from "../config/balance";
import { BestScoreRepository } from "../core/storage";
import { processDeaths, stepBullets, stepTowers } from "./combat";
import { stepDemoAi } from "./demoAi";
import { stepEffects } from "./effects";
import { stepEnemies } from "./movement";
import { stepWaves } from "./waves";
import type { World } from "./world";

/**
 * Orchestrates the per-frame system pipeline and the
 * menu → playing → gameover state machine.
 */
export class GameController {
  constructor(
    private world: World,
    private bestScores: BestScoreRepository,
    private now: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  ) {
    world.best = bestScores.load();
  }

  startDemo(): void {
    const w = this.world;
    w.reset();
    w.isDemo = true;
    w.interTimer = 1.2;
    w.gold = BALANCE.demoStartingGold;
  }

  startGame(): void {
    const w = this.world;
    w.reset();
    w.isDemo = false;
    w.state = "playing";
    w.showBanner("WAVE 1 INCOMING", "build your line", "#7bed9f");
    w.bus.emit("sfx", "build");
  }

  backToMenuDemo(): void {
    this.world.state = "menu";
    this.startDemo();
  }

  /** One fixed-ish simulation step. */
  update(dt: number): void {
    const w = this.world;
    w.time += dt;
    w.shake = Math.max(0, w.shake - dt * 30);
    w.bossWarnT = Math.max(0, w.bossWarnT - dt);
    w.damageFlash = Math.max(0, w.damageFlash - dt * 2.2);
    if (w.banner) {
      w.banner.t -= dt;
      if (w.banner.t <= 0) w.banner = null;
    }

    if (w.isDemo) stepDemoAi(w, dt);

    stepWaves(w, dt);
    stepEnemies(w, dt);
    stepTowers(w, dt);
    stepBullets(w, dt);
    processDeaths(w);

    if (w.lives <= 0) {
      if (w.state === "playing") this.endGame();
      else if (w.isDemo) this.startDemo();
    }
    if (w.isDemo && w.wave > 14) this.startDemo();

    stepEffects(w, dt);
  }

  private endGame(): void {
    const w = this.world;
    w.state = "gameover";
    w.gameOverAt = this.now();
    w.slowmoT = 1.4;
    if (w.score > w.best) {
      w.best = w.score;
      this.bestScores.save(w.best);
    }
    w.bus.emit("gameOver", { score: w.score, wave: w.wave });
  }
}
