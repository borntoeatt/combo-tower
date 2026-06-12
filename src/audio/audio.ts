import type { EventBus, SfxKind } from "../core/eventBus";
import type { World } from "../game/world";

type SfxPatch = readonly [OscillatorType, number, number, number, number];

const PATCHES: Readonly<Record<SfxKind, SfxPatch>> = {
  shoot:   ["square",   880, 440, 0.05, 0.45],
  rail:    ["sawtooth", 1400, 120, 0.12, 0.63],
  zap:     ["sawtooth", 600, 1800, 0.07, 0.5],
  boom:    ["triangle", 200, 40,  0.22, 0.9],
  hit:     ["sine",     520, 260, 0.04, 0.36],
  leak:    ["sawtooth", 300, 80,  0.3, 0.8],
  clear:   ["sine",     523, 1046, 0.25, 0.72],
  build:   ["sine",     330, 660, 0.1, 0.63],
  upgrade: ["sine",     440, 880, 0.15, 0.72],
  sell:    ["sine",     660, 330, 0.1, 0.54],
  warn:    ["square",   180, 180, 0.4, 0.63],
};

const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25] as const;

/**
 * Procedural synth: one-shot sfx (driven by EventBus) plus an
 * ambient generative bass/arp loop. Created lazily on first user
 * gesture to satisfy browser autoplay policies.
 */
export class AudioEngine {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private musicNext = 0;
  private musicStep = 0;

  constructor(private world: World, bus: EventBus) {
    bus.on("sfx", kind => this.play(kind));
  }

  /** Call from a click/keydown handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.ac || typeof AudioContext === "undefined") return;
    try {
      this.ac = new AudioContext();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ac.destination);
      this.music = this.ac.createGain();
      this.music.gain.value = 0.5;
      this.music.connect(this.master);
      this.musicNext = this.ac.currentTime + 0.1;
    } catch {
      this.ac = null;
    }
  }

  private tone(
    dest: AudioNode, type: OscillatorType,
    f0: number, f1: number, t0: number, dur: number, vol: number,
  ): void {
    const ac = this.ac!;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g);
    g.connect(dest);
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  private play(kind: SfxKind): void {
    if (!this.ac || !this.master || this.world.muted || this.world.isDemo) return;
    const [type, f0, f1, dur, vol] = PATCHES[kind];
    this.tone(this.master, type, f0, f1, this.ac.currentTime, dur, vol);
  }

  /** Generative ambient loop; call once per frame. */
  tick(): void {
    if (!this.ac || !this.music || this.world.muted) return;
    while (this.musicNext < this.ac.currentTime + 0.3) {
      const step = this.musicStep++;
      const t0 = Math.max(this.musicNext, this.ac.currentTime);
      if (step % 4 === 0) {
        this.tone(this.music, "sine", 55 * (step % 16 === 0 ? 1 : 1.5), 55, t0, 0.5, 0.5);
      }
      if (Math.random() < 0.65) {
        const n = SCALE[(step * 3 + Math.floor(step / 8)) % SCALE.length]!;
        this.tone(this.music, "triangle", n, n, t0, 0.42, 0.16);
        if (Math.random() < 0.2) this.tone(this.music, "sine", n * 2, n * 2, t0 + 0.1, 0.3, 0.07);
      }
      this.musicNext += 0.25;
    }
  }
}
