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
  cells: Cell[];
}

export const HOUSE_SPACING = 1.7;
export const HOUSE_PAD = 0.6;
export const ROAD_WIDTH = 3.5;

// Deterministic town grid: projects occupy cells on a uniform square lattice.
// Streets run along cell boundaries; the plaza owns cell (0,0).
export const CELL_PITCH = 28;
export const HOUSE_COLS = 13;
export const CELL_ROWS = 13;
export const CELL_CAPACITY = HOUSE_COLS * CELL_ROWS;

// Plaza block identity and house-scale clamp bounds.
export const PLAZA_PROJECT_ID = "__plaza__";
export const PLAZA_NAME = "Civic Plaza";
export const MIN_HOUSE_SCALE = 1;
export const MAX_HOUSE_SCALE = 6;
const SCALE_PER_LOG_DECADE = 1.5;

// Spiral geometry: ring 1 is four cardinal lanes plus four diagonal corners;
// rings 2+ continue as a clockwise square spiral.
const CARDINAL_LANES = 4;
const RING_ONE_CELLS = 8;
const RING_TWO_MIN = 2;

// Extension-cell priority: ring distance dominates, then north, then west.
const CELL_SCORE_RING = 1000;
const CELL_SCORE_ROW = 10;

// Street merging tolerance (coordinate quantization + collinear gap).
const COORD_PRECISION = 100;
const MERGE_EPSILON = 0.01;

export interface Cell {
  cx: number;
  cz: number;
}

// The plaza always owns the origin cell.
export const ORIGIN_CELL: Cell = { cx: 0, cz: 0 };

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
  return Math.max(
    MIN_HOUSE_SCALE,
    Math.min(MAX_HOUSE_SCALE, 1 + Math.log10(1 + tokens) * SCALE_PER_LOG_DECADE),
  );
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
  if (rank < CARDINAL_LANES) {
    const card: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const [cx, cz] = card[rank]!;
    return { cx, cz };
  }
  if (rank < RING_ONE_CELLS) {
    const diag: readonly (readonly [number, number])[] = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
    const [cx, cz] = diag[rank - CARDINAL_LANES]!;
    return { cx, cz };
  }
  return ringCells(RING_TWO_MIN, rank - (RING_ONE_CELLS - 1))[rank - RING_ONE_CELLS]!;
}

function cellKey(c: Cell): string {
  return `${c.cx}:${c.cz}`;
}

