# Promptville — Public Buildings Design Spec

Date: 2026-08-27
Status: Draft

## Overview

Add six public buildings to Promptville — **hospital, police station, fire station, shopping mall, bakery, pet shop** — arranged around a **civic plaza** embedded in the center of the town grid. The buildings are voxel landmarks (built with a new local `voxel-forms` skill) that serve as **destinations**: cars route to their curbs and stop for a drop-off idle; visitors (foot traffic) walk from houses to building entrances, linger, and return. Each building gets a drei `Html` sign chip and a clickable detail card with live visitor/parking counts.

Related artifact: `.opencode/skill/voxel-forms/` — a local skill codifying the procedural voxel-composition pattern (footprint → hollow walls → roof → decorations → signs) used to author all building blueprints.

## Stack & Conventions

- Unchanged: Vite + React 19 + R3F 9, `InstancedVoxels` pipeline, TanStack Query for data, Zustand for UI state.
- All new scene geometry is voxel-based (`Voxel[]` → `InstancedVoxels`). No hand-placed `<mesh>` buildings.
- New pure logic goes in `app/src/*.ts` with tests (following `layout.ts` / `traffic.ts` patterns).
- All copy in English; cartoon palette from `theme.ts`.
- `frameloop="always"` stays (continuous animation); never `setState` inside `useFrame` (flush simulation stats via interval, not per-frame setState).

## Architecture

```
app/src/
  layout.ts                 # + plaza reservation (optional opts to layoutCity)
  civic.ts                  # NEW: plaza → lots, curbs, visitor paths (pure)
  activity.ts               # NEW: mutable per-building counters + flush hook
  roadgraph.ts              # + attachCurbs (curb nodes + spur edges)
  traffic.ts                # + building destinations for WaypointCar, pickDestination
  voxel.ts                  # + publicBuildingVoxels + building color constants
  theme.ts                  # + BUILDING_COLORS (candy palette per kind)
  config.ts                 # + traffic.visitors, civic plaza sizing
  store.ts                  # selection → {session|building} union; + showBuildings tweak
  components/three/
    CivicDistrict.tsx       # NEW: plaza tile, buildings, signs, click handling
    BuildingSign.tsx        # NEW: drei Html sign chip per building
    Ground.tsx              # + plaza pad (cream tile instead of grass)
    City.tsx / Block.tsx    # skip plaza cell (projectId "__plaza__")
    Traffic.tsx             # + VisitorMover for visitors
  components/hud/
    DetailCard.tsx          # + building card branch
    LegendCard.tsx          # + civic entry
    TweakPanel.tsx          # + showBuildings toggle
tests unchanged in server/; new frontend tests: civic.test.ts, voxel.test.ts additions
```

## 1. Civic Plaza Layout

### layoutCity plaza reservation

`layoutCity(projects, opts?)` gains optional `opts.plaza?: { width: number; depth: number }` (backward compatible — existing calls unchanged).

When provided:

- Compute rows; `plazaRow = floor(rows / 2)`.
- Insert the plaza as a grid cell in `plazaRow`, horizontally centered: `ceil(rowBlockCount / 2)` blocks before it, the rest after. The row holds `BLOCKS_PER_ROW - 1` blocks + plaza (a displaced block rolls into a new row appended at the end; total rows grow by at most 1).
- The plaza is a `PlacedBlock` with `projectId: "__plaza__"`, `name: "Civic Plaza"`, `houses: []`, `kind: "plaza"`. Add `kind?: "block" | "plaza"` to `PlacedBlock` (default `"block"`).

Because `buildStreets`, `buildPerimeterRing`, `findIntersections`, `buildRoadGraph` treat grid cells uniformly, the plaza gets streets on all four sides for free.

**Consumers:**

- `City.tsx` / `Block.tsx`: skip blocks with `kind === "plaza"`.
- `Ground.tsx`: plaza pad renders as cream plaza tile (with a center planter/fountain) instead of grass.
- `civic.ts`: consumes the plaza cell to lay out lots.

### civic.ts (pure)

```ts
export type BuildingKind = "hospital" | "police" | "fire" | "mall" | "bakery" | "petshop";

export interface BuildingLot {
  kind: BuildingKind;
  x: number;         // world center
  z: number;
  rotation: 0 | 1 | 2 | 3;   // quarter turns; front faces the plaza
  footprint: number;         // voxel footprint width/depth (cells)
  entrance: { x: number; z: number };  // faces the plaza interior
  curb: { x: number; z: number };      // snapped to a road node on the bordering street
}

export interface CivicDistrict {
  plaza: { x: number; z: number; width: number; depth: number };
  lots: BuildingLot[];
  visitorPaths: { from: { x: number; z: number }; waypoints: { x: number; z: number }[]; to: { x: number; z: number } }[];
}
```

- `layoutCivicDistrict(plazaBlock: PlacedBlock, streets: Street[], graph: RoadGraph): CivicDistrict`
  - Six lots around the plaza pad: 2 on the top edge facing down, 2 on the bottom facing up, 1 left, 1 right; a center walkway/fountain stays clear.
  - Lot footprint ~6×6 cells (mall larger, ~9×6).
  - Curb: nearest road node on the street bordering the lot's facing side (a parking lane along the plaza-facing street).
  - `visitorPaths`: sidewalk paths from a nearby street to each building entrance (house-side sidewalk → avenue sidewalk → plaza walkway → entrance). Pure and testable.

