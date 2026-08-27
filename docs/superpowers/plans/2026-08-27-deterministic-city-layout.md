# Deterministic City Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the procedural row/reflow city layout with a deterministic, rank-ordered grid: projects are sorted by activity, placed on a uniform square lattice around a fixed center plaza (four cardinal lanes first), houses use fixed columns so they never move when sessions are appended.

**Architecture:** A pure "planner" in `app/src/layout.ts` computes, from the project list alone, (1) an activity ranking, (2) a home cell on a square lattice per project via a cardinal-first square spiral, (3) a compact block per project (greedy edge-adjacent extension cells for oversized projects), (4) a fixed-column house grid ordered by session time, and (5) a grid street network between differently-owned cells. `PlacedBlock` gains a `cells` field; `buildStreets` is rewritten to derive streets from the cell lattice. All downstream consumers (`Scene`, `CivCamera`, `City`, `People`, `SelectedBanner`, `Ground`, `Details`, `World`, `Traffic`, `civic.ts`) keep their existing props and continue to work unchanged.

**Tech Stack:** Bun workspace `app`; TypeScript strict; `bun test` for the pure planner functions; existing `useCity()` hook in `app/src/city.ts` already feeds `data.projects` (whose `SessionData` includes `id`, `tokensIn`, `tokensOut`, `timeCreated`).

## Global Constraints

- React Compiler is enabled (`app/vite.config.ts`); keep `useCity()` free of `useMemo`/context.
- Never use `any`. Avoid `as` unless necessary.
- House slot *positions* are keyed by time-ordered index and fixed `HOUSE_COLS`; appending a session must not move existing houses.
- Block position is a pure function of the project set; `layoutCity(projects, opts)` with identical input must return byte-identical output (determinism — no `Math.random`, all RNG via seeded `mulberry32` in `app/src/rand.ts`).
- `buildStreets(blocks)` keeps its signature `(blocks: PlacedBlock[]) => Street[]`; `Street.width >= depth` means a horizontal (x-axis) avenue.
- All UI copy in English. Read `docs/superpowers/specs/2026-08-27-opencode-city-3d-design.md` for tone.
- Run `bun run typecheck`, `bun test`, `bun run build` after each task.

---

## File Structure

- **Modify** `app/src/layout.ts` — planner core: `Cell`, `spiralCell`, `rankProjects`, `layoutCity` (spiral + greedy cells + fixed-cols houses), `buildStreets` (grid rewrite), new constants (`CELL_PITCH`, `HOUSE_COLS`, `CELL_ROWS`, `CELL_CAPACITY`), extended `InputSession`/`InputProject`, `PlacedBlock.cells`. Remove `BLOCKS_PER_ROW`.
- **Modify** `app/src/layout.test.ts` — rewrite for spiral layout, ranking, stability, house grid.
- **Modify** `app/src/civic.test.ts`, `app/src/roadgraph.test.ts` — fixtures gain `id` + `timeCreated` on sessions; expectations updated for grid streets.
- **Modify** `app/src/civic.ts` — only if a `layoutCivicDistrict` assertion breaks; otherwise untouched.
- **Modify** `app/src/components/three/CivCamera.tsx` — fit-to-city initial distance (Task 5).
- **Modify** `README.md` — document the deterministic layout (Task 5).
- **Untouched by design** — `app/src/city.ts`, `Scene.tsx`, `City.tsx`, `People.tsx`, `SelectedBanner.tsx`, `Ground.tsx`, `Details.tsx`, `World.tsx`, `Traffic.tsx`, `Sidewalks.tsx`, `traffic.ts`, `roadgraph.ts`, `camera.ts`, `store.ts`.

---

### Task 1: Ranking + spiral cell mapping (pure functions)

**Files:**
- Modify: `app/src/layout.ts`
- Test: `app/src/layout.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export interface Cell { cx: number; cz: number }`
  - `export const CELL_PITCH = 28`
  - `export const HOUSE_COLS = 13`
  - `export const CELL_ROWS = 13`
  - `export const CELL_CAPACITY = HOUSE_COLS * CELL_ROWS`
  - `export interface InputSession { id: string; tokensIn: number; tokensOut: number; timeCreated: number }`
  - `export interface InputProject { id: string; name: string; sessions: InputSession[] }`
  - `export function spiralCell(rank: number): Cell` — rank 0..3 = N,E,S,W; 4..7 = NE,SE,SW,NW; 8+ = ring-2+ clockwise square spiral (Chebyshev distance ≥ 2).
  - `export function rankProjects<T extends InputProject>(projects: T[]): T[]` — sort by `sessions.length` desc, then latest `timeCreated` desc, then `name` asc.

