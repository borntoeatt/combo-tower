/** Visual "acts" — the world's palette shifts every few waves. */
export interface ActPalette {
  readonly path: string;
  readonly chevron: string;
  readonly ember: string;
  readonly tint: string;
}

export const ACTS: ReadonlyArray<ActPalette> = [
  { path: "rgba(110,150,255,0.5)",  chevron: "rgba(140,175,255,0.35)", ember: "#6e96ff", tint: "rgba(0,0,0,0)" },
  { path: "rgba(120,235,165,0.5)",  chevron: "rgba(140,255,185,0.35)", ember: "#78e08f", tint: "rgba(40,160,90,0.05)" },
  { path: "rgba(255,180,90,0.5)",   chevron: "rgba(255,200,120,0.35)", ember: "#ffb347", tint: "rgba(200,110,30,0.06)" },
  { path: "rgba(255,110,140,0.55)", chevron: "rgba(255,140,165,0.4)",  ember: "#ff6b9d", tint: "rgba(200,40,80,0.07)" },
  { path: "rgba(195,135,255,0.55)", chevron: "rgba(210,160,255,0.4)",  ember: "#c084fc", tint: "rgba(130,60,220,0.07)" },
];

export function actForWave(wave: number): ActPalette {
  return ACTS[Math.floor(Math.max(0, wave - 1) / 5) % ACTS.length]!;
}
