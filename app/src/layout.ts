export interface HouseSlot {
  x: number;
  z: number;
  index: number;
}

export interface PlacedBlock {
  projectId: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  houses: HouseSlot[];
}

export const HOUSE_SPACING = 1.7;
export const HOUSE_PAD = 0.6;
export const ROAD_WIDTH = 3.5;
export const BLOCKS_PER_ROW = 4;

export interface Street {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export function houseScale(tokensIn: number, tokensOut: number): number {
  const tokens = tokensIn + tokensOut;
  return Math.max(1, Math.min(6, 1 + Math.log10(1 + tokens) * 1.5));
}

interface InputProject {
  id: string;
  name: string;
  sessions: { tokensIn: number; tokensOut: number }[];
}

export function layoutCity(projects: InputProject[]): PlacedBlock[] {
  const blocks: PlacedBlock[] = [];
  let x = 0;
  let z = 0;
  let rowDepth = 0;

  for (const project of projects) {
    const count = project.sessions.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));
    const width = cols * HOUSE_SPACING + HOUSE_PAD * 2;
    const depth = rows * HOUSE_SPACING + HOUSE_PAD * 2;

    const block: PlacedBlock = {
      projectId: project.id,
      name: project.name,
      x,
      z,
      width,
      depth,
      houses: [],
    };

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      block.houses.push({
        x: x - width / 2 + HOUSE_PAD + HOUSE_SPACING / 2 + col * HOUSE_SPACING,
        z: z - depth / 2 + HOUSE_PAD + HOUSE_SPACING / 2 + row * HOUSE_SPACING,
        index: i,
      });
    }

    blocks.push(block);

    x += width + ROAD_WIDTH;
    rowDepth = Math.max(rowDepth, depth);

    if (blocks.length % BLOCKS_PER_ROW === 0) {
      x = 0;
      z += rowDepth + ROAD_WIDTH;
      rowDepth = 0;
    }
  }

  return blocks;
}

// Builds a connected street graph from the block layout. Horizontal avenues span
// the full city width between rows; vertical streets fill each column gap, joining
// the row's top and bottom avenues. Result is one connected network (grid pattern).
export function buildStreets(blocks: PlacedBlock[]): Street[] {
  if (blocks.length === 0) return [];
  const streets: Street[] = [];
  const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
  const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
  const rowCount = Math.ceil(blocks.length / BLOCKS_PER_ROW);

  for (let r = 0; r < rowCount; r++) {
    const row = blocks.slice(r * BLOCKS_PER_ROW, r * BLOCKS_PER_ROW + BLOCKS_PER_ROW);
    const rowTop = Math.min(...row.map((b) => b.z - b.depth / 2));
    const rowBottom = Math.max(...row.map((b) => b.z + b.depth / 2));

    for (let i = 0; i < row.length - 1; i++) {
      const right = blocks[r * BLOCKS_PER_ROW + i].x + blocks[r * BLOCKS_PER_ROW + i].width / 2;
      const left = blocks[r * BLOCKS_PER_ROW + i + 1].x - blocks[r * BLOCKS_PER_ROW + i + 1].width / 2;
      streets.push({
        x: (right + left) / 2,
        z: (rowTop + rowBottom) / 2,
        width: left - right,
        depth: rowBottom - rowTop,
      });
    }

    if (r < rowCount - 1) {
      const nextTop = Math.min(
        ...blocks
          .slice((r + 1) * BLOCKS_PER_ROW, (r + 1) * BLOCKS_PER_ROW + BLOCKS_PER_ROW)
          .map((b) => b.z - b.depth / 2),
      );
      streets.push({
        x: (minX + maxX) / 2,
        z: (rowBottom + nextTop) / 2,
        width: maxX - minX,
        depth: nextTop - rowBottom,
      });
    }
  }

  return streets;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function cityBounds(blocks: PlacedBlock[]): Bounds | null {
  if (blocks.length === 0) return null;
  return {
    minX: Math.min(...blocks.map((b) => b.x - b.width / 2)),
    maxX: Math.max(...blocks.map((b) => b.x + b.width / 2)),
    minZ: Math.min(...blocks.map((b) => b.z - b.depth / 2)),
    maxZ: Math.max(...blocks.map((b) => b.z + b.depth / 2)),
  };
}

// A rectangular ring road just outside the city, connecting every avenue end and
// vertical street so the road network has no dead ends.
export function buildPerimeterRing(bounds: Bounds): Street[] {
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return [
    { x: cx, z: bounds.minZ - ROAD_WIDTH / 2, width: spanX + ROAD_WIDTH * 2, depth: ROAD_WIDTH },
    { x: cx, z: bounds.maxZ + ROAD_WIDTH / 2, width: spanX + ROAD_WIDTH * 2, depth: ROAD_WIDTH },
    { x: bounds.minX - ROAD_WIDTH / 2, z: cz, width: ROAD_WIDTH, depth: spanZ + ROAD_WIDTH * 2 },
    { x: bounds.maxX + ROAD_WIDTH / 2, z: cz, width: ROAD_WIDTH, depth: spanZ + ROAD_WIDTH * 2 },
  ];
}

// Extends every road to the centerlines of the roads it meets, so all street
// dead-ends become real crossings (no gap between rectangle ends and junctions).
export function extendRoadsToRing(streets: Street[], bounds: Bounds): Street[] {
  const ringX = bounds.minX - ROAD_WIDTH / 2;
  const ringX2 = bounds.maxX + ROAD_WIDTH / 2;

  return streets.map((s) => {
    if (s.width >= s.depth) {
      // Avenues span the full ring width.
      return { x: (ringX + ringX2) / 2, z: s.z, width: ringX2 - ringX, depth: s.depth };
    }
    // Vertical streets extend by half a road on each end to meet the avenue/ring
    // centerlines above and below.
    const top = s.z - s.depth / 2;
    const bottom = s.z + s.depth / 2;
    return { x: s.x, z: (top + bottom) / 2, depth: bottom - top + ROAD_WIDTH, width: s.width };
  });
}