- [ ] **Step 1: Write the failing test**

Append to `app/src/layout.test.ts`:

```ts
import { spiralCell, rankProjects } from "./layout";

describe("spiralCell", () => {
  test("first four ranks are the cardinal lanes N,E,S,W", () => {
    expect(spiralCell(0)).toEqual({ cx: 0, cz: -1 }); // N
    expect(spiralCell(1)).toEqual({ cx: 1, cz: 0 });  // E
    expect(spiralCell(2)).toEqual({ cx: 0, cz: 1 });  // S
    expect(spiralCell(3)).toEqual({ cx: -1, cz: 0 }); // W
  });

  test("ranks 4-7 are the diagonal corners", () => {
    expect(spiralCell(4)).toEqual({ cx: 1, cz: -1 }); // NE
    expect(spiralCell(5)).toEqual({ cx: 1, cz: 1 });  // SE
    expect(spiralCell(6)).toEqual({ cx: -1, cz: 1 }); // SW
    expect(spiralCell(7)).toEqual({ cx: -1, cz: -1 });// NW
  });

  test("ranks 8+ are unique ring-2 cells", () => {
    const cells = Array.from({ length: 40 }, (_, i) => spiralCell(i));
    const keys = new Set(cells.map((c) => `${c.cx}:${c.cz}`));
    expect(keys.size).toBe(40);
    for (let i = 8; i < 40; i++) {
      expect(Math.max(Math.abs(cells[i]!.cx), Math.abs(cells[i]!.cz))).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("rankProjects", () => {
  const s = (id: string, timeCreated: number) => ({ id, tokensIn: 1, tokensOut: 1, timeCreated });
  const projects = [
    { id: "a", name: "A", sessions: [s("s1", 2), s("s2", 5)] },
    { id: "b", name: "B", sessions: [s("s3", 9)] },
    { id: "c", name: "C", sessions: [s("s4", 4), s("s5", 1), s("s6", 3)] },
  ];

  test("sorts by session count desc, then recency desc", () => {
    expect(rankProjects(projects).map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  test("ties on count and recency break by name asc", () => {
    const t = (id: string, name: string) => ({ id, name, sessions: [s("x", 1)] });
    expect(rankProjects([t("2", "beta"), t("1", "alpha")]).map((p) => p.id)).toEqual(["1", "2"]);
  });

  test("does not mutate the input array", () => {
    const before = projects.map((p) => p.id);
    rankProjects(projects);
    expect(projects.map((p) => p.id)).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/layout.test.ts`
Expected: FAIL — `spiralCell`, `rankProjects` not exported from `./layout`.

- [ ] **Step 3: Implement the pure functions**

In `app/src/layout.ts`, replace the top of the file (keep `HouseSlot`, `PlacedBlock`, `HOUSE_SPACING`, `HOUSE_PAD`, `ROAD_WIDTH`, `CIVIC_PLAZA`, `LayoutOpts`, `Street`; remove `BLOCKS_PER_ROW`). Add:

```ts
export interface Cell {
  cx: number;
  cz: number;
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

// Deterministic town grid: projects occupy cells on a uniform square lattice.
// Streets run along cell boundaries; the plaza owns cell (0,0).
export const CELL_PITCH = 28;
export const HOUSE_COLS = 13;
export const CELL_ROWS = 13;
export const CELL_CAPACITY = HOUSE_COLS * CELL_ROWS;

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/layout.ts app/src/layout.test.ts
git commit -m "feat: activity ranking and cardinal-first spiral cell mapping"
```

---

### Task 2: `layoutCity` — spiral placement, greedy cells, fixed-column houses

**Files:**
- Modify: `app/src/layout.ts`
- Test: `app/src/layout.test.ts`

