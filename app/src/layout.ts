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
  kind?: "block" | "plaza";
}

export const HOUSE_SPACING = 1.7;
export const HOUSE_PAD = 0.6;
export const ROAD_WIDTH = 3.5;

// Kept until the Task 2 layoutCity rewrite; removed by the spiral layout.
export const BLOCKS_PER_ROW = 4;

// Deterministic town grid: projects occupy cells on a uniform square lattice.
// Streets run along cell boundaries; the plaza owns cell (0,0).
export const CELL_PITCH = 28;
export const HOUSE_COLS = 13;
export const CELL_ROWS = 13;
export const CELL_CAPACITY = HOUSE_COLS * CELL_ROWS;

export interface Cell {
  cx: number;
  cz: number;
}

export interface LayoutOpts {
  plaza?: { width: number; depth: number };
}

export const CIVIC_PLAZA = { width: 20, depth: 14 };

export interface Street {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface InputSession {
  id: string;
  tokensIn: number;
  tokensOut: number;
  timeCreated: number;
}

export interface InputProject {
  id: string;
  name: string;
  sessions: InputSession[];
}

export function houseScale(tokensIn: number, tokensOut: number): number {
  const tokens = tokensIn + tokensOut;
  return Math.max(1, Math.min(6, 1 + Math.log10(1 + tokens) * 1.5));
}

export function rankProjects<T extends InputProject>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
    if (b.sessions.length !== a.sessions.length) return b.sessions.length - a.sessions.length;
    const aLast = a.sessions.reduce((m, s) => Math.max(m, s.timeCreated), 0);
    const bLast = b.sessions.reduce((m, s) => Math.max(m, s.timeCreated), 0);
    if (bLast !== aLast) return bLast - aLast;
    return a.name.localeCompare(b.name);
  });
}

function* squareSpiral(): Generator<Cell> {
  let x = 0;
  let z = 0;
  let dir = 0;
  const steps: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  yield { cx: x, cz: z };
  for (let side = 1; ; side++) {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < side; j++) {
        x += steps[dir]![0];
        z += steps[dir]![1];
        yield { cx: x, cz: z };
      }
      dir = (dir + 1) % 4;
    }
  }
}

function ringCells(minRing: number, count: number): Cell[] {
  const out: Cell[] = [];
  for (const c of squareSpiral()) {
    if (Math.max(Math.abs(c.cx), Math.abs(c.cz)) < minRing) continue;
    out.push(c);
    if (out.length === count) break;
  }
  return out;
}

// Home cell for a project rank (0-based). Ring 1 is the four cardinal lanes
// N/E/S/W around the plaza, then the four diagonal corners, then rings 2+ as a
// clockwise square spiral.
export function spiralCell(rank: number): Cell {
  if (rank < 4) {
    const card: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const [cx, cz] = card[rank]!;
    return { cx, cz };
  }
  if (rank < 8) {
    const diag: readonly (readonly [number, number])[] = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
    const [cx, cz] = diag[rank - 4]!;
    return { cx, cz };
  }
  return ringCells(2, rank - 7)[rank - 8]!;
}

