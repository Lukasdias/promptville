import type { Street } from "./layout";
import type { Intersection } from "./traffic";

export interface CrosswalkRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

const CROSS_SPACING = 0.5;
const CROSS_WIDTH = 0.4;
const STRIPES_PER_CROSSWALK = 4;

// Draws a zebra crossing over the avenue at each junction, centered on the
// junction and spanning the full avenue width. Single direction (crossing the
// avenue only) so stripes never overlap each other — a two-direction corner
// layout doesn't fit the short grid-street segments.
export function buildCrosswalks(intersections: Intersection[], streets: Street[]): CrosswalkRect[] {
  const stripes: CrosswalkRect[] = [];
  for (const it of intersections) {
    const avenue = streets.find((s) => s.width >= s.depth && Math.abs(s.z - it.z) < 0.01);
    if (!avenue) continue;
    for (let i = -1; i <= 2; i++) {
      stripes.push({ x: it.x + i * CROSS_SPACING - 0.15, z: it.z, w: CROSS_WIDTH, d: avenue.depth });
    }
  }
  return stripes;
}