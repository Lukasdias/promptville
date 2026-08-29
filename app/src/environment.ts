import type { PlacedBlock, Street } from "./layout";
import { ROAD_WIDTH } from "./layout";
import { CURB_WIDTH, SIDEWALK_WIDTH } from "./sidewalk";
import { isClearSpot } from "./placement";
import { mulberry32 } from "./rand";

// Deterministic environment blueprint: computes WHERE trees, street lamps, and
// free-lawn props go, derived from the city's real 2D geometry (streets +
// sidewalks) rather than blind random scatter. Mirrors the philosophy of
// layout.ts / sidewalk.ts — pure, seeded, testable.
//
// The city is dense (blocks fill most of the extent) and houses are inset from
// the lot edge, so there are two distinct placement zones:
//   - Street flank lines (trees + lamps) — derived from street/sidewalk geometry.
//   - Interior lot grass (bushes + flowers) — inside blocks, clear of houses.

export interface EnvItem {
  x: number;
  z: number;
  s: number; // scale for per-item variety (trees), else 1
}

export interface EnvSeedItem {
  x: number;
  z: number;
}

export interface EnvironmentLayout {
  trees: EnvItem[];
  lamps: EnvSeedItem[];
  bushes: EnvItem[];
  flowers: EnvItem[];
}

// Deterministic even sub-sampling: pick `count` items spread across the array by
// taking every k-th; when the array is smaller than count, return as-is.
function sampleEven<T>(arr: T[], count: number, rand: () => number): T[] {
  if (arr.length === 0 || count <= 0) return [];
  if (arr.length <= count) return arr;
  // Prefer a regular stride (even placement) with a seeded jittered start.
  const start = Math.floor(rand() * count);
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    out.push(arr[Math.min(arr.length - 1, start + i * Math.floor(arr.length / count))]!);
  }
  return out;
}

// Tile the lot interiors with candidate points on a jittered grid, then reject
// any that fall on a house slot (with a small pad). Houses are inset from the
// lot edge, so the outer ring of each lot is always candidate ground.
function houseBlockers(block: PlacedBlock): { x: number; z: number; pad: number }[] {
  return block.houses.map((h) => ({ x: h.x, z: h.z, pad: 1.6 }));
}

function lotInteriorSpots(
  blocks: PlacedBlock[],
  seed: number,
): { x: number; z: number }[] {
  const rand = mulberry32(seed);
  const out: { x: number; z: number }[] = [];
  for (const b of blocks) {
    if (b.kind === "plaza") continue;
    const hw = b.width / 2;
    const hd = b.depth / 2;
    const blockers = houseBlockers(b);
    const grid = 5;
    for (let gx = 0; gx < grid; gx++) {
      for (let gz = 0; gz < grid; gz++) {
        const x = b.x - hw + ((gx + 0.5) / grid) * b.width + (rand() - 0.5) * 2;
        const z = b.z - hd + ((gz + 0.5) / grid) * b.depth + (rand() - 0.5) * 2;
        const hitHouse = blockers.some((h) => (x - h.x) ** 2 + (z - h.z) ** 2 < h.pad * h.pad);
        if (hitHouse) continue;
        out.push({ x, z });
      }
    }
  }
  return out;
}

// Deterministic street-flank placements: march each street along its length on
// both flanks, skipping the gaps where a crossing street cuts through (so nothing
// sits in the middle of a junction). Returns positions in a stable order.
function streetFlank(
  streets: Street[],
  offset: number,
  cadence: number,
  rand: () => number,
): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (const s of streets) {
    const horizontal = s.width >= s.depth;
    const roadHalf = horizontal ? s.depth / 2 : s.width / 2;
    const lengthHalf = horizontal ? s.width / 2 : s.depth / 2;
    const crossers = streets.filter((o) => (horizontal ? o.width < o.depth : o.width >= o.depth));
    const gaps = crossers
      .map<[number, number]>((o) =>
        horizontal ? [o.x - o.width / 2, o.x + o.width / 2] : [o.z - o.depth / 2, o.z + o.depth / 2],
      )
      .filter(([a, b]) => b > -lengthHalf && a < lengthHalf);

    for (const sign of [-1, 1]) {
      const line = roadHalf + offset;
      for (let t = -lengthHalf + cadence / 2; t <= lengthHalf - cadence / 2; t += cadence) {
        const withinGap = gaps.some(([a, b]) => t > a && t < b);
        if (withinGap) continue;
        // small per-item jitter so a row is not perfectly robotic
        const j = (rand() - 0.5) * 0.6;
        if (horizontal) out.push({ x: s.x + t + j, z: s.z + sign * line });
        else out.push({ x: s.x + sign * line, z: s.z + t + j });
      }
    }
  }
  return out;
}

// Full deterministic environment blueprint for the town, bounded to the config
// counts via even sub-sampling of the geometry-derived candidates.
export function environmentLayout(
  blocks: PlacedBlock[],
  streets: Street[],
  counts: { trees: number; lamps: number; bushes: number; flowers: number },
  seed?: number,
): EnvironmentLayout {
  const rand = mulberry32(seed ?? 1337);

  const treePositions = streetFlank(streets, ROAD_WIDTH / 2 + CURB_WIDTH + SIDEWALK_WIDTH, 8, rand);
  const trees: EnvItem[] = sampleEven(treePositions, counts.trees, rand).map((p) => ({
    x: p.x,
    z: p.z,
    s: 0.72 + rand() * 0.5,
  }));

  const lampPositions = streetFlank(streets, ROAD_WIDTH / 2 + CURB_WIDTH + 0.35, 26, rand);
  const lamps: EnvSeedItem[] = sampleEven(lampPositions, counts.lamps, rand).map((p) => ({
    x: p.x,
    z: p.z,
  }));

  const lawn = lotInteriorSpots(blocks, (seed ?? 1337) + 1);
  const bushes: EnvItem[] = [];
  const flowers: EnvItem[] = [];
  let fill = 0;
  const randomSpot = (): { x: number; z: number } | null => {
    if (lawn.length === 0) return null;
    // Bounded retries so we never spin forever when lawn is nearly exhausted.
    for (let k = 0; k < 32; k++) {
      const p = lawn[(rand() * lawn.length) | 0];
      if (p) return p;
    }
    return null;
  };
  const spots = sampleEven(lawn, counts.bushes + counts.flowers, rand);
  for (let i = 0; i < spots.length; i++) {
    const p = spots[i]!;
    const isBush = i % 2 === 0;
    if (isBush && bushes.length < counts.bushes) bushes.push({ x: p.x, z: p.z, s: 0.8 + rand() * 0.5 });
    else if (!isBush && flowers.length < counts.flowers) flowers.push({ x: p.x, z: p.z, s: 1 });
  }
  while (bushes.length < counts.bushes && fill < 64) {
    fill++;
    const p = randomSpot();
    if (p) bushes.push({ x: p.x, z: p.z, s: 0.9 + rand() * 0.4 });
  }
  while (flowers.length < counts.flowers && fill < 128) {
    fill++;
    const p = randomSpot();
    if (p) flowers.push({ x: p.x, z: p.z, s: 1 });
  }

  return { trees, lamps, bushes, flowers };
}
