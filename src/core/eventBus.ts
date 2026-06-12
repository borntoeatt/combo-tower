/**
 * Minimal strongly-typed publish/subscribe bus.
 * Decouples game systems from presentation concerns (audio, banners,
 * screen shake) — systems emit domain events, listeners react.
 */
export type SfxKind =
  | "shoot" | "rail" | "zap" | "boom" | "hit" | "leak"
  | "clear" | "build" | "upgrade" | "sell" | "warn";

export interface EventMap {
  sfx: SfxKind;
  bannerShown: { text: string; sub: string | null; color: string };
  waveStarted: { wave: number; boss: boolean };
  waveCleared: { wave: number; bonus: number };
  enemyKilled: { type: string; boss: boolean; reward: number };
  enemyLeaked: { boss: boolean };
  gameOver: { score: number; wave: number };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof EventMap, Set<Handler<never>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => set.delete(handler as Handler<never>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) (handler as Handler<EventMap[K]>)(payload);
  }
}
