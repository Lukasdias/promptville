import type { Street } from "./layout";

// Low raised sidewalk: a brick walkway with a curb edge along the street side.
// Heights are constants so a sidewalk reads as a curb step, never a wall.
export const SIDEWALK_WIDTH = 0.7;
export const CURB_WIDTH = 0.25;
export const SIDEWALK_HEIGHT = 0.13;
export const CURB_HEIGHT = 0.16;

export interface SideSeg {
  x: number;
  z: number;
  w: number;
  d: number;
  kind: "walk" | "curb";
}

// Returns the sub-intervals of [lo, hi] that are NOT covered by any gap span.
function freeIntervals(lo: number, hi: number, spans: [number, number][]): [number, number][] {
  const gaps = spans
    .filter(([a, b]) => b > lo && a < hi)
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  let cur = lo;
  for (const [a, b] of gaps) {
    const ga = Math.max(a, lo);
    const gb = Math.min(b, hi);
    if (ga > cur) out.push([cur, ga]);
    cur = Math.max(cur, gb);
  }
  if (cur < hi) out.push([cur, hi]);
  return out;
}

// Sidewalk + curb box segments along both flanks of every street, split where a
// crossing street cuts through so sidewalk never spans a junction. The gap is
// widened by the crossing street's own sidewalk band on both sides, otherwise a
// perpendicular street's walk strip overlaps this one at the corner — two
// coplanar boxes at the same height z-fight (worst when zoomed out).
export function sidewalkSegments(streets: Street[]): SideSeg[] {
  const segs: SideSeg[] = [];

  const flankBand = CURB_WIDTH + SIDEWALK_WIDTH;
  for (const s of streets) {
    const horizontal = s.width >= s.depth;
    const roadHalf = horizontal ? s.depth / 2 : s.width / 2;
    const lengthHalf = horizontal ? s.width / 2 : s.depth / 2;
    const crossers = streets.filter((o) => (horizontal ? o.width < o.depth : o.width >= o.depth));
    // Each crossing road's span, widened by BOTH the road's own flank band so
    // ww exclude the crossing sidewalk strip on each side of its road.
    const spans = crossers.map<[number, number]>((o) => {
      const crossRoadHalf = (horizontal ? o.width : o.depth) / 2;
      return horizontal
        ? [o.x - crossRoadHalf - flankBand, o.x + crossRoadHalf + flankBand]
        : [o.z - crossRoadHalf - flankBand, o.z + crossRoadHalf + flankBand];
    });
    const intervals = freeIntervals(-lengthHalf, lengthHalf, spans);

    for (const sign of [-1, 1]) {
      const curbOff = roadHalf + CURB_WIDTH / 2;
      const walkOff = roadHalf + CURB_WIDTH + SIDEWALK_WIDTH / 2;
      for (const [a, b] of intervals) {
        const mid = (a + b) / 2;
        const len = b - a;
        if (horizontal) {
          segs.push({ x: s.x + mid, z: s.z + sign * curbOff, w: len, d: CURB_WIDTH, kind: "curb" });
          segs.push({ x: s.x + mid, z: s.z + sign * walkOff, w: len, d: SIDEWALK_WIDTH, kind: "walk" });
        } else {
          segs.push({ x: s.x + sign * curbOff, z: s.z + mid, w: CURB_WIDTH, d: len, kind: "curb" });
          segs.push({ x: s.x + sign * walkOff, z: s.z + mid, w: SIDEWALK_WIDTH, d: len, kind: "walk" });
        }
      }
    }
  }

  return segs;
}