**Interfaces:**
- Consumes: `Cell`, `spiralCell`, `rankProjects`, `CELL_PITCH`, `HOUSE_COLS`, `CELL_ROWS`, `InputProject` from Task 1.
- Produces:
  - `interface PlacedBlock` gains `cells: Cell[]`.
  - `layoutCity(projects: InputProject[], opts?: LayoutOpts): PlacedBlock[]` — plaza block (kind `"plaza"`, projectId `"__plaza__"`, cells `[{cx:0,cz:0}]`, x/z 0) always first; then one block per project in **ranked** order.
  - Block geometry: `width = (maxCx-minCx+1) * CELL_PITCH - ROAD_WIDTH`, `depth` likewise, center at the cell bounding-box center. House grid: fixed `HOUSE_COLS` columns, sessions sorted by `timeCreated` asc then `id` asc.

- [ ] **Step 1: Write the failing test**

Replace the `layoutCity` describe block in `app/src/layout.test.ts`:

```ts
describe("layoutCity", () => {
  const s = (id: string, timeCreated: number) => ({ id, tokensIn: 10, tokensOut: 5, timeCreated });
  const projects = [
    { id: "a", name: "A", sessions: [s("s1", 1), s("s2", 2)] },
    { id: "b", name: "B", sessions: Array.from({ length: 20 }, (_, i) => s(`b${i}`, i)) },
    { id: "c", name: "C", sessions: [s("c1", 1), s("c2", 2), s("c3", 3)] },
  ];

  test("places the plaza at the origin first", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    const plaza = blocks[0]!;
    expect(plaza.kind).toBe("plaza");
    expect(plaza.x).toBe(0);
    expect(plaza.z).toBe(0);
    expect(plaza.houses).toHaveLength(0);
  });

  test("project blocks are in ranked order (by session count)", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    expect(blocks.map((b) => b.projectId)).toEqual(["b", "c", "a"]);
  });

  test("rank 0 sits north of the plaza, rank 1 east, rank 2 south", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    expect(blocks[0]!.z).toBeLessThan(0);
    expect(Math.abs(blocks[0]!.x)).toBeLessThan(CELL_PITCH / 2);
    expect(blocks[1]!.x).toBeGreaterThan(0);
    expect(Math.abs(blocks[1]!.z)).toBeLessThan(CELL_PITCH / 2);
    expect(blocks[2]!.z).toBeGreaterThan(0);
    expect(Math.abs(blocks[2]!.x)).toBeLessThan(CELL_PITCH / 2);
  });

  test("adjacent cardinal blocks are CELL_PITCH apart", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    expect(blocks[0]!.z - blocks[2]!.z).toBeCloseTo(CELL_PITCH);
  });

  test("every house lands inside its block bounds and uses fixed columns", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    for (const b of blocks) {
      for (const h of b.houses) {
        expect(h.x).toBeGreaterThanOrEqual(b.x - b.width / 2);
        expect(h.x).toBeLessThanOrEqual(b.x + b.width / 2);
        expect(h.z).toBeGreaterThanOrEqual(b.z - b.depth / 2);
        expect(h.z).toBeLessThanOrEqual(b.z + b.depth / 2);
        expect(h.index % HOUSE_COLS).toBe(h.x === undefined ? -1 : (h.x - (b.x - b.width / 2 + HOUSE_PAD + HOUSE_SPACING / 2)) / HOUSE_SPACING);
      }
      expect(b.houses.length).toBe(20); // the big project
    }
  });

  test("appending a session to the smallest project moves no other block", () => {
    const before = layoutCity(projects, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    const grown = [
      { ...projects[0]!, sessions: [...projects[0]!.sessions, s("extra", 99)] },
      projects[1]!,
      projects[2]!,
    ];
    const after = layoutCity(grown, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    for (const b of after) {
      const prev = before.find((p) => p.projectId === b.projectId)!;
      expect(b.x).toBe(prev.x);
      expect(b.z).toBe(prev.z);
      expect(b.width).toBe(prev.width);
      expect(b.depth).toBe(prev.depth);
    }
    const grownBlock = after.find((b) => b.projectId === "a")!;
    const prevBlock = before.find((b) => b.projectId === "a")!;
    expect(grownBlock.houses.length).toBe(prevBlock.houses.length + 1);
    for (let i = 0; i < prevBlock.houses.length; i++) {
      expect(grownBlock.houses[i]!.x).toBe(prevBlock.houses[i]!.x);
      expect(grownBlock.houses[i]!.z).toBe(prevBlock.houses[i]!.z);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/layout.test.ts`
