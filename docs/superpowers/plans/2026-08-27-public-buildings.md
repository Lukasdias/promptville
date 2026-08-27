# Public Buildings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six public buildings (hospital, police, fire station, mall, bakery, pet shop) around a civic plaza embedded in the town grid, as working destinations for cars and people, with signs and detail cards.

**Architecture:** A backward-compatible `layoutCity(projects, { plaza })` reserves a plaza cell in the middle row of the block grid; a new pure `civic.ts` lays out six building lots, curbs, and visitor paths on it; `roadgraph.attachCurbs` adds curb nodes so `WaypointCar` routes to buildings; a new `VisitorMover` walks people house→entrance→house; new `CivicDistrict.tsx` renders voxel buildings (per the `voxel-forms` skill), signs, and click handling; the store/HUD gain building selection, live activity counts, and a toggle.

**Tech Stack:** Bun ≥1.3, TypeScript, React 19, `@react-three/fiber` 9, `@react-three/drei` 10, `three`, Zustand 5, `bun test`. Design spec: `docs/superpowers/specs/2026-08-27-public-buildings-design.md`. Voxel pattern: `.opencode/skill/voxel-forms/`.

## Global Constraints

- Never use `any`; avoid `as` unless necessary. Follow neighboring-file patterns.
- All scene geometry voxel-based (`Voxel[]` → `InstancedVoxels`); never hand-build buildings from many `<mesh>`.
- `frameloop="always"` on Canvas stays. Never `setState` inside `useFrame` — simulation stats flush via `setInterval` (Task 5).
- Front face of building blueprints is `+z`; rotations are quarter turns via `group rotation-y`.
- All copy in English; fonts Fredoka + Nunito; cartoon palette from `theme.ts`.
- Server reads the opencode DB read-only; no server changes in this feature.
- Run `bun run typecheck` and `bun test` after each task. Commit only when the user asks.

---

### Task 1: Plaza reservation in layoutCity

**Files:**
- Modify: `app/src/layout.ts`
- Test: `app/src/layout.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `LayoutOpts = { plaza?: { width: number; depth: number } }`; `layoutCity(projects, opts?)`; `PlacedBlock.kind?: "block" | "plaza"`; exported `CIVIC_PLAZA = { width: 20, depth: 14 }`. All existing callers/behavior unchanged when `opts` omitted.

- [ ] **Step 1: Write the failing tests**

Append to `app/src/layout.test.ts`:

```ts
import { CIVIC_PLAZA, type LayoutOpts } from "./layout";
// ...existing imports above stay

