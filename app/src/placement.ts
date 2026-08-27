import type { PlacedBlock, Street } from "./layout";

// True when (x, z) is clear of every block lot (padded) and every street.
export function isClearSpot(
  x: number,
  z: number,
  blocks: PlacedBlock[],
  streets: Street[],
  pad: number,
): boolean {
  for (const b of blocks) {
    const hw = b.width / 2 + pad;
    const hd = b.depth / 2 + pad;
    if (x > b.x - hw && x < b.x + hw && z > b.z - hd && z < b.z + hd) return false;
  }
  for (const s of streets) {
    const hw = s.width / 2 + pad;
    const hd = s.depth / 2 + pad;
    if (x > s.x - hw && x < s.x + hw && z > s.z - hd && z < s.z + hd) return false;
  }
  return true;
}

// A corner spot for the park that never overlaps a block lot.
export function pickParkSpot(
  blocks: PlacedBlock[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): { x: number; z: number } | null {
  const r = 7;
  const candidates = [
    { x: minX + 15, z: minZ + 15 },
    { x: maxX - 15, z: minZ + 15 },
    { x: minX + 15, z: maxZ - 15 },
    { x: maxX - 15, z: maxZ - 15 },
  ];
  for (const c of candidates) {
    const overlaps = blocks.some(
      (b) =>
        c.x + r > b.x - b.width / 2 &&
        c.x - r < b.x + b.width / 2 &&
        c.z + r > b.z - b.depth / 2 &&
        c.z - r < b.z + b.depth / 2,
    );
    if (!overlaps) return c;
  }
  return null;
}