Expected: FAIL — old `layoutCity` returns input order, no plaza at origin, no `cells`.

- [ ] **Step 3: Implement `layoutCity`**

In `app/src/layout.ts`, add `cells: Cell[]` to `PlacedBlock`, then replace the `layoutCity` function and delete the old `HouseSlot`-based `InputProject`:

```ts
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
      // Prefer closer to the plaza; ties go north, then west.
      const score = Math.max(Math.abs(n.cx), Math.abs(n.cz)) * 1000 + n.cz * 10 + n.cx;
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
      projectId: "__plaza__",
      name: "Civic Plaza",
      x: 0,
      z: 0,
      width: plaza.width,
      depth: plaza.depth,
      houses: [],
      kind: "plaza",
      cells: [{ cx: 0, cz: 0 }],
    },
  ];
  const assigned = new Set<string>(["0:0"]);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/layout.test.ts`
Expected: PASS. Note the house-grid assertion uses floating math — keep the column check to `expect(Math.round((h.x - (b.x - b.width / 2 + HOUSE_PAD + HOUSE_SPACING / 2)) / HOUSE_SPACING)).toBe(h.index % HOUSE_COLS)` if float drift appears.

- [ ] **Step 5: Commit**

```bash
git add app/src/layout.ts app/src/layout.test.ts
git commit -m "feat: rank-ordered spiral city layout with fixed-column houses"
```

---

### Task 3: `buildStreets` — grid streets from the cell lattice

**Files:**
- Modify: `app/src/layout.ts`
- Test: `app/src/layout.test.ts`

**Interfaces:**
- Consumes: `PlacedBlock.cells`, `CELL_PITCH`, `ROAD_WIDTH`, `Cell` from Tasks 1-2.
- Produces: `buildStreets(blocks: PlacedBlock[]): Street[]` — one street rect for every cell-boundary shared by two *differently-owned* cells (vertical for east/west neighbors, horizontal for north/south), collinear runs merged into single long streets. Convention: horizontal = `width >= depth`.

- [ ] **Step 1: Write the failing test**

Replace the `buildStreets` describe block in `app/src/layout.test.ts`:

```ts
describe("buildStreets", () => {
  const s = (id: string, timeCreated: number) => ({ id, tokensIn: 10, tokensOut: 5, timeCreated });
  const projects = [
    { id: "a", name: "A", sessions: [s("s1", 1)] },
    { id: "b", name: "B", sessions: [s("s2", 1)] },
    { id: "c", name: "C", sessions: [s("s3", 1)] },
  ];

  test("the plaza is surrounded by four streets", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    const streets = buildStreets(blocks);
    const near = streets.filter(
      (st) => Math.abs(st.x) <= CELL_PITCH && Math.abs(st.z) <= CELL_PITCH,
    );
    expect(near.length).toBeGreaterThanOrEqual(4);
  });

  test("no street overlaps a block", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    const streets = buildStreets(blocks);
    const eps = 0.001;
    for (const s2 of streets) {
      for (const b of blocks) {
        const overlap =
          s2.x + s2.width / 2 > b.x - b.width / 2 + eps &&
          s2.x - s2.width / 2 < b.x + b.width / 2 - eps &&
          s2.z + s2.depth / 2 > b.z - b.depth / 2 + eps &&
          s2.z - s2.depth / 2 < b.z + b.depth / 2 - eps;
        expect(overlap).toBe(false);
      }
    }
  });

  test("all streets lie within the city bounds", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    const streets = buildStreets(blocks);
    const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
    const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
    const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2));
    const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2));
    for (const s2 of streets) {
      expect(s2.x - s2.width / 2).toBeGreaterThanOrEqual(minX);
      expect(s2.x + s2.width / 2).toBeLessThanOrEqual(maxX);
      expect(s2.z - s2.depth / 2).toBeGreaterThanOrEqual(minZ);
      expect(s2.z + s2.depth / 2).toBeLessThanOrEqual(maxZ);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/layout.test.ts`
