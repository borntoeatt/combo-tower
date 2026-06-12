# Grid Defense

A thoroughly overengineered HTML5 canvas tower defense. Six tower classes
with **max-level specializations**, seven creep breeds plus bosses
(including aura **healers** and path-ignoring **flying wasps**), four
targeting modes, an interest economy with **perfect-wave bonuses**, tower
**veteran ranks** earned per kill, three difficulties with a victory-then-
endless arc, attract-mode demo battles, additive-bloom rendering, slow-mo
kill cams, and a procedural synth soundtrack.

Installable as a **PWA** (offline after first visit), phone-friendly with
a portrait layout, pinch-zoom camera, two-tap building and haptics.
Play it: https://borntoeatt.github.io/grid-defense/

**TypeScript (strict) · Vite · Vitest · zero runtime dependencies**

## Quick start

```sh
npm install
npm run dev        # dev server with HMR at http://localhost:5173
npm test           # headless simulation test suite
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the production build locally
```

## Architecture

```
src/
├── core/          # framework-agnostic plumbing
│   ├── eventBus.ts    # strongly-typed pub/sub (decouples game ⇄ audio/UI)
│   ├── rng.ts         # seeded mulberry32 — fully deterministic gameplay
│   └── storage.ts     # persistence abstraction w/ in-memory fallback
├── config/        # pure data: all balance lives here, no logic
│   ├── balance.ts     # every tuning knob in one place
│   ├── towers.ts      # tower definitions
│   ├── enemies.ts     # creep definitions
│   ├── acts.ts        # per-act visual palettes
│   └── path.ts        # waypoints + derived geometry (computed once)
├── game/          # simulation — runs headless, no DOM required
│   ├── world.ts       # single source of truth for mutable state
│   ├── controller.ts  # state machine + per-frame system pipeline
│   ├── waves.ts       # spawning, composition, wave-clear economy
│   ├── movement.ts    # path walking, status effects, leaks
│   ├── combat.ts      # targeting, firing, projectiles, deaths
│   ├── economy.ts     # build/upgrade/sell rules
│   ├── effects.ts     # particles/rings/smoke bookkeeping
│   └── demoAi.ts      # attract-mode pilot for the title screen
├── render/        # presentation — injected ctx, testable with stubs
│   ├── renderer.ts    # frame composition incl. additive glow pass
│   ├── background.ts  # pre-rendered static field
│   ├── sprites.ts     # towers, enemies, portals
│   ├── hud.ts         # UI bar, panels, menu, game over
│   └── layout.ts      # UI hit-testing geometry (shared with input)
├── audio/         # WebAudio synth: event-driven sfx + generative music
├── input/         # DOM events → game intents
├── debug.ts       # FPS/entity overlay (toggle with `)
└── main.ts        # composition root — the only file that touches the DOM
```

Design notes:

- **Determinism**: all gameplay randomness goes through one seeded `Rng`,
  so a full game can be replayed bit-for-bit (and is, in the tests).
- **Dependency injection**: the renderer receives its 2D context and the
  audio engine subscribes to events, so the entire game — including every
  render path — runs headless under Vitest with a *stricter-than-browser*
  canvas stub that throws on `NaN` colors.
- **Data-driven**: adding a tower or enemy type is a config entry, not code.

## Controls

| Input | Action |
|---|---|
| Click button / `1`–`6` | select tower type |
| Click open ground | build |
| Click tower → `U` / `X` / `T` | upgrade / sell / cycle targeting |
| `Space` | send next wave early (+gold bonus) |
| `F` / `P` / `M` | 2× speed / pause / mute |
| `` ` `` | debug overlay |

## Deploying to GitHub Pages

The build outputs to `docs/` with relative asset paths, so the zero-CI
path is:

1. `npm run build`
2. Commit and push (including `docs/`)
3. Repo **Settings → Pages → Deploy from a branch → `main` → `/docs`**

Every future deploy is just `npm run build` + push.
