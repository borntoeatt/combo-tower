/**
 * Persistence abstraction over localStorage with an in-memory
 * fallback, so the game runs in privacy modes, sandboxed iframes,
 * and headless test environments alike.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  get(key: string): string | null { return this.map.get(key) ?? null; }
  set(key: string, value: string): void { this.map.set(key, value); }
}

class LocalStore implements KeyValueStore {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* quota / privacy mode */ }
  }
}

export function createStore(): KeyValueStore {
  try {
    if (typeof localStorage !== "undefined") return new LocalStore();
  } catch { /* SecurityError in sandboxed contexts */ }
  return new MemoryStore();
}

export class BestScoreRepository {
  private static KEY = "gridDefenseBest2";
  constructor(private store: KeyValueStore) {}

  load(): number {
    const raw = this.store.get(BestScoreRepository.KEY);
    const n = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }

  save(score: number): void {
    this.store.set(BestScoreRepository.KEY, String(score));
  }
}