Expected: FAIL — old `buildStreets` uses `BLOCKS_PER_ROW` and row slicing; blocks are no longer row-ordered.

- [ ] **Step 3: Implement `buildStreets`**

In `app/src/layout.ts`, replace `buildStreets` (and delete the old row-grouping helper):

```ts
function mergeRuns(streets: Street[]): Street[] {
  const byAxis = new Map<number, Street[]>();
  for (const s of streets) {
    const horizontal = s.width >= s.depth;
    const key = Math.round(horizontal ? s.z * 100 : s.x * 100);
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
      const contiguous = horizontal
        ? Math.abs(next.x - (cur.x + cur.width / 2)) < 0.01
        : Math.abs(next.z - (cur.z + cur.depth / 2)) < 0.01;
      if (contiguous) {
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

export function buildStreets(blocks: PlacedBlock[]): Street[] {
  if (blocks.length === 0) return [];
  const owner = new Map<string, PlacedBlock>();
  for (const b of blocks) for (const c of b.cells) owner.set(`${c.cx}:${c.cz}`, b);

  const verticals: Street[] = [];
  const horizontals: Street[] = [];
  for (const b of blocks) {
    for (const c of b.cells) {
      const east = owner.get(`${c.cx + 1}:${c.cz}`);
      if (east && east !== b) {
        verticals.push({
          x: c.cx * CELL_PITCH + CELL_PITCH / 2,
          z: c.cz * CELL_PITCH,
          width: ROAD_WIDTH,
          depth: CELL_PITCH,
        });
      }
      const south = owner.get(`${c.cx}:${c.cz + 1}`);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/layout.test.ts`
Expected: PASS. Then run the full suite to see which downstream suites break (expected: `civic.test.ts`, `roadgraph.test.ts` fixtures fail to compile or assert).

Run: `bun test`
Expected: `layout.test.ts` passes; `civic.test.ts` / `roadgraph.test.ts` may fail — that is the intended state for Task 4.

- [ ] **Step 5: Commit**

```bash
git add app/src/layout.ts app/src/layout.test.ts
git commit -m "feat: derive street grid from the cell lattice"
```

---

### Task 4: Fixtures + civic district alignment

**Files:**
- Modify: `app/src/civic.test.ts`, `app/src/roadgraph.test.ts`
- Modify: `app/src/civic.ts` (only if an assertion breaks)
- Test: `bun test`

**Interfaces:**
- Consumes: `layoutCity`, `buildStreets`, `buildPerimeterRing`, `extendRoadsToRing`, `cityBounds` (unchanged signatures); `InputProject` now requires `sessions[].{id, timeCreated}`.
- Produces: green `civic.test.ts` and `roadgraph.test.ts` against the spiral layout.

- [ ] **Step 1: Update fixtures**

In `app/src/civic.test.ts` and `app/src/roadgraph.test.ts`, change every session factory from `{ tokensIn: 10, tokensOut: 5 }` to include a stable `id` and `timeCreated`, e.g.:

```ts
const sessions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, tokensIn: 10, tokensOut: 5, timeCreated: i }));
```

And `Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 }))` → `sessions(8)` (same for 9, 171, 80, 40, 4).

- [ ] **Step 2: Run to see failures**

Run: `bun test`
Expected: fixture changes fix the "sessions missing timeCreated" compile errors. Remaining failures are assertion-level (e.g., "visitor paths start on a sidewalk lane", "curbs lie on a street", roadgraph dead-end/connectivity).

- [ ] **Step 3: Align `civic.ts` with the grid**

In `app/src/civic.ts`:
- Confirm `borderingStreet` still finds the four plaza-boundary streets (they now lie exactly at `±CELL_PITCH/2` from the plaza center on all four sides). If `LOT_SETBACK`/`SIDEWALK_CENTER` offsets place a curb or path beyond the street band, adjust the numeric constants (`LOT_SETBACK`, `SIDE_OFFSET`, `SIDEWALK_CENTER`, `WALK_BACK`) so: every lot stays inside the plaza pad (test asserts), curbs land on a street (test asserts), visitor-path sidewalk points sit within `0.6` of a street.
- Do not change `layoutCivicDistrict`'s signature or the `BuildingLot`/`VisitorPath` shapes.

- [ ] **Step 4: Run to verify green**