function bestAdjacentFree(cells: Cell[], assigned: Set<string>): Cell | null {
  const owned = new Set(cells.map(cellKey));
  const dirs: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best: Cell | null = null;
  let bestScore = Infinity;
  for (const c of cells) {
    for (const [dx, dz] of dirs) {
      const n: Cell = { cx: c.cx + dx, cz: c.cz + dz };
      if (owned.has(cellKey(n)) || assigned.has(cellKey(n))) continue;
      // Prefer closer to the plaza; ties go north (negative z), then west.
      const score =
        Math.max(Math.abs(n.cx), Math.abs(n.cz)) * CELL_SCORE_RING +
        n.cz * CELL_SCORE_ROW +
        n.cx;
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
  }
  return best;
}

export function layoutCity(projects: InputProject[], opts?: LayoutOpts): PlacedBlock[] {
  const plaza = opts?.plaza ?? CIVIC_PLAZA;
  const ranked = rankProjects(projects);
  const blocks: PlacedBlock[] = [
    {
      projectId: PLAZA_PROJECT_ID,
      name: PLAZA_NAME,
      x: 0,
      z: 0,
      width: plaza.width,
      depth: plaza.depth,
      houses: [],
      kind: "plaza",
      cells: [ORIGIN_CELL],
    },
  ];
  const assigned = new Set<string>([cellKey(ORIGIN_CELL)]);
  let ordinal = 0;

  const nextHome = (): Cell => {
    while (assigned.has(cellKey(spiralCell(ordinal)))) ordinal++;
    const cell = spiralCell(ordinal);
    ordinal++;
    return cell;
  };

  for (const p of ranked) {
    const rowsNeeded = Math.max(1, Math.ceil(p.sessions.length / HOUSE_COLS));
    const cellsNeeded = Math.max(1, Math.ceil(rowsNeeded / CELL_ROWS));
    const cells: Cell[] = [nextHome()];
    while (cells.length < cellsNeeded) {
      const adjacent = bestAdjacentFree(cells, assigned);
      if (adjacent) cells.push(adjacent);
      else cells.push(nextHome());
    }
    for (const c of cells) assigned.add(cellKey(c));

    const minCx = Math.min(...cells.map((c) => c.cx));
    const maxCx = Math.max(...cells.map((c) => c.cx));
    const minCz = Math.min(...cells.map((c) => c.cz));
    const maxCz = Math.max(...cells.map((c) => c.cz));
    const width = (maxCx - minCx + 1) * CELL_PITCH - ROAD_WIDTH;
    const depth = (maxCz - minCz + 1) * CELL_PITCH - ROAD_WIDTH;
    const x = ((minCx + maxCx) / 2) * CELL_PITCH;
    const z = ((minCz + maxCz) / 2) * CELL_PITCH;

    const sorted = [...p.sessions].sort(
      (a, b) => a.timeCreated - b.timeCreated || a.id.localeCompare(b.id),
    );
    const houses: HouseSlot[] = sorted.map((_, i) => ({
      x: x - width / 2 + HOUSE_PAD + HOUSE_SPACING / 2 + (i % HOUSE_COLS) * HOUSE_SPACING,
      z: z - depth / 2 + HOUSE_PAD + HOUSE_SPACING / 2 + Math.floor(i / HOUSE_COLS) * HOUSE_SPACING,
      index: i,
    }));

    blocks.push({ projectId: p.id, name: p.name, x, z, width, depth, houses, cells });
  }

  return blocks;
}

// Builds a connected street graph from the block layout. Horizontal avenues span
// the full city width between rows; vertical streets fill each column gap, joining
// the row's top and bottom avenues. Result is one connected network (grid pattern).
function mergeRuns(streets: Street[]): Street[] {
  const byAxis = new Map<number, Street[]>();
  for (const s of streets) {
    const horizontal = s.width >= s.depth;
    const key = Math.round(horizontal ? s.z * COORD_PRECISION : s.x * COORD_PRECISION);
    const group = byAxis.get(key);
    if (group) group.push(s);
    else byAxis.set(key, [s]);
  }
  const out: Street[] = [];
  for (const group of byAxis.values()) {
    const horizontal = group[0]!.width >= group[0]!.depth;
    const sorted = [...group].sort((a, b) => (horizontal ? a.x - b.x : a.z - b.z));
    let cur = sorted[0]!;
    for (const next of sorted.slice(1)) {
      const curEnd = horizontal ? cur.x + cur.width / 2 : cur.z + cur.depth / 2;
      const nextStart = horizontal ? next.x - next.width / 2 : next.z - next.depth / 2;
      if (Math.abs(nextStart - curEnd) < MERGE_EPSILON) {
        if (horizontal) cur.width = next.x + next.width / 2 - (cur.x - cur.width / 2);
        else cur.depth = next.z + next.depth / 2 - (cur.z - cur.depth / 2);
      } else {
        out.push(cur);
        cur = next;
      }
    }
    out.push(cur);
  }
  return out;
}

// Builds the street grid from the cell lattice: one street rect for every cell
// boundary shared by two differently-owned cells (vertical for east/west
// neighbors, horizontal for north/south), with collinear runs merged into
// single long streets.
export function buildStreets(blocks: PlacedBlock[]): Street[] {
  if (blocks.length === 0) return [];
  const owner = new Map<string, PlacedBlock>();
  for (const b of blocks) for (const c of b.cells) owner.set(cellKey(c), b);

  const verticals: Street[] = [];
  const horizontals: Street[] = [];
  for (const b of blocks) {
    for (const c of b.cells) {
      const east = owner.get(cellKey({ cx: c.cx + 1, cz: c.cz }));
      if (east && east !== b) {
        verticals.push({
          x: c.cx * CELL_PITCH + CELL_PITCH / 2,
          z: c.cz * CELL_PITCH,
          width: ROAD_WIDTH,
          depth: CELL_PITCH,
        });
      }
      const south = owner.get(cellKey({ cx: c.cx, cz: c.cz + 1 }));
      if (south && south !== b) {
        horizontals.push({
          x: c.cx * CELL_PITCH,
          z: c.cz * CELL_PITCH + CELL_PITCH / 2,
          width: CELL_PITCH,
          depth: ROAD_WIDTH,
        });
      }
    }
  }
  return [...mergeRuns(horizontals), ...mergeRuns(verticals)];
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