## 2. Voxel Building Blueprints

Follow the `voxel-forms` skill (`.opencode/skill/voxel-forms/`): footprint → hollow walls → roof → decorations → sign marks.

`voxel.ts`:

```ts
export interface PublicBuildingOptions {
  kind: BuildingKind;
  body: string;
  accent: string;
  roof: string;
  walls: number;
  width?: number;  // cells, odd
  depth?: number;  // cells, odd
}
export function publicBuildingVoxels(o: PublicBuildingOptions): Voxel[]
```

Distinguishing marks per kind (front face +z):

- **hospital** — white body, red cross on facade + roof sign.
- **police** — blue body, cream stripe, red/blue siren on roof, garage bay.
- **fire** — red body, cream stripe, two dark garage bays, bell tower.
- **mall** — wide box, colorful awning ring, big signboard on roof, several shopfront windows.
- **bakery** — tan body, striped awning, bread-shaped roof sign, warm window.
- **petshop** — pink/teal body, paw-print sign, small awning, big window.

`theme.ts`: `BUILDING_COLORS: Record<BuildingKind, { body; accent; roof }>` in the candy palette. Voxel size ~0.4; rendered via `InstancedVoxels`.

## 3. Destination Mechanics (cars)

`roadgraph.ts`:

```ts
export interface Curb { buildingId: BuildingKind; nodeId: number; x: number; z: number }
export function attachCurbs(graph: RoadGraph, points: { buildingId: BuildingKind; x: number; z: number }[]): { graph: RoadGraph; curbs: Curb[] }
```

Each curb becomes a node with a bidirectional spur edge to its nearest existing node. Returns the extended graph (pure; existing `buildRoadGraph` tests unaffected).

`traffic.ts`:

- `WaypointCar` destination pool = building curb nodes (weighted ~60%) + random nodes (fallback). Cars route to a curb spur, brake at red lights (existing logic), stop at the curb for a drop-off idle (`2 + rand*2`s), then replan.
- Extract `pickDestination(weights, rand)` as a pure function (tested) so the destination logic is unit-testable.
- On arrival at a curb, bump the building's `cars` counter via `activity.ts`.

## 4. Visitors (people)

`activity.ts` (mutable counters + HUD flush):

```ts
export const buildingActivity: Record<BuildingKind, { visitors: number; cars: number }>;
export function bumpBuildingActivity(kind: BuildingKind, metric: "visitors" | "cars", delta: number): void;
export function useActivityPump(): void;  // setInterval ~1s → flush into zustand store
```

`Traffic.tsx` gains `VisitorMover` (parallel to `FootMover`):

- Follows `civic.visitorPaths[i]`: move along sidewalk waypoints (straight segments, reuse FootMover's move/rotate math), turn at corners, arrive at the entrance, idle-bob ~3–5s, then walk back and despawn (reuse fade lifecycle).
- Spawn from `traffic.visitors` config; bump the building's `visitors` counter on arrival.

## 5. UI + Store

`store.ts`:

- `selected` becomes a discriminated union: `{ kind: "session"; session: SessionData } | { kind: "building"; building: BuildingKind } | null`. Update `select` overloads; existing session consumers read `selected.kind === "session"`.
- `tweaks.showBuildings: boolean` (default true) + `setTweak` unchanged.

`components/three/BuildingSign.tsx`: drei `Html` chip per building (emoji + name), styled like the `SelectedBanner` chip, always visible at a distance.

`components/three/CivicDistrict.tsx` (mounted in `Scene.tsx` after `<City />`): plaza tile handled by `Ground`; renders the six buildings (`InstancedVoxels`, `rotation` from lot), `BuildingSign` per lot, click → `select({ kind: "building", building })` (respects `isPanActive` like `House`), hover highlight + pointer cursor.

`components/hud/DetailCard.tsx`: branch on selection kind — session card (unchanged) or **building card** (name, emoji, services list, live visitors, cars parked from `activity`).

`SelectedBanner.tsx`: support building selection (banner above the building instead of a house).

`TweakPanel.tsx`: `showBuildings` toggle. `LegendCard.tsx`: civic buildings entry.

`config.ts`: `traffic.visitors` (≈4), civic plaza sizing constants.

## 6. Testing

- `app/src/civic.test.ts` (NEW): plaza cell lands in the middle row; six lots non-overlapping and facing the plaza; curbs snap to road nodes; `attachCurbs` returns a connected graph with spur edges; visitor paths stay on sidewalk/plaza bounds.
- `app/src/layout.test.ts`: plaza reservation keeps existing invariants (adjacent spacing, houses in bounds) and adds a plaza test.
- `app/src/voxel.test.ts`: each building blueprint emits cells within its footprint, distinct per kind, uses palette colors.
- `app/src/traffic.test.ts`: `pickDestination` weighting (buildings more likely than random; valid node ids).
- Server tests unchanged.

## Out of Scope

- No new server endpoints; buildings are purely presentational/simulated client-side.
- No editing of the opencode DB (unchanged read-only).
- No new deployment concerns.