Run: `bun test`
Expected: all suites pass (layout, civic, roadgraph, camera, traffic, voxel, activity, db, api).

- [ ] **Step 5: Commit**

```bash
git add app/src/civic.test.ts app/src/roadgraph.test.ts app/src/civic.ts
git commit -m "fix: align civic district and road graph tests with grid streets"
```

---

### Task 5: Camera framing + docs + full verify

**Files:**
- Modify: `app/src/components/three/CivCamera.tsx`
- Modify: `README.md`
- Test: `bun test`, `bun run typecheck`, `bun run build`

**Interfaces:**
- Consumes: `useCity()` (already provides `extent`), `DEFAULT_DISTANCE`, `zoomBy`, `clampState` from `app/src/camera.ts`.
- Produces: camera initial zoom that frames the whole town; docs describing the deterministic layout.

- [ ] **Step 1: Fit camera to the city on load**

In `app/src/components/three/CivCamera.tsx`, inside the existing `useEffect` that runs when `blocks`/`extent` first become available, set the initial goal distance so the whole city is framed:

```ts
const fit = Math.max(DEFAULT_DISTANCE, extent * 0.9);
if (state.current.distance === DEFAULT_CAMERA.distance && goal.current.distance === DEFAULT_CAMERA.distance) {
  goal.current.distance = clampState({ ...DEFAULT_CAMERA, distance: fit }, extent).distance;
}
```

(Guard so a user zoom/pan is never overridden after first load.)

- [ ] **Step 2: Update README**

In `README.md`, replace the "Height scales with token usage" bullet context to describe the deterministic layout:

```markdown
- **Layout is deterministic**: projects are ranked by activity (session count,
  then recency) and placed on a fixed grid around a central plaza — the most
  active project always occupies the lane north of the plaza. House slots use
  fixed columns, so adding a session never moves existing houses.
```

- [ ] **Step 3: Full verification**

Run: `bun run typecheck` then `bun test` then `bun run build`.
Expected: all green; production build runs the React Compiler without errors.

- [ ] **Step 4: Manual smoke (optional)**

Run: `bun run dev`, open `http://localhost:5173`, confirm: plaza centered, top project north of plaza, streets form a connected grid with traffic lights, click a house then press `F` → camera lands on that house.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/three/CivCamera.tsx README.md
git commit -m "feat: fit camera to deterministic city; document layout"
```

---

## Self-Review

**1. Spec coverage (user decisions):**
- Ordered-by-activity → Task 1 `rankProjects` + Task 2 rank-ordered `layoutCity`. ✓
- Sessions-then-recency scoring → Task 1 sort key `(sessions desc, latest timeCreated desc, name asc)`. ✓
- 4 cardinal lanes → Task 1 `spiralCell` ranks 0-3 = N/E/S/W. ✓
- Deterministic/predictable → no `Math.random`; all placement pure functions; Task 2 "appending a session moves no other block" test. ✓
- Houses never move on append → fixed `HOUSE_COLS` + time-ordered slots; stability test. ✓

**2. Placeholder scan:** No TODOs/TBDs; every code step has full implementations.

**3. Type consistency:**
- `InputProject`/`InputSession` introduced in Task 1, used by `layoutCity` (Task 2) and fixtures (Task 4). ✓
- `PlacedBlock.cells: Cell[]` introduced in Task 2, consumed by `buildStreets` (Task 3). ✓
- `buildStreets` signature unchanged; `Street` horizontal convention preserved for `extendRoadsToRing`, `findIntersections`, `buildRoadGraph`. ✓
- `spiralCell(rank)` returns ring-1 cardinals first; `ringCells(2, rank - 7)[rank - 8]` yields exactly `rank - 7` cells for the slice, so index `rank - 8` is valid. ✓

**Known accepted tradeoffs (documented, not bugs):**
- A project's block position depends on its activity *rank*, so ranks change when the project set changes (re-ranking) or when a project crosses a cell-capacity boundary — same-data output is always byte-identical.
- `houseScale` (log10 token) is intentionally unchanged: a session's house grows in place as its tokens accumulate; position no longer depends on footprint.
- `BLOCKS_PER_ROW` is removed; nothing outside `layout.ts`/`layout.test.ts` imported it.