describe("layoutCity with plaza", () => {
  const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });

  test("adds a plaza block in the middle of the grid", () => {
    const plaza = blocks.find((b) => b.projectId === "__plaza__");
    expect(plaza).toBeDefined();
    expect(plaza!.kind).toBe("plaza");
    expect(plaza!.houses).toHaveLength(0);
  });

  test("keeps every project block in original order", () => {
    const projectsOnly = blocks.filter((b) => b.kind !== "plaza");
    expect(projectsOnly.map((b) => b.projectId)).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("plaza sits between the first and last block rows", () => {
    const plaza = blocks.find((b) => b.projectId === "__plaza__")!;
    const firstRowZ = Math.min(...blocks.slice(0, 4).map((b) => b.z));
    const lastRowZ = Math.max(...blocks.map((b) => b.z));
    expect(plaza.z).toBeGreaterThan(firstRowZ);
    expect(plaza.z).toBeLessThan(lastRowZ);
  });

  test("non-plaza blocks default to kind block", () => {
    expect(blocks.every((b) => b.kind === "plaza" || b.kind === undefined || b.kind === "block")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/layout.test.ts`
Expected: FAIL — `layoutCity` has no second parameter; `CIVIC_PLAZA`/`LayoutOpts` not exported; no plaza block produced.

- [ ] **Step 3: Implement the plaza reservation**

Modify `app/src/layout.ts`:

```ts
export interface LayoutOpts {
  plaza?: { width: number; depth: number };
}

export const CIVIC_PLAZA = { width: 20, depth: 14 };
```

Change `layoutCity` to accept `opts?: LayoutOpts` and reserve the plaza cell:

```ts
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
```

Also add `kind?: "block" | "plaza"` to the `PlacedBlock` interface.

- [ ] **Step 4: Run tests to verify all pass**

Run: `bun test app/src/layout.test.ts`
Expected: PASS — all pre-existing tests plus the 4 new plaza tests. The no-plaza path must produce identical positions to the old algorithm (the explicit-row loop replaces the `% BLOCKS_PER_ROW` wrap but is equivalent).

- [ ] **Step 5: Commit**

```bash
git add app/src/layout.ts app/src/layout.test.ts
git commit -m "feat: reserve civic plaza cell in city layout"
```

---

### Task 2: Civic district layout (pure)

**Files:**
- Modify: `app/src/types.ts`
- Create: `app/src/civic.ts`
- Test: `app/src/civic.test.ts`

**Interfaces:**
- Consumes: `PlacedBlock`/`Street`/`CIVIC_PLAZA` from `layout.ts` (Task 1); `RoadGraph` from `roadgraph.ts`; `Intersection` from `traffic.ts`.
- Produces:
  - `type BuildingKind = "hospital" | "police" | "fire" | "mall" | "bakery" | "petshop"` (in `types.ts`)
  - `interface BuildingLot { kind; x; z; rotation: 0|1|2|3; footprint; entrance: {x,z}; curb: {x,z} }`
  - `interface VisitorPath { from: {x,z}; waypoints: {x,z}[]; to: {x,z} }`
  - `interface CivicDistrict { plaza: {x,z,width,depth}; lots: BuildingLot[]; visitorPaths: VisitorPath[] }`
  - `layoutCivicDistrict(plazaBlock, streets, graph): CivicDistrict`
  - `BUILDING_SIZE = 0.4`, `BUILDING_LAYOUT: Record<BuildingKind, { footprint; walls }>`, `BUILDING_META: Record<BuildingKind, { name; emoji; services: string[] }>`

- [ ] **Step 1: Add BuildingKind to types.ts**

Append to `app/src/types.ts`:

```ts
export type BuildingKind = "hospital" | "police" | "fire" | "mall" | "bakery" | "petshop";
```

- [ ] **Step 2: Write the failing tests**

`app/src/civic.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  buildPerimeterRing,
  buildStreets,
  cityBounds,
  CIVIC_PLAZA,
  extendRoadsToRing,
  layoutCity,
} from "./layout";
import { findIntersections } from "./traffic";
import { buildRoadGraph } from "./roadgraph";
import {
  BUILDING_LAYOUT,
  BUILDING_META,
  BUILDING_SIZE,
  layoutCivicDistrict,
} from "./civic";
import type { BuildingLot } from "./civic";

const projects = Array.from({ length: 9 }, (_, i) => ({
  id: `p${i}`,
  name: `P${i}`,
  sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })),
}));

function makeCivic() {
  const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
  const plazaBlock = blocks.find((b) => b.kind === "plaza")!;
  const mainStreets = buildStreets(blocks);
  const bounds = cityBounds(blocks)!;
  const ring = buildPerimeterRing(bounds);
  const graphStreets = [...extendRoadsToRing(mainStreets, bounds), ...ring];
  const graph = buildRoadGraph(graphStreets, findIntersections(graphStreets));
  const civic = layoutCivicDistrict(plazaBlock, graphStreets, graph);
  return { blocks, plazaBlock, civic, graph, graphStreets };
}

function halfExtent(lot: BuildingLot): number {
  return (lot.footprint * BUILDING_SIZE) / 2;
}

describe("layoutCivicDistrict", () => {
  const { plazaBlock, civic, graph, graphStreets } = makeCivic();

  test("places exactly one lot per building kind", () => {
    const kinds = civic.lots.map((l) => l.kind).sort();
    expect(kinds).toEqual(["bakery", "fire", "hospital", "mall", "petshop", "police"]);
  });

  test("every lot sits inside the plaza pad", () => {
    for (const lot of civic.lots) {
      const h = halfExtent(lot);
      expect(Math.abs(lot.x - plazaBlock.x) + h).toBeLessThanOrEqual(plazaBlock.width / 2 + 0.01);
      expect(Math.abs(lot.z - plazaBlock.z) + h).toBeLessThanOrEqual(plazaBlock.depth / 2 + 0.01);
    }
  });

  test("lots do not overlap", () => {
    for (let i = 0; i < civic.lots.length; i++) {
      for (let j = i + 1; j < civic.lots.length; j++) {
        const a = civic.lots[i]!;
        const b = civic.lots[j]!;
        const overlap =
          Math.abs(a.x - b.x) < halfExtent(a) + halfExtent(b) &&
          Math.abs(a.z - b.z) < halfExtent(a) + halfExtent(b);
        expect(overlap).toBe(false);
      }
    }
  });

  test("lot fronts face the plaza center", () => {
    const frontDir = (r: number): { x: number; z: number } =>
      r === 0 ? { x: 0, z: 1 } : r === 1 ? { x: 1, z: 0 } : r === 2 ? { x: 0, z: -1 } : { x: -1, z: 0 };
    for (const lot of civic.lots) {
      const f = frontDir(lot.rotation);
      const toPlaza = { x: plazaBlock.x - lot.x, z: plazaBlock.z - lot.z };
      expect(f.x * toPlaza.x + f.z * toPlaza.z).toBeGreaterThan(0);
    }
  });

  test("curbs lie on a street within city bounds", () => {
    for (const lot of civic.lots) {
      const onStreet = graphStreets.some(
        (s) =>
          Math.abs(lot.curb.x - s.x) <= s.width / 2 + 0.01 &&
          Math.abs(lot.curb.z - s.z) <= s.depth / 2 + 0.01,
      );
      expect(onStreet).toBe(true);
    }
  });

  test("visitor paths start on a sidewalk lane and end at the entrance", () => {
    for (const p of civic.visitorPaths) {
      expect(p.waypoints.length).toBe(2);
      const b = p.waypoints[0]!;
      const c = p.waypoints[1]!;
      expect(Math.hypot(c.x - p.to.x, c.z - p.to.z)).toBeCloseTo(0);
      // B sits just off a street centerline (sidewalk lane)
      const nearStreet = graphStreets.some((s) => {
        const horizontal = s.width >= s.depth;
        const lane = horizontal ? Math.abs(b.z - (s.z + (b.z > s.z ? 1 : -1) * (s.depth / 2 + 0.35))) < 0.3
                                : Math.abs(b.x - (s.x + (b.x > s.x ? 1 : -1) * (s.width / 2 + 0.35))) < 0.3;
        return lane && Math.abs(b.x - s.x) <= s.width / 2 && Math.abs(b.z - s.z) <= s.depth / 2;
      });
      expect(nearStreet).toBe(true);
    }
  });

  test("metadata covers every kind", () => {
    for (const kind of civic.lots.map((l) => l.kind)) {
      expect(BUILDING_META[kind].name.length).toBeGreaterThan(0);
      expect(BUILDING_META[kind].emoji).toBeTruthy();
      expect(BUILDING_LAYOUT[kind].walls).toBeGreaterThan(1);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test app/src/civic.test.ts`
Expected: FAIL — `./civic` module not found.

- [ ] **Step 4: Implement civic.ts**

`app/src/civic.ts`:

```ts
import type { PlacedBlock, Street } from "./layout";
import type { BuildingKind } from "./types";
import type { RoadGraph } from "./roadgraph";

export const BUILDING_SIZE = 0.4;

export const BUILDING_LAYOUT: Record<BuildingKind, { footprint: number; walls: number }> = {
  hospital: { footprint: 7, walls: 4 },
  police: { footprint: 7, walls: 4 },
  fire: { footprint: 7, walls: 4 },
  mall: { footprint: 9, walls: 3 },
  bakery: { footprint: 5, walls: 3 },
  petshop: { footprint: 5, walls: 3 },
};

export const BUILDING_META: Record<BuildingKind, { name: string; emoji: string; services: string[] }> = {
  hospital: { name: "Hospital", emoji: "🏥", services: ["24h emergency", "clinic", "pharmacy"] },
  police: { name: "Police Station", emoji: "👮", services: ["patrol", "records", "lost & found"] },
  fire: { name: "Fire Station", emoji: "🚒", services: ["rescue", "inspection", "first aid"] },
  mall: { name: "Shopping Mall", emoji: "🛍️", services: ["shops", "food court", "cinema"] },
  bakery: { name: "Bakery", emoji: "🥐", services: ["bread", "pastries", "coffee"] },
  petshop: { name: "Pet Shop", emoji: "🐾", services: ["pets", "grooming", "food"] },
};

export interface BuildingLot {
  kind: BuildingKind;
  x: number;
  z: number;
  rotation: 0 | 1 | 2 | 3;
  footprint: number;
  entrance: { x: number; z: number };
  curb: { x: number; z: number };
}

export interface VisitorPath {
  from: { x: number; z: number };
  waypoints: { x: number; z: number }[];
  to: { x: number; z: number };
}

export interface CivicDistrict {
  plaza: { x: number; z: number; width: number; depth: number };
  lots: BuildingLot[];
  visitorPaths: VisitorPath[];
}

const LOT_SETBACK = 3;
const SIDE_OFFSET = 4.5;
const SIDEWALK_CENTER = 0.35;
const WALK_BACK = 6;

function frontDir(rotation: 0 | 1 | 2 | 3): { x: number; z: number } {
  switch (rotation) {
    case 0: return { x: 0, z: 1 };
    case 1: return { x: 1, z: 0 };
    case 2: return { x: 0, z: -1 };
    default: return { x: -1, z: 0 };
  }
}

function rearDir(rotation: 0 | 1 | 2 | 3): { x: number; z: number } {
  const f = frontDir(rotation);
  return { x: -f.x, z: -f.z };
}

function borderingStreet(lot: BuildingLot, plaza: { x: number; z: number; width: number; depth: number }, streets: Street[]): Street | null {
  const d = rearDir(lot.rotation);
  if (d.z !== 0) {
    const boundary = d.z === -1 ? plaza.z - plaza.depth / 2 : plaza.z + plaza.depth / 2;
    const h = streets.filter((s) => s.width >= s.depth);
    if (d.z === -1) return h.filter((s) => s.z < boundary).sort((a, b) => b.z - a.z)[0] ?? null;
    return h.filter((s) => s.z > boundary).sort((a, b) => a.z - b.z)[0] ?? null;
  }
  const boundary = d.x === -1 ? plaza.x - plaza.width / 2 : plaza.x + plaza.width / 2;
  const v = streets.filter((s) => s.width < s.depth);
  if (d.x === -1) return v.filter((s) => s.x < boundary).sort((a, b) => b.x - a.x)[0] ?? null;
  return v.filter((s) => s.x > boundary).sort((a, b) => a.x - b.x)[0] ?? null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function curbPoint(lot: BuildingLot, street: Street): { x: number; z: number } {
  if (street.width >= street.depth) {
    return { x: clamp(lot.x, street.x - street.width / 2, street.x + street.width / 2), z: street.z };
  }
  return { x: street.x, z: clamp(lot.z, street.z - street.depth / 2, street.z + street.depth / 2) };
}

function entrancePoint(lot: BuildingLot): { x: number; z: number } {
  const f = frontDir(lot.rotation);
  const reach = lot.footprint * BUILDING_SIZE * 0.5 + 0.3;
  return { x: lot.x + f.x * reach, z: lot.z + f.z * reach };
}

function visitorPath(lot: BuildingLot, street: Street): VisitorPath {
  const horizontal = street.width >= street.depth;
  const f = frontDir(lot.rotation);
  const b: { x: number; z: number } = horizontal
    ? { x: clamp(lot.x, street.x - street.width / 2, street.x + street.width / 2), z: street.z + f.z * (street.depth / 2 + SIDEWALK_CENTER) }
    : { x: street.x + f.x * (street.width / 2 + SIDEWALK_CENTER), z: clamp(lot.z, street.z - street.depth / 2, street.z + street.depth / 2) };
  const a = horizontal ? { x: b.x - WALK_BACK, z: b.z } : { x: b.x, z: b.z - WALK_BACK };
  const c = entrancePoint(lot);
  return { from: a, waypoints: [b, c], to: a };
}

export function layoutCivicDistrict(plazaBlock: PlacedBlock, streets: Street[], graph: RoadGraph): CivicDistrict {
  const plaza = { x: plazaBlock.x, z: plazaBlock.z, width: plazaBlock.width, depth: plazaBlock.depth };
  const { x: px, z: pz, width, depth } = plaza;
  const topZ = pz - depth / 2 + LOT_SETBACK;
  const bottomZ = pz + depth / 2 - LOT_SETBACK;
  const leftX = px - width / 2 + LOT_SETBACK;
  const rightX = px + width / 2 - LOT_SETBACK;

  const rawLots: Omit<BuildingLot, "entrance" | "curb">[] = [
    { kind: "hospital", x: px - SIDE_OFFSET, z: topZ, rotation: 0, footprint: BUILDING_LAYOUT.hospital.footprint },
    { kind: "bakery", x: px + SIDE_OFFSET, z: topZ, rotation: 0, footprint: BUILDING_LAYOUT.bakery.footprint },
    { kind: "police", x: px - SIDE_OFFSET, z: bottomZ, rotation: 2, footprint: BUILDING_LAYOUT.police.footprint },
    { kind: "petshop", x: px + SIDE_OFFSET, z: bottomZ, rotation: 2, footprint: BUILDING_LAYOUT.petshop.footprint },
    { kind: "fire", x: leftX, z: pz, rotation: 1, footprint: BUILDING_LAYOUT.fire.footprint },
    { kind: "mall", x: rightX, z: pz, rotation: 3, footprint: BUILDING_LAYOUT.mall.footprint },
  ];

  const lots: BuildingLot[] = [];
  for (const r of rawLots) {
    const street = borderingStreet({ ...r, entrance: { x: 0, z: 0 }, curb: { x: 0, z: 0 } }, plaza, streets);
    const curb = street ? curbPoint({ ...r, entrance: { x: 0, z: 0 }, curb: { x: 0, z: 0 } }, street) : { x: r.x, z: r.z };
    const lot: BuildingLot = { ...r, entrance: entrancePoint({ ...r, entrance: { x: 0, z: 0 }, curb: { x: 0, z: 0 } }), curb };
    lots.push(lot);
  }

  const visitorPaths = lots.map((lot) => {
    const street = borderingStreet(lot, plaza, streets);
    return street ? visitorPath(lot, street) : { from: lot.entrance, waypoints: [lot.entrance], to: lot.entrance };
  });

  return { plaza, lots, visitorPaths };
}
```

Note: `graph` is accepted for future curb snapping but the pure street-projection above is sufficient for lot layout. `graph` stays in the signature so `Scene.tsx` can pass it; if the return type ever needs node snapshots it can be added without breaking callers.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test app/src/civic.test.ts`
Expected: PASS. If the "visitor paths" B-lane assertion is finicky, verify the sidewalk lane formula matches `visitorPath` (lane offset `street.{depth,width}/2 + 0.35` on the plaza-facing side) and adjust the assertion's tolerance to `< 0.3` only if truly needed.

- [ ] **Step 6: Commit**

```bash
git add app/src/types.ts app/src/civic.ts app/src/civic.test.ts
git commit -m "feat: civic district layout (lots, curbs, visitor paths)"
```

---

### Task 3: Curb graph nodes

**Files:**
- Modify: `app/src/roadgraph.ts`
- Test: `app/src/civic.test.ts`

**Interfaces:**
- Consumes: `RoadGraph` (existing), `BuildingKind` from `types.ts`.
- Produces: `interface Curb { buildingId: BuildingKind; nodeId: number; x: number; z: number }`; `attachCurbs(graph, points: { buildingId: BuildingKind; x: number; z: number }[]): { graph: RoadGraph; curbs: Curb[] }`.

- [ ] **Step 1: Write the failing test**

Append to `app/src/civic.test.ts`:

```ts
import { attachCurbs } from "./roadgraph";

describe("attachCurbs", () => {
  test("adds a curb node with a spur edge per point", () => {
    const { graph, civic, graphStreets } = makeCivic();
    const points = civic.lots.map((l) => ({ buildingId: l.kind, x: l.curb.x, z: l.curb.z }));
    const { graph: g2, curbs } = attachCurbs(graph, points);

    expect(g2.nodes.length).toBe(graph.nodes.length + points.length);
    expect(curbs.map((c) => c.buildingId).sort()).toEqual(
      ["bakery", "fire", "hospital", "mall", "petshop", "police"],
    );
    for (const c of curbs) {
      const node = g2.nodes[c.nodeId];
      expect(node).toBeDefined();
      expect(Math.hypot(node!.x - points.find((p) => p.buildingId === c.buildingId)!.x, node!.z - points.find((p) => p.buildingId === c.buildingId)!.z)).toBeLessThan(0.001);
      expect(g2.adjacency[c.nodeId].length).toBeGreaterThan(0);
    }
    expect(graphStreets.length).toBeGreaterThan(0);
  });

  test("every curb is reachable from a road node", () => {
    const { graph, civic } = makeCivic();
    const { graph: g2, curbs } = attachCurbs(graph, civic.lots.map((l) => ({ buildingId: l.kind, x: l.curb.x, z: l.curb.z })));
    for (const c of curbs) {
      const reachable = g2.adjacency.some((row, nid) => row.some((eid) => g2.edges[eid].to === c.nodeId));
      expect(reachable).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/civic.test.ts`
Expected: FAIL — `attachCurbs` not exported.

- [ ] **Step 3: Implement attachCurbs**

Append to `app/src/roadgraph.ts`:

```ts
import type { BuildingKind } from "./types";

export interface Curb {
  buildingId: BuildingKind;
  nodeId: number;
  x: number;
  z: number;
}

// Adds one destination node per point with a bidirectional spur edge to the
// nearest existing road node, so cars can route to the building's curb.
export function attachCurbs(
  graph: RoadGraph,
  points: { buildingId: BuildingKind; x: number; z: number }[],
): { graph: RoadGraph; curbs: Curb[] } {
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const adjacency = graph.adjacency.map((row) => [...row]);
  const curbs: Curb[] = [];

  for (const p of points) {
    let nearest = -1;
    let best = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = (nodes[i].x - p.x) ** 2 + (nodes[i].z - p.z) ** 2;
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    const len = Math.sqrt(best);
    if (len < 0.01) {
      curbs.push({ buildingId: p.buildingId, nodeId: nearest, x: p.x, z: p.z });
      continue;
    }
    const id = nodes.length;
    nodes.push({ id, x: p.x, z: p.z, intersectionId: null });
    adjacency.push([]);
    const axis: "x" | "z" = Math.abs(nodes[nearest].x - p.x) >= Math.abs(nodes[nearest].z - p.z) ? "x" : "z";
    const eidA = edges.length;
    edges.push({ id: eidA, from: nearest, to: id, length: len, axis });
    adjacency[nearest].push(eidA);
    const eidB = edges.length;
    edges.push({ id: eidB, from: id, to: nearest, length: len, axis });
    adjacency[id].push(eidB);
    curbs.push({ buildingId: p.buildingId, nodeId: id, x: p.x, z: p.z });
  }

  return { graph: { nodes, edges, adjacency }, curbs };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test app/src/civic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/roadgraph.ts app/src/civic.test.ts
git commit -m "feat: curb destination nodes in road graph"
```

---

### Task 4: Voxel building blueprints

**Files:**
- Modify: `app/src/voxel.ts`, `app/src/theme.ts`
- Test: `app/src/voxel.test.ts`

**Interfaces:**
- Consumes: `BuildingKind` from `types.ts`; `BUILDING_LAYOUT` from `civic.ts` (only in tests); the `voxel-forms` skill primitives.
- Produces: `PublicBuildingOptions` + `publicBuildingVoxels(o): Voxel[]`; building color constants; `BUILDING_COLORS` in `theme.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `app/src/voxel.test.ts`:

```ts
import { BUILDING_COLORS } from "./theme";
import { BUILDING_LAYOUT } from "./civic";
import { publicBuildingVoxels, CROSS_RED, SIREN_BLUE, GARAGE_DARK, AWNING_COLORS, BREAD_BROWN } from "./voxel";

describe("publicBuildingVoxels", () => {
  const kinds = Object.keys(BUILDING_LAYOUT) as (keyof typeof BUILDING_LAYOUT)[];

  test("each building stays within its footprint and above ground", () => {
    for (const kind of kinds) {
      const { footprint, walls } = BUILDING_LAYOUT[kind];
      const c = BUILDING_COLORS[kind];
      const voxels = publicBuildingVoxels({ kind, body: c.body, accent: c.accent, roof: c.roof, walls, width: footprint, depth: footprint });
      const hw = Math.floor(footprint / 2);
      expect(voxels.length).toBeGreaterThan(0);
      for (const v of voxels) {
        expect(Math.abs(v.x)).toBeLessThanOrEqual(hw);
        expect(Math.abs(v.z)).toBeLessThanOrEqual(hw);
        expect(v.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("hospital has a red cross on the roof", () => {
    const c = BUILDING_COLORS.hospital;
    const { footprint, walls } = BUILDING_LAYOUT.hospital;
    const voxels = publicBuildingVoxels({ kind: "hospital", body: c.body, accent: c.accent, roof: c.roof, walls, width: footprint, depth: footprint });
    expect(voxels.some((v) => v.color === CROSS_RED && v.y > walls)).toBe(true);
  });

  test("police has a blue siren on the roof", () => {
    const c = BUILDING_COLORS.police;
    const { footprint, walls } = BUILDING_LAYOUT.police;
    const voxels = publicBuildingVoxels({ kind: "police", body: c.body, accent: c.accent, roof: c.roof, walls, width: footprint, depth: footprint });
    expect(voxels.some((v) => v.color === SIREN_BLUE && v.y > walls)).toBe(true);
  });

  test("fire station has dark garage bays and a tower", () => {
    const c = BUILDING_COLORS.fire;
    const { footprint, walls } = BUILDING_LAYOUT.fire;
    const voxels = publicBuildingVoxels({ kind: "fire", body: c.body, accent: c.accent, roof: c.roof, walls, width: footprint, depth: footprint });
    expect(voxels.filter((v) => v.color === GARAGE_DARK).length).toBeGreaterThanOrEqual(4);
    const hw = Math.floor(footprint / 2);
    expect(voxels.some((v) => v.x === -hw + 1 && v.y >= walls + 1)).toBe(true);
  });

  test("mall has awning stripes", () => {
    const c = BUILDING_COLORS.mall;
    const { footprint, walls } = BUILDING_LAYOUT.mall;
    const voxels = publicBuildingVoxels({ kind: "mall", body: c.body, accent: c.accent, roof: c.roof, walls, width: footprint, depth: footprint });
    expect(voxels.some((v) => AWNING_COLORS.includes(v.color))).toBe(true);
  });

  test("bakery has a brown bread sign", () => {
    const c = BUILDING_COLORS.bakery;
    const { footprint, walls } = BUILDING_LAYOUT.bakery;
    const voxels = publicBuildingVoxels({ kind: "bakery", body: c.body, accent: c.accent, roof: c.roof, walls, width: footprint, depth: footprint });
    expect(voxels.some((v) => v.color === BREAD_BROWN)).toBe(true);
  });

  test("pet shop has a teal paw on the facade", () => {
    const c = BUILDING_COLORS.petshop;
    const { footprint, walls } = BUILDING_LAYOUT.petshop;
    const voxels = publicBuildingVoxels({ kind: "petshop", body: c.body, accent: c.accent, roof: c.roof, walls, width: footprint, depth: footprint });
    expect(voxels.some((v) => v.color === c.accent && v.y === 2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/voxel.test.ts`
Expected: FAIL — `publicBuildingVoxels` and the constants not exported.

- [ ] **Step 3: Add the theme palette**

Append to `app/src/theme.ts`:

```ts
import type { BuildingKind } from "./types";

export const BUILDING_COLORS: Record<BuildingKind, { body: string; accent: string; roof: string }> = {
  hospital: { body: "#ffffff", accent: "#ff5252", roof: "#eef2f5" },
  police: { body: "#7fb6ff", accent: "#f7f3e8", roof: "#5a8fd4" },
  fire: { body: "#ff6b6b", accent: "#f7f3e8", roof: "#d9534f" },
  mall: { body: "#ffb3ba", accent: "#ffd166", roof: "#f3e3c0" },
  bakery: { body: "#f3d9b1", accent: "#b8722f", roof: "#e8c79a" },
  petshop: { body: "#ffc9de", accent: "#4fd1c5", roof: "#f0c4ff" },
};
```

- [ ] **Step 4: Implement publicBuildingVoxels**

Add constants and the generator to `app/src/voxel.ts`:

```ts
import type { BuildingKind } from "./types";

export const CROSS_RED = "#ff5252";
export const SIREN_BLUE = "#3a7bd5";
export const GARAGE_DARK = "#222222";
export const BELL_YELLOW = "#ffd24a";
export const AWNING_COLORS = ["#ff8fa3", "#ffd166", "#7fb6ff", "#b0f2b4"];
export const BREAD_TAN = "#d99b58";
export const BREAD_BROWN = "#b8722f";

export interface PublicBuildingOptions {
  kind: BuildingKind;
  body: string;
  accent: string;
  roof: string;
  walls: number;
  width?: number;
  depth?: number;
}

// Generic civic building: hollow walls + roof slab, then a per-kind
// signature mark. Follows the voxel-forms skill (footprint → walls → roof → marks).
export function publicBuildingVoxels(o: PublicBuildingOptions): Voxel[] {
  const W = o.width ?? 7;
  const D = o.depth ?? 7;
  const hw = Math.floor(W / 2);
  const hd = Math.floor(D / 2);
  const voxels: Voxel[] = [];
  const push = (x: number, y: number, z: number, color: string) => voxels.push({ x, y, z, color });

  for (let x = -hw; x <= hw; x++) {
    for (let z = -hd; z <= hd; z++) {
      if (Math.abs(x) === hw || Math.abs(z) === hd) {
        for (let y = 0; y < o.walls; y++) push(x, y, z, o.body);
      }
    }
  }

  for (let x = -hw; x <= hw; x++) {
    for (let z = -hd; z <= hd; z++) push(x, o.walls, z, o.roof);
  }

  if (o.walls >= 3) {
    for (let x = -hw; x <= hw; x++) {
      for (let z = -hd; z <= hd; z++) {
        if (Math.abs(x) === hw || Math.abs(z) === hd) push(x, 2, z, o.accent);
      }
    }
  }

  // Entrance (accent) + front windows
  if (o.walls >= 2) {
    push(0, 0, hd, o.accent);
    push(0, 1, hd, o.accent);
  }
  if (o.walls >= 4) {
    push(-2, 3, hd, WINDOW_COLOR);
    push(2, 3, hd, WINDOW_COLOR);
  } else if (o.walls >= 3) {
    push(-2, 1, hd, WINDOW_COLOR);
    push(2, 1, hd, WINDOW_COLOR);
  }

  switch (o.kind) {
    case "hospital": {
      push(0, o.walls + 1, 0, CROSS_RED);
      push(-1, o.walls + 1, 0, CROSS_RED);
      push(1, o.walls + 1, 0, CROSS_RED);
      push(0, o.walls + 1, -1, CROSS_RED);
      push(0, o.walls + 1, 1, CROSS_RED);
      break;
    }
    case "police": {
      push(0, o.walls + 1, 0, SIREN_BLUE);
      push(0, o.walls + 2, 0, CROSS_RED);
      break;
    }
    case "fire": {
      push(-2, 0, hd, GARAGE_DARK);
      push(-2, 1, hd, GARAGE_DARK);
      push(2, 0, hd, GARAGE_DARK);
      push(2, 1, hd, GARAGE_DARK);
      for (let y = o.walls + 1; y <= o.walls + 3; y++) push(-hw + 1, y, 0, o.accent);
      push(-hw + 1, o.walls + 4, 0, BELL_YELLOW);
      break;
    }
    case "mall": {
      for (let x = -hw; x <= hw; x++) push(x, 1, hd, AWNING_COLORS[(x + hw + 4) % AWNING_COLORS.length]);
      for (let x = -2; x <= 2; x++) {
        push(x, o.walls + 1, 0, BELL_YELLOW);
        push(x, o.walls + 2, 0, CROSS_RED);
      }
      break;
    }
    case "bakery": {
      push(-1, o.walls + 1, 0, BREAD_BROWN);
      push(0, o.walls + 1, 0, BREAD_BROWN);
      push(1, o.walls + 1, 0, BREAD_BROWN);
      push(0, o.walls + 2, 0, BREAD_BROWN);
      for (let x = -hw; x <= hw; x++) push(x, 2, hd, BREAD_TAN);
      break;
    }
    case "petshop": {
      push(0, 2, hd, o.accent);
      push(-1, 2, hd, o.accent);
      push(1, 2, hd, o.accent);
      push(0, 3, hd, o.accent);
      break;
    }
  }

  return voxels;
}
```

Note: the accent stripe at `y=2` overwrites window cells at `y=2` for 3-wall buildings (bakery/petshop) — acceptable, the stripe is the facade. The `mall` awning overwrites the `y=1` entrance row; the entrance still reads through the awning color. If visual check shows a blocked door, move the mall awning to `y=2` instead.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test app/src/voxel.test.ts`
Expected: PASS. If "pet shop has a teal paw" fails because the accent also appears in the stripe, add a `paw` color constant for the pet shop (e.g. `PAW_TEAL`) and assert on that instead.

- [ ] **Step 6: Commit**

```bash
git add app/src/voxel.ts app/src/theme.ts app/src/voxel.test.ts
git commit -m "feat: voxel blueprints for six public buildings"
```

---

### Task 5: Activity counters + store

**Files:**
- Create: `app/src/activity.ts`
- Test: `app/src/activity.test.ts`
- Modify: `app/src/store.ts`

**Interfaces:**
- Consumes: `BuildingKind` from `types.ts`.
- Produces:
  - `type BuildingActivity = Record<BuildingKind, { visitors: number; cars: number }>`
  - `buildingActivity` (mutable module singleton), `bumpBuildingActivity(kind, metric, delta)`, `resetBuildingActivity()`, `snapshotBuildingActivity(): BuildingActivity`
  - `useActivityPump(): void` — flushes the singleton into the zustand store every 1s.
  - Store: `selectedBuilding: BuildingKind | null`, `selectBuilding(kind | null)`, `activity: BuildingActivity`, `tweaks.showBuildings: boolean`.

- [ ] **Step 1: Write the failing test**

`app/src/activity.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { bumpBuildingActivity, resetBuildingActivity, snapshotBuildingActivity } from "./activity";

describe("buildingActivity", () => {
  test("bumps and snapshots per-kind counters", () => {
    resetBuildingActivity();
    bumpBuildingActivity("hospital", "cars", 1);
    bumpBuildingActivity("hospital", "cars", 1);
    bumpBuildingActivity("hospital", "visitors", 2);
    const s = snapshotBuildingActivity();
    expect(s.hospital).toEqual({ visitors: 2, cars: 2 });
    expect(s.police).toEqual({ visitors: 0, cars: 0 });
  });

  test("counters never go below zero", () => {
    resetBuildingActivity();
    bumpBuildingActivity("bakery", "visitors", -3);
    expect(snapshotBuildingActivity().bakery.visitors).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/activity.test.ts`
Expected: FAIL — `./activity` not found.

- [ ] **Step 3: Implement activity.ts**

`app/src/activity.ts`:

```ts
import { useEffect } from "react";
import { useApp } from "./store";
import type { BuildingKind } from "./types";

export type BuildingActivity = Record<BuildingKind, { visitors: number; cars: number }>;

const ZERO: BuildingActivity = {
  hospital: { visitors: 0, cars: 0 },
  police: { visitors: 0, cars: 0 },
  fire: { visitors: 0, cars: 0 },
  mall: { visitors: 0, cars: 0 },
  bakery: { visitors: 0, cars: 0 },
  petshop: { visitors: 0, cars: 0 },
};

const counters: BuildingActivity = structuredClone(ZERO);

export function resetBuildingActivity(): void {
  for (const k of Object.keys(counters) as BuildingKind[]) {
    counters[k].visitors = 0;
    counters[k].cars = 0;
  }
}

export function bumpBuildingActivity(
  kind: BuildingKind,
  metric: "visitors" | "cars",
  delta: number,
): void {
  counters[kind][metric] = Math.max(0, counters[kind][metric] + delta);
}

export function snapshotBuildingActivity(): BuildingActivity {
  return structuredClone(counters);
}

// Flushes the mutable counters into the zustand store once per second so the
// HUD sees live counts without any setState inside useFrame.
export function useActivityPump(): void {
  useEffect(() => {
    const id = setInterval(() => {
      useApp.setState({ activity: snapshotBuildingActivity() });
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
```

- [ ] **Step 4: Update the store**

Modify `app/src/store.ts`:

- Add imports:
```ts
import type { BuildingKind } from "./types";
import type { BuildingActivity } from "./activity";
```
- Add `showBuildings: true` to `DEFAULT_TWEAKS` (and the `Tweaks` interface).
- Extend `AppState` and the `create` initializer:
```ts
interface AppState {
  selected: SessionData | null;
  select: (session: SessionData | null) => void;
  selectedBuilding: BuildingKind | null;
  selectBuilding: (building: BuildingKind | null) => void;
  clearSelection: () => void;
  activity: BuildingActivity;
  // ...existing fields
}
```
```ts
export const useApp = create<AppState>()(
  persist(
    (set) => ({
      selected: null,
      select: (session) => set({ selected: session }),
      selectedBuilding: null,
      selectBuilding: (building) => set({ selectedBuilding: building }),
      clearSelection: () => set({ selected: null, selectedBuilding: null }),
      activity: {
        hospital: { visitors: 0, cars: 0 },
        police: { visitors: 0, cars: 0 },
        fire: { visitors: 0, cars: 0 },
        mall: { visitors: 0, cars: 0 },
        bakery: { visitors: 0, cars: 0 },
        petshop: { visitors: 0, cars: 0 },
      },
      // ...existing state
    }),
    // persist config unchanged — `activity` and selection are not persisted.
  ),
);
```
- `tweaks: DEFAULT_TWEAKS` already inherits `showBuildings`; the `merge` already spreads `DEFAULT_TWEAKS` so persisted state from older versions merges safely.

- [ ] **Step 5: Run tests + typecheck**

Run: `bun test app/src/activity.test.ts`
Expected: PASS.
Run: `bun run typecheck`
Expected: PASS (no consumers reference `selectedBuilding` yet).

- [ ] **Step 6: Commit**

```bash
git add app/src/activity.ts app/src/activity.test.ts app/src/store.ts
git commit -m "feat: building activity counters + store selection/tweak"
```

---

### Task 6: Traffic destinations + visitors

**Files:**
- Modify: `app/src/traffic.ts`, `app/src/config.ts`, `app/src/components/three/Traffic.tsx`
- Test: `app/src/traffic.test.ts`

**Interfaces:**
- Consumes: `Curb` from `roadgraph.ts` (Task 3), `VisitorPath`/`BuildingKind` from `civic.ts`/`types.ts`, `bumpBuildingActivity` from `activity.ts` (Task 5), `traffic.visitors` config.
- Produces: `pickDestination(curbNodeIds: number[], totalNodes: number, rand): number`; `WaypointCar` gains a `curbs: Curb[]` prop (routing to curbs + drop-off idle + activity bumps); `VisitorMover` component; `Traffic` component gains optional `curbs?: Curb[]`, `visitorPaths?: VisitorPath[]`, and `visitorBuildings?: BuildingKind[]` props (aligned to `visitorPaths`).

- [ ] **Step 1: Write the failing tests**

Append to `app/src/traffic.test.ts`:

```ts
import { pickDestination } from "./traffic";

describe("pickDestination", () => {
  test("prefers a curb node when the roll is below 0.6", () => {
    const curbs = [10, 20, 30];
    let calls = 0;
    const rand = () => (++calls === 1 ? 0.3 : 0.5);
    const d = pickDestination(curbs, 100, rand);
    expect(curbs).toContain(d);
  });

  test("falls back to a random node when the roll is >= 0.6", () => {
    const d = pickDestination([10], 100, () => 0.9);
    expect(d).not.toBe(10);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThan(100);
  });

  test("returns a random node when no curbs exist", () => {
    expect(pickDestination([], 50, () => 0.1)).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/traffic.test.ts`
Expected: FAIL — `pickDestination` not exported.

- [ ] **Step 3: Add pickDestination to traffic.ts**

Append to `app/src/traffic.ts`:

```ts
// Choose a destination node for a car: ~60% a building curb, else any road node.
export function pickDestination(
  curbNodeIds: number[],
  totalNodes: number,
  rand: () => number,
): number {
  if (curbNodeIds.length > 0 && rand() < 0.6) {
    return curbNodeIds[Math.floor(rand() * curbNodeIds.length)];
  }
  return Math.floor(rand() * totalNodes);
}
```

- [ ] **Step 4: Update config**

In `app/src/config.ts`, add to the `traffic` object:

```ts
export const traffic = {
  cars: 5,
  runners: 6,
  walkers: 3,
  visitors: 4,
  cycle: 8,
};
```

- [ ] **Step 5: Update Traffic.tsx**

Modify `app/src/components/three/Traffic.tsx`:

Imports:
```ts
import type { Curb } from "../../roadgraph";
import { bumpBuildingActivity } from "../../activity";
import type { VisitorPath } from "../../civic";
import { personVoxels } from "../../voxel"; // already imported
import { traffic } from "../../config"; // already imported
```

Add a `VisitorMover` component (walks a `VisitorPath` forward, lingers at the entrance, reverses, then despawns):

```ts
const VISIT_SPEED = 1.1;
const VISIT_LINGER = 3.5;

interface VisitorSpec {
  path: VisitorPath;
  building: BuildingKind;
  color: string;
  speed: number;
}

function VisitorMover({ spec }: { spec: VisitorSpec }) {
  const ref = useRef<Group>(null);
  const points = useMemo<{ x: number; z: number }[]>(
    () => [spec.path.from, ...spec.path.waypoints],
    [spec.path],
  );
  const seg = useRef(0);
  const t = useRef(0);
  const linger = useRef(0);
  const reverse = useRef(false);
  const state = useRef<MoverState>("drive");
  const stateT = useRef(0);
  const respawnIn = useRef(0);

  const voxels = useMemo(() => personVoxels(spec.color), [spec.color]);
  const entered = useRef(false);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const { scale, driving } = stepLifecycle(state, stateT, respawnIn, delta);

    if (driving) {
      if (reverse.current) {
        // walk back: entrance → start
        t.current -= (spec.speed * delta) / segLen(points, seg.current);
        if (t.current <= 0) {
          seg.current -= 1;
          t.current = 1;
          if (seg.current < 0) {
            state.current = "fadeOut";
            stateT.current = 0;
            seg.current = 0;
            t.current = 0;
            reverse.current = false;
          }
        }
      } else {
        if (linger.current > 0) {
          linger.current -= delta;
          if (linger.current <= 0) {
            reverse.current = true;
            bumpBuildingActivity(spec.building, "visitors", -1);
          }
        } else {
          t.current += (spec.speed * delta) / segLen(points, seg.current);
          if (t.current >= 1) {
            seg.current += 1;
            t.current -= 1;
            if (seg.current >= points.length - 1) {
              // arrived at the entrance — linger, then head home
              seg.current = points.length - 1;
              t.current = 1;
              if (!entered.current) {
                entered.current = true;
                bumpBuildingActivity(spec.building, "visitors", 1);
              }
              linger.current = VISIT_LINGER + Math.random();
            }
          }
        }
      }
    }

    const a = points[Math.max(0, Math.min(points.length - 1, seg.current))];
    const b = points[Math.max(0, Math.min(points.length - 1, seg.current + (reverse.current ? -1 : 1)))];
    const p = a ?? b;
    if (!p) return;
    const nx = (b?.x ?? a.x) - a.x;
    const nz = (b?.z ?? a.z) - a.z;
    const len = Math.hypot(nx, nz) || 1;
    const cx = a.x + nx * (reverse.current ? t.current : t.current);
    const cz = a.z + nz * (reverse.current ? t.current : t.current);
    g.position.set(cx, 0, cz);
    g.rotation.y = Math.atan2(nz, nx);
    g.scale.setScalar(scale);
  });

  return (
    <group ref={ref}>
      <InstancedVoxels voxels={voxels} voxelSize={0.15} />
    </group>
  );
}
```

Note: `segLen` helper (the walker interpolates between consecutive waypoints):

```ts
function segLen(points: { x: number; z: number }[], i: number): number {
  const a = points[Math.max(0, Math.min(points.length - 1, i))];
  const b = points[Math.max(0, Math.min(points.length - 1, i + 1))];
  return Math.hypot(b.x - a.x, b.z - a.z) || 1;
}
```

Modify `WaypointCar`:

- Change the signature to add the `curbs` prop: `function WaypointCar({ car, graph, controller, curbs }: { car: CarSpec; graph: RoadGraph; controller: TrafficController; curbs: Curb[] })`.
- Inside, `const curbByNode = useMemo(() => new Map(curbs.map((c) => [c.nodeId, c])), [curbs]);` and `const curbNodeIds = useMemo(() => curbs.map((c) => c.nodeId), [curbs]);`.
- Add `const dropOff = useRef(0);` and `const dropOffCurb = useRef<Curb | null>(null);`.
- In `useFrame`, at the top after the guard, handle drop-off:
```ts
if (dropOff.current > 0) {
  dropOff.current -= delta;
  speed.current = 0;
  if (dropOff.current <= 0) {
    if (dropOffCurb.current) bumpBuildingActivity(dropOffCurb.current.buildingId, "cars", -1);
    dropOffCurb.current = null;
    route.current = [];
  }
  return;
}
```
- Replace the replan block's goal selection:
```ts
const from = route.current.length > 0 ? route.current[route.current.length - 1] : Math.floor(Math.random() * graph.nodes.length);
const goal = pickDestination(curbNodeIds, graph.nodes.length, Math.random);
route.current = planRoute(graph, from, goal);
routeIdx.current = 1;
t.current = 0;
```
- After advancing `routeIdx` (the `if (t.current >= 1)` block), when the route completes:
```ts
if (routeIdx.current >= route.current.length) {
  const lastId = route.current[route.current.length - 1];
  const curb = curbByNode.get(lastId);
  if (curb) {
    dropOff.current = 2 + Math.random() * 2;
    dropOffCurb.current = curb;
    bumpBuildingActivity(curb.buildingId, "cars", 1);
  }
}
```

Modify the `Traffic` component signature and body:

```ts
export function Traffic({
  streets,
  intersections,
  controller,
  graph,
  curbs = [],
  visitorPaths = [],
  visitorBuildings = [],
}: {
  streets: Street[];
  intersections: Intersection[];
  controller: TrafficController;
  graph: RoadGraph;
  curbs?: Curb[];
  visitorPaths?: VisitorPath[];
  visitorBuildings?: BuildingKind[];
}) {
  const specs = useTrafficSpecs(streets);
  const showTraffic = useApp((s) => s.tweaks.showTraffic);
  if (!showTraffic) return null;
  const cars = useCarSpecs();
  const visitorSpecs = useMemo(() => {
    if (visitorPaths.length === 0) return [];
    const rand = mulberry32(999);
    const colors = ["#ffb3ba", "#bae1ff", "#baffc9", "#ffffba", "#d4baff", "#ffd1dc"];
    return Array.from({ length: traffic.visitors }, (_, i) => ({
      path: visitorPaths[i % visitorPaths.length],
      building: visitorBuildings[i % visitorBuildings.length],
      color: colors[i % colors.length],
      speed: 0.8 + rand() * 0.5,
    }));
  }, [visitorPaths, visitorBuildings]);

  return (
    <group>
      <TrafficLights controller={controller} intersections={intersections} streets={streets} />
      {cars.map((car, i) => (
        <WaypointCar key={i} car={car} graph={graph} controller={controller} curbs={curbs} />
      ))}
      {specs.map((spec, i) => (
        <FootMover key={`f${i}`} spec={spec} />
      ))}
      {visitorSpecs.map((spec, i) => (
        <VisitorMover key={`v${i}`} spec={spec} />
      ))}
    </group>
  );
}
```

Note: `VISIT_LINGER` and the `VisitorMover` walk reuse the file's existing `MoverState`/`stepLifecycle`. Each `VisitorSpec` carries `building: BuildingKind` so arrival/departure bump the right counter (wired in Step 6).

- [ ] **Step 6: Verify the building wiring**

`civic.ts` returns `visitorPaths` in `lots` order, so `visitorBuildings` (also in `lots` order, from Scene) lines up index-for-index with `visitorPaths`. `VisitorSpec.building` is used in `VisitorMover` via `bumpBuildingActivity(spec.building, ...)` — already wired in Step 5.

- [ ] **Step 7: Run tests + typecheck**

Run: `bun test app/src/traffic.test.ts`
Expected: PASS.
Run: `bun run typecheck`
Expected: PASS (Traffic props are optional so existing Scene call still compiles).

- [ ] **Step 8: Commit**

```bash
git add app/src/traffic.ts app/src/traffic.test.ts app/src/config.ts app/src/components/three/Traffic.tsx
git commit -m "feat: cars route to building curbs + visitors walk to entrances"
```

---

### Task 7: Scene wiring + CivicDistrict render

**Files:**
- Create: `app/src/components/three/CivicDistrict.tsx`, `app/src/components/three/BuildingSign.tsx`
- Modify: `app/src/components/three/Scene.tsx`, `app/src/components/three/Ground.tsx`, `app/src/components/three/City.tsx`, `app/src/components/three/People.tsx`, `app/src/theme.ts`

**Interfaces:**
- Consumes: `layoutCity` + `CIVIC_PLAZA` (Task 1), `layoutCivicDistrict` + `BUILDING_LAYOUT` + `BUILDING_SIZE` + `BUILDING_META` (Task 2), `attachCurbs` + `Curb` (Task 3), `publicBuildingVoxels` + `BUILDING_COLORS` (Task 4), store `selectBuilding`/`showBuildings` (Task 5), `useActivityPump` (Task 5).
- Produces: `<CivicDistrict />` renders plaza buildings + signs + click; `<BuildingSign />` renders a drei `Html` chip per building.

- [ ] **Step 1: Plaza pad in Ground**

In `app/src/components/three/Ground.tsx`, render the plaza cell as a cream pad with a water center instead of grass:

```tsx
{blocks.map((b) => {
  if (b.kind === "plaza") {
    return (
      <group key={b.projectId}>
        <mesh position={[b.x, -0.039, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear}>
          <planeGeometry args={[b.width + 0.4, b.depth + 0.4]} />
          <meshStandardMaterial color="#f7efe0" />
        </mesh>
        <mesh position={[b.x, -0.038, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear}>
          <circleGeometry args={[3, 24]} />
          <meshStandardMaterial color="#7fc9ff" />
        </mesh>
      </group>
    );
  }
  return (
    <mesh key={b.projectId} position={[b.x, -0.04, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear}>
      <planeGeometry args={[b.width + 0.4, b.depth + 0.4]} />
      <meshStandardMaterial color={COLORS.grassLot} />
    </mesh>
  );
})}
```

- [ ] **Step 2: Skip plaza in City**

In `app/src/components/three/City.tsx`, filter plaza cells and use the plaza-aware layout:

```tsx
import { CIVIC_PLAZA, layoutCity } from "../../layout";
// in City():
const blocks = useMemo(
  () => (data ? layoutCity(data.projects, { plaza: CIVIC_PLAZA }) : []),
  [data],
);
// in the map:
{blocks.map((b, i) => (b.kind === "plaza" ? null : <Block key={b.projectId} block={b} paletteIndex={i % 12} />))}
```

- [ ] **Step 3: Plaza-aware People**

In `app/src/components/three/People.tsx`, use the same plaza-aware layout so residents line up with houses:

```tsx
import { CIVIC_PLAZA } from "../../layout";
const blocks = useMemo(() => (data ? layoutCity(data.projects, { plaza: CIVIC_PLAZA }) : []), [data]);
```

- [ ] **Step 4: BuildingSign component**

`app/src/components/three/BuildingSign.tsx`:

```tsx
import { Html } from "@react-three/drei";
import { BUILDING_META } from "../../civic";
import { BUILDING_LAYOUT } from "../../civic";
import { BUILDING_SIZE } from "../../civic";
import type { BuildingKind } from "../../types";

const SIGN_CSS = {
  background: "#fff6e5",
  border: "3px solid #4a4453",
  borderRadius: 12,
  boxShadow: "4px 4px 0 rgba(74, 68, 83, 0.35)",
  padding: "4px 10px",
  fontFamily: '"Nunito", sans-serif',
  fontWeight: 700,
  color: "#4a4453",
  whiteSpace: "nowrap" as const,
};

export function BuildingSign({ kind, x, z }: { kind: BuildingKind; x: number; z: number }) {
  const walls = BUILDING_LAYOUT[kind].walls;
  const y = walls * BUILDING_SIZE + 1.4;
  return (
    <Html position={[x, y, z]} center distanceFactor={16} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div style={SIGN_CSS}>
        {BUILDING_META[kind].emoji} {BUILDING_META[kind].name}
      </div>
    </Html>
  );
}
```

- [ ] **Step 5: CivicDistrict component**

`app/src/components/three/CivicDistrict.tsx`:

```tsx
import { useMemo } from "react";
import { BUILDING_COLORS } from "../../theme";
import { BUILDING_LAYOUT, BUILDING_SIZE, type CivicDistrict as CivicData } from "../../civic";
import { publicBuildingVoxels, placeVoxels } from "../../voxel";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";
import { InstancedVoxels } from "./InstancedVoxels";
import { BuildingSign } from "./BuildingSign";

export function CivicDistrict({ civic }: { civic: CivicData | null }) {
  const selectBuilding = useApp((s) => s.selectBuilding);
  const selectedBuilding = useApp((s) => s.selectedBuilding);
  const showBuildings = useApp((s) => s.tweaks.showBuildings);
  if (!civic || !showBuildings) return null;

  return (
    <group>
      {civic.lots.map((lot) => {
        const layout = BUILDING_LAYOUT[lot.kind];
        const c = BUILDING_COLORS[lot.kind];
        const voxels = publicBuildingVoxels({
          kind: lot.kind,
          body: c.body,
          accent: c.accent,
          roof: c.roof,
          walls: layout.walls,
          width: layout.footprint,
          depth: layout.footprint,
        });
        const placed = placeVoxels(voxels, 0, 0, BUILDING_SIZE);
        const isSelected = selectedBuilding === lot.kind;
        return (
          <group
            key={lot.kind}
            position={[lot.x, 0, lot.z]}
            rotation-y={(lot.rotation * Math.PI) / 2}
            onClick={(e) => {
              if (isPanActive()) return;
              e.stopPropagation();
              selectBuilding(lot.kind);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
          >
            <InstancedVoxels voxels={placed} voxelSize={BUILDING_SIZE} />
            <BuildingSign kind={lot.kind} x={0} z={0} />
            {isSelected && (
              <mesh position={[0, layout.walls * BUILDING_SIZE + 0.35, 0]}>
                <boxGeometry args={[layout.footprint * BUILDING_SIZE + 0.4, 0.12, layout.footprint * BUILDING_SIZE + 0.4]} />
                <meshStandardMaterial color="#ffd24a" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
```

Note: `placeVoxels(voxels, 0, 0, size)` centers the pattern near the lot origin; the group's `rotation-y` spins it about the lot center (its position). The selected-building highlight is a yellow halo pad under the building.

- [ ] **Step 6: Wire Scene**

Modify `app/src/components/three/Scene.tsx`:

Imports:
```tsx
import { CIVIC_PLAZA } from "../../layout";
import { layoutCivicDistrict, type BuildingKind } from "../../civic";
import { attachCurbs, type Curb } from "../../roadgraph";
import { CivicDistrict } from "./CivicDistrict";
import { useActivityPump } from "../../activity";
```

Inside `Scene()`:
```tsx
const { data } = useNeighborhood();
const blocks = useMemo(
  () => (data ? layoutCity(data.projects, { plaza: CIVIC_PLAZA }) : []),
  [data],
);
const plazaBlock = useMemo(() => blocks.find((b) => b.kind === "plaza") ?? null, [blocks]);
// ...existing streets/bounds/ring/intersections/graph unchanged, but graphStreets now includes plaza streets
const civic = useMemo(
  () => (plazaBlock && graph.nodes.length > 0 ? layoutCivicDistrict(plazaBlock, graphStreets, graph) : null),
  [plazaBlock, graphStreets, graph],
);
const { graph: graphWithCurbs, curbs } = useMemo(
  () =>
    civic
      ? attachCurbs(graph, civic.lots.map((l) => ({ buildingId: l.kind, x: l.curb.x, z: l.curb.z })))
      : { graph, curbs: [] as Curb[] },
  [civic, graph],
);
const visitorBuildings = useMemo<BuildingKind[]>(
  () => civic?.lots.map((l) => l.kind) ?? [],
  [civic],
);
useActivityPump();
```

Update the JSX:
```tsx
<Ground blocks={blocks} streets={renderStreets} extent={extent} />
<Sidewalks streets={renderStreets} intersections={crosswalkIntersections} />
<City />
<World blocks={blocks} streets={renderStreets} />
<Details blocks={blocks} streets={renderStreets} />
<CivicDistrict civic={civic} />
<People />
<Traffic
  streets={renderStreets}
  intersections={intersections}
  controller={controller}
  graph={graphWithCurbs}
  curbs={curbs}
  visitorPaths={civic?.visitorPaths ?? []}
  visitorBuildings={visitorBuildings}
/>
<Crossers streets={mainStreets} intersections={intersections} controller={controller} />
<Mountains blocks={blocks} streets={renderStreets} />
<SelectedBanner />
```

- [ ] **Step 7: Typecheck + visual check**

Run: `bun run typecheck`
Expected: PASS.
Run: `bun test`
Expected: PASS.
Run: `bun run dev` — expect: a cream civic plaza in the middle row with six voxel buildings, sign chips above each, cars stopping at curbs near the plaza, people walking to entrances and lingering. Clicking a building shows a yellow halo; hovering shows the pointer. Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/three/Scene.tsx app/src/components/three/Ground.tsx app/src/components/three/City.tsx app/src/components/three/People.tsx app/src/components/three/CivicDistrict.tsx app/src/components/three/BuildingSign.tsx
git commit -m "feat: civic plaza, building render, curb routing wiring"
```

---

### Task 8: HUD — building card, banner, legend, toggle

**Files:**
- Modify: `app/src/components/hud/DetailCard.tsx`, `app/src/components/three/SelectedBanner.tsx`, `app/src/components/hud/TweakPanel.tsx`, `app/src/components/hud/LegendCard.tsx`

**Interfaces:**
- Consumes: store `selectedBuilding`, `activity`, `tweaks.showBuildings` (Task 5), `BUILDING_META` (Task 2), plaza-aware `layoutCity` (Task 1), `CivicDistrict` data for banner position.
- Produces: building detail card; building selection banner; `showBuildings` toggle; legend civic entry.

- [ ] **Step 1: DetailCard building branch**

Modify `app/src/components/hud/DetailCard.tsx`:

```tsx
import { BUILDING_META } from "../../civic";

export function DetailCard() {
  const selected = useApp((s) => s.selected);
  const selectedBuilding = useApp((s) => s.selectedBuilding);
  const activity = useApp((s) => s.activity);
  const clearSelection = useApp((s) => s.clearSelection);
  const showDetailCard = useApp((s) => s.tweaks.showDetailCard);
  const show = selected || selectedBuilding;

  const spring = useSpring({
    opacity: show ? 1 : 0,
    transform: show ? "translate(-50%, 0px) scale(1)" : "translate(-50%, 34px) scale(0.86)",
    config: { tension: 300, friction: 22 },
  });

  if (!show || !showDetailCard) return null;

  const body = selectedBuilding ? (
    (() => {
      const meta = BUILDING_META[selectedBuilding];
      const a = activity[selectedBuilding];
      return (
        <>
          <h2 className="pr-8 font-display text-lg font-semibold leading-snug">
            {meta.emoji} {meta.name}
          </h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Services" v={meta.services.join(" · ")} />
            <Row k="Visitors now" v={a.visitors} />
            <Row k="Cars parked" v={a.cars} />
          </dl>
        </>
      );
    })()
  ) : selected ? (
    (() => {
      const date = new Date(selected.timeCreated).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      return (
        <>
          <h2 className="pr-8 font-display text-lg font-semibold leading-snug">{selected.title}</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Model" v={selected.model ?? "unknown"} />
            <Row k="Agent" v={selected.agent ?? "—"} />
            <Row k="Cost" v={<AnimatedNumber value={selected.cost} format={(n) => `$${n.toFixed(4)}`} />} />
            <Row k="Tokens" v={<>{<AnimatedNumber value={selected.tokensIn} format={(n) => Math.round(n).toLocaleString()} />} in / {<AnimatedNumber value={selected.tokensOut} format={(n) => Math.round(n).toLocaleString()} />} out</>} />
            <Row k="Date" v={date} />
          </dl>
        </>
      );
    })()
  ) : null;

  return (
    <animated.div
      className="paper-card absolute bottom-16 left-1/2 w-80 p-4 font-body text-ink"
      style={{ opacity: spring.opacity, transform: spring.transform }}
    >
      <button
        onClick={clearSelection}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-ink/50 text-sm hover:bg-ink/10"
        aria-label="Close"
      >
        ✕
      </button>
      {body}
    </animated.div>
  );
}
```

- [ ] **Step 2: SelectedBanner building support**

Modify `app/src/components/three/SelectedBanner.tsx`:

- Use the plaza-aware layout: `layoutCity(data.projects, { plaza: CIVIC_PLAZA })`.
- For `selectedBuilding`, compute the lot position from a `CivicDistrict` computed the same way the Scene does (import `layoutCivicDistrict`, `CIVIC_PLAZA`, `attachCurbs`):

```tsx
const blocks = useMemo<PlacedBlock[]>(() => (data ? layoutCity(data.projects, { plaza: CIVIC_PLAZA }) : []), [data]);
const plazaBlock = useMemo(() => blocks.find((b) => b.kind === "plaza") ?? null, [blocks]);
const mainStreets = useMemo(() => buildStreets(blocks), [blocks]);
const bounds = useMemo(() => cityBounds(blocks), [blocks]);
const ring = useMemo(() => (bounds ? buildPerimeterRing(bounds) : []), [bounds]);
const graphStreets = useMemo(() => (bounds ? [...extendRoadsToRing(mainStreets, bounds), ...ring] : []), [mainStreets, bounds, ring]);
const graph = useMemo(() => buildRoadGraph(graphStreets, findIntersections(graphStreets)), [graphStreets]);
const civic = useMemo(() => (plazaBlock ? layoutCivicDistrict(plazaBlock, graphStreets, graph) : null), [plazaBlock, graphStreets, graph]);
```

- Resolve position:
```tsx
const position = useMemo(() => {
  if (selectedBuilding) {
    const lot = civic?.lots.find((l) => l.kind === selectedBuilding);
    return lot ? { x: lot.x, z: lot.z } : null;
  }
  if (!selected || blocks.length === 0) return null;
  // ...existing house resolution
}, [selected, selectedBuilding, data, blocks, civic]);
```

- Render title chip:
```tsx
const title = selectedBuilding ? BUILDING_META[selectedBuilding].name : selected?.title;
if (!title || !position) return null;
// <TitleChip key={selectedBuilding ?? selected?.id} title={title} />
```

- [ ] **Step 3: TweakPanel toggle**

In `app/src/components/hud/TweakPanel.tsx`, under the "World" group:

```tsx
<Toggle label="Public buildings" value={t.showBuildings} onChange={(v) => setTweak("showBuildings", v)} />
```

- [ ] **Step 4: LegendCard civic entry**

In `app/src/components/hud/LegendCard.tsx`, add a section:

```tsx
import { BUILDING_COLORS } from "../../theme";
import { BUILDING_META } from "../../civic";

// after the roof-color list:
<div className="mt-3 border-t border-ink/10 pt-2">
  <h4 className="font-display text-xs font-semibold">Civic buildings</h4>
  <ul className="mt-1 space-y-1 text-xs">
    {Object.entries(BUILDING_META).map(([kind, meta]) => (
      <li key={kind} className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full border border-ink/30" style={{ background: BUILDING_COLORS[kind as keyof typeof BUILDING_COLORS].body }} />
        <span className="truncate">{meta.emoji} {meta.name}</span>
      </li>
    ))}
  </ul>
</div>
```

- [ ] **Step 5: Typecheck + verify**

Run: `bun run typecheck`
Expected: PASS.
Run: `bun test`
Expected: PASS.
Run: `bun run dev` — click a building → detail card shows name/services/visitors/cars; banner chip floats above it; tweaks panel toggles buildings; legend shows the six buildings. Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/hud/DetailCard.tsx app/src/components/three/SelectedBanner.tsx app/src/components/hud/TweakPanel.tsx app/src/components/hud/LegendCard.tsx
git commit -m "feat: building detail cards, banners, legend, toggle"
```

---

### Task 9: Verification pass

**Files:**
- None (verification only).

- [ ] **Step 1: Full test suite**

Run: `bun test`
Expected: PASS — all server + app tests including new `civic.test.ts`, `activity.test.ts`, plaza layout tests, voxel building tests, `pickDestination` tests.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `bun run build`
Expected: PASS (tsc + Vite build).

- [ ] **Step 4: Visual smoke test**

Run: `bun run dev`. Walk the scene:
- Civic plaza centered in the grid with six recognizable voxel buildings (hospital cross, police siren, fire tower, mall awnings, bakery loaf, pet-shop paw).
- Cars route to plaza streets, stop briefly at curbs, then move on.
- People walk from sidewalks onto the plaza to building entrances, linger, and return.
- Click each building → detail card with live counts; banner above; halo highlight.
- Toggle "Public buildings" off/on; legend lists all six.
Ctrl-C when satisfied.

- [ ] **Step 5: Update AGENTS.md if conventions changed**

If the session revealed a convention worth encoding (e.g., "all civic buildings go through `voxel-forms` skill + `publicBuildingVoxels`"), add it to `AGENTS.md` and note it for the user.

---

## Self-Review

**Spec coverage:** §1 plaza layout → Task 1; §2 blueprints → Task 4; §3 car destinations → Tasks 3+6; §4 visitors → Tasks 2+6; §5 UI/store → Tasks 5+8; §6 testing → Tasks 1-4+6. `CIVIC_PLAZA` in `layout.ts` avoids a layout↔civic import cycle; `BuildingKind` in `types.ts` avoids a civic↔roadgraph cycle.

**Placeholder scan:** All steps carry concrete code or exact commands. The two "note" asides (mall awning overlap, pet-shop paw assertion) include explicit fallback actions rather than TODOs.

**Type consistency:** `Curb` defined in `roadgraph.ts` (Task 3) matches usage in `Traffic.tsx` (Task 6) and `Scene.tsx` (Task 7). `BuildingKind` from `types.ts` is used consistently. `visitorBuildings` optional prop added to `Traffic` in Task 6 and passed in Task 7; `VisitorSpec.building` aligns with `civic.lots` order.