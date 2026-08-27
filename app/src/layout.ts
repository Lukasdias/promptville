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