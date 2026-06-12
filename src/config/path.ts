import { CELL, COLS, ROWS } from "./balance";

/** The creep route, expressed in grid coordinates. */
export const WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [-1, 3], [4, 3], [4, 13], [9, 13], [9, 6], [14, 6], [14, 13], [19, 13], [19, 3], [24, 3],
];

/** Grid cells covered by the path (blocked for building). */
export const pathCells: ReadonlySet<string> = (() => {
  const cells = new Set<string>();
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const [sx, sy] = WAYPOINTS[i]!;
    const [x1, y1] = WAYPOINTS[i + 1]!;
    const dx = Math.sign(x1 - sx), dy = Math.sign(y1 - sy);
    let x = sx, y = sy;
    while (true) {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) cells.add(x + "," + y);
      if (x === x1 && y === y1) break;
      x += dx; y += dy;
    }
  }
  return cells;
})();

/** Waypoints in pixel space (cell centers). */
export const WP: ReadonlyArray<readonly [number, number]> =
  WAYPOINTS.map(([c, r]) => [c * CELL + CELL / 2, r * CELL + CELL / 2] as const);

/** Cumulative walking distance at each waypoint. */
export const wpDist: ReadonlyArray<number> = (() => {
  const d = [0];
  for (let i = 1; i < WP.length; i++) {
    const [ax, ay] = WP[i - 1]!;
    const [bx, by] = WP[i]!;
    d[i] = d[i - 1]! + Math.hypot(bx - ax, by - ay);
  }
  return d;
})();

export function distAtWaypoint(i: number): number {
  return wpDist[Math.min(i, wpDist.length - 1)]!;
}

/** Buildable cells adjacent to the path — candidate spots for the demo AI. */
export const goodSpots: ReadonlyArray<readonly [number, number]> = (() => {
  const spots: Array<readonly [number, number]> = [];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (pathCells.has(c + "," + r)) continue;
      if (neighbors.some(([a, b]) => pathCells.has((c + a!) + "," + (r + b!)))) {
        spots.push([c, r] as const);
      }
    }
  }
  return spots;
})();
