/**
 * A canvas 2D context stub that is STRICTER than a real browser:
 * it throws on NaN/undefined colors and non-finite gradient coords.
 * This is what catches "renders fine in tests, black screen on
 * GitHub Pages" bugs (we learned this the hard way).
 */
export function makeStrictCtx(): CanvasRenderingContext2D {
  const noop = () => undefined;
  const checkColor = (c: unknown): void => {
    if (typeof c !== "string" || /NaN|undefined/.test(c)) {
      throw new Error("Invalid color: " + String(c));
    }
  };
  const gradient = (...args: unknown[]) => {
    for (const v of args) {
      if (typeof v === "number" && !Number.isFinite(v)) {
        throw new Error("Non-finite gradient coordinate");
      }
    }
    return { addColorStop: (_o: number, c: string) => checkColor(c) };
  };
  return new Proxy({}, {
    get: (_t, key) => {
      if (key === "createLinearGradient" || key === "createRadialGradient") return gradient;
      if (key === "canvas") return makeStubCanvas();
      return typeof key === "string" ? noop : undefined;
    },
    set: (_t, key, value) => {
      if ((key === "fillStyle" || key === "strokeStyle" || key === "shadowColor") &&
          typeof value === "string") {
        checkColor(value);
      }
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

export function makeStubCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => makeStrictCtx(),
  } as unknown as HTMLCanvasElement;
}