export function layoutCity(projects: InputProject[], opts?: LayoutOpts): PlacedBlock[] {
  const blocks: PlacedBlock[] = [];
  if (projects.length === 0) return blocks;

  const plaza = opts?.plaza;
  const rows = Math.ceil(projects.length / BLOCKS_PER_ROW);
  const plazaRow = plaza ? Math.floor(rows / 2) : -1;

  type Cell = { kind: "project"; i: number } | { kind: "plaza" };
  const cellRows: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const cellRow: Cell[] = [];
    for (let c = 0; c < BLOCKS_PER_ROW; c++) {
      const i = r * BLOCKS_PER_ROW + c;
      if (i >= projects.length) break;
      cellRow.push({ kind: "project", i });
    }
    if (r === plazaRow) cellRow.splice(Math.min(1, cellRow.length), 0, { kind: "plaza" });
    cellRows.push(cellRow);
  }
  // Reflow rows that exceed BLOCKS_PER_ROW slots.
  for (let r = 0; r < cellRows.length; r++) {
    const row = cellRows[r];
    while (row.length > BLOCKS_PER_ROW) {
      const overflow = row.pop()!;
      if (r + 1 < cellRows.length) cellRows[r + 1].unshift(overflow);
      else cellRows.push([overflow]);
    }
  }

  let x = 0;
  let z = 0;
  let rowDepth = 0;
  for (const row of cellRows) {
    for (const cell of row) {
      if (cell.kind === "plaza") {
        const block: PlacedBlock = {
          projectId: "__plaza__",
          name: "Civic Plaza",
          x,
          z,
          width: plaza!.width,
          depth: plaza!.depth,
          houses: [],
          kind: "plaza",
        };
        blocks.push(block);
        x += plaza!.width + ROAD_WIDTH;
        rowDepth = Math.max(rowDepth, plaza!.depth);
        continue;
      }
      const project = projects[cell.i];
      const count = project.sessions.length;
      const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
      const blockRows = Math.max(1, Math.ceil(count / cols));
      const width = cols * HOUSE_SPACING + HOUSE_PAD * 2;
      const depth = blockRows * HOUSE_SPACING + HOUSE_PAD * 2;
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
        const rw = Math.floor(i / cols);
        block.houses.push({
          x: x - width / 2 + HOUSE_PAD + HOUSE_SPACING / 2 + col * HOUSE_SPACING,
          z: z - depth / 2 + HOUSE_PAD + HOUSE_SPACING / 2 + rw * HOUSE_SPACING,
          index: i,
        });
      }
      blocks.push(block);
      x += width + ROAD_WIDTH;
      rowDepth = Math.max(rowDepth, depth);
    }
    x = 0;
    z += rowDepth + ROAD_WIDTH;
    rowDepth = 0;
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
// vertical street so the road network has no dead ends. Roads extend to the
// adjacent centerlines so corners meet at clean junction points.
export function buildPerimeterRing(bounds: Bounds): Street[] {
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return [
    { x: cx, z: bounds.minZ - ROAD_WIDTH / 2, width: spanX + ROAD_WIDTH, depth: ROAD_WIDTH },
    { x: cx, z: bounds.maxZ + ROAD_WIDTH / 2, width: spanX + ROAD_WIDTH, depth: ROAD_WIDTH },
    { x: bounds.minX - ROAD_WIDTH / 2, z: cz, width: ROAD_WIDTH, depth: spanZ + ROAD_WIDTH },
    { x: bounds.maxX + ROAD_WIDTH / 2, z: cz, width: ROAD_WIDTH, depth: spanZ + ROAD_WIDTH },
  ];
}

// Extends every road to the centerlines of the roads it meets, so all street
// dead-ends become real crossings. Avenues span the ring width; vertical streets
// reach the centerline of the nearest avenue above and below (or the ring).
export function extendRoadsToRing(streets: Street[], bounds: Bounds): Street[] {
  const ringX = bounds.minX - ROAD_WIDTH / 2;
  const ringX2 = bounds.maxX + ROAD_WIDTH / 2;
  const ringZ = bounds.minZ - ROAD_WIDTH / 2;
  const ringZ2 = bounds.maxZ + ROAD_WIDTH / 2;
  const horizontals = streets.filter((s) => s.width >= s.depth);

  return streets.map((s) => {
    if (s.width >= s.depth) {
      // Avenues span the full ring width.
      return { x: (ringX + ringX2) / 2, z: s.z, width: ringX2 - ringX, depth: s.depth };
    }
    // Vertical street: reach the centerline of the nearest avenue above and below.
    const top = s.z - s.depth / 2;
    const bottom = s.z + s.depth / 2;
    const covering = horizontals.filter((h) => s.x > h.x - h.width / 2 && s.x < h.x + h.width / 2);
    const above = covering.filter((h) => h.z < top).sort((a, b) => b.z - a.z)[0];
    const below = covering.filter((h) => h.z > bottom).sort((a, b) => a.z - b.z)[0];
    const newTop = above ? Math.min(top, above.z) : ringZ;
    const newBottom = below ? Math.max(bottom, below.z) : ringZ2;
    return { x: s.x, z: (newTop + newBottom) / 2, depth: newBottom - newTop, width: s.width };
  });
}