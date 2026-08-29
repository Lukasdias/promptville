# Crowd Clusters with NPC Chatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic crowd of grouped people standing at gather spots around the town, with a few clusters showing short auto-hiding NPC conversation bubbles — batched so the whole crowd costs only a few draw calls.

**Architecture:** A pure `crowd.ts` computes `CrowdLayout` (anchored clusters + members) from `blocks`/`streets`; `Crowd.tsx` groups members by shirt colour into one `InstancedVoxels` each and renders `drei <Html>` bubbles for a capped subset of "talking" clusters. Follows the existing `layout.ts`/`sidewalk.ts` + component split, seeded with `mulberry32`.

**Tech Stack:** TypeScript, Bun, React 19, React Three Fiber 9, three.js, drei, Zustand.

## Global Constraints

- Voxel people via `personVoxels(shirt)` from `app/src/voxel.ts`; `Voxel` is `{ x, y, z, color: string }`.
- Batch by shirt colour → one `InstancedVoxels` per colour. **Never** one mesh per person.
- Deterministic: seed with `mulberry32` from `app/src/rand.ts`. **Never** `Math.random()`.
- Never place a member inside a street/sidewalk/intersection/block lot (use the clear-spot check). Build roads are `Street` rects (`width`/`depth` at `x`/`z`).
- People stand at `y=0`; the plaza block is `kind === "plaza"`.
- UI copy in English; bubble styling matches `SelectedBanner`/`BuildingSign` (`#fff6e5` bg, `3px solid #4a4453` border, Nunito, `white-space: nowrap`).
- Never `any`. Avoid `as` unless necessary.
- `No comments unless asked` applies in dev; keep reference comments only where they carry non-obvious intent.

---

### Task 1: Add `crowd` counts to config

**Files:**
- Modify: `app/src/config.ts` (append a `crowd` block after `traffic`)

**Interfaces:**
- Produces: `crowd` object: `{ clusters: number; membersPerCluster: number; clusterRadius: number; talkingCount: number; bubbleDuration: number; quietDuration: number; seed: number }`

- [ ] **Step 1: Add the config block**

```ts
export const crowd = {
  clusters: 6,
  membersPerCluster: 5,
  clusterRadius: 2.2,
  talkingCount: 2,
  bubbleDuration: 3.2,
  quietDuration: 5.0,
  seed: 4242,
};
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: resolves with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/config.ts
git commit -m "feat(crowd): add crowd tuning config"
```

---

### Task 2: `crowd.ts` — pure deterministic layout

**Files:**
- Create: `app/src/crowd.ts`
- Test: `app/src/crowd.test.ts`

**Interfaces:**
- Consumes: `PlacedBlock`, `Street` from `./layout`; `ROAD_WIDTH` from `./layout`; `isClearSpot` from `./placement`; `PROJECT_PALETTE` from `./theme`; `mulberry32` from `./rand`; `crowd` counts from `./config`.
- Produces (exact):
  ```ts
  export interface CrowdMember { x: number; z: number; shirt: string }
  export interface CrowdCluster { anchor: { x: number; z: number }; heading: number; members: CrowdMember[]; talking: boolean }
  export interface CrowdLayout { clusters: CrowdCluster[] }
  export function crowdLayout(blocks: PlacedBlock[], streets: Street[], seed?: number): CrowdLayout
  ```

- [ ] **Step 1: Write the failing test** (`app/src/crowd.test.ts`)

```ts
import { describe, expect, test } from "bun:test";
import { crowdLayout } from "./crowd";
import { layoutCity, buildStreets } from "./layout";
import { personVoxels, placeVoxels } from "./voxel";

const sessions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, tokensIn: 10, tokensOut: 5, timeCreated: i }));
const projects = Array.from({ length: 20 }, (_, i) => ({
  id: `p${i}`, name: `P${i}`, sessions: sessions(3 + (i % 4)),
}));

function build() {
  const blocks = layoutCity(projects);
  return { blocks, streets: buildStreets(blocks) };
}

describe("crowdLayout", () => {
  test("is deterministic for the same input", () => {
    const a = build();
    expect(crowdLayout(a.blocks, a.streets)).toEqual(crowdLayout(a.blocks, a.streets));
  });

  test("honors the configured cluster count", () => {
    const { blocks, streets } = build();
    const layout = crowdLayout(blocks, streets);
    expect(layout.clusters.length).toBeGreaterThan(0);
    expect(layout.clusters.length).toBeLessThanOrEqual(6);
  });

  test("each cluster has a small fan of members within the cluster radius", () => {
    const { blocks, streets } = build();
    for (const c of crowdLayout(blocks, streets).clusters) {
      expect(c.members.length).toBeGreaterThanOrEqual(3);
      expect(c.members.length).toBeLessThanOrEqual(6);
      for (const m of c.members) {
        const d = Math.hypot(m.x - c.anchor.x, m.z - c.anchor.z);
        expect(d).toBeLessThanOrEqual(2.2 + 0.01);
      }
    }
  });

  test("members never sit inside a street", () => {
    const { blocks, streets } = build();
    const inRoad = (x: number, z: number, pad: number) =>
      streets.some((s) => x > s.x - s.width / 2 - pad && x < s.x + s.width / 2 + pad && z > s.z - s.depth / 2 - pad && z < s.z + s.depth / 2 + pad);
    for (const c of crowdLayout(blocks, streets).clusters) {
      for (const m of c.members) expect(inRoad(m.x, m.z, 0)).toBe(false);
    }
  });

  test("a member has 4 voxels and a valid shirt color", () => {
    const { blocks, streets } = build();
    const shirt = crowdLayout(blocks, streets).clusters[0]?.members[0]?.shirt ?? "#fff";
    expect(placeVoxels(personVoxels(shirt), 0, 0, 1)).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/crowd.test.ts`
Expected: FAIL — `Cannot find module './crowd'`.

- [ ] **Step 3: Write the implementation** (`app/src/crowd.ts`)

```ts
import type { PlacedBlock, Street } from "./layout";
import { ROAD_WIDTH } from "./layout";
import { isClearSpot } from "./placement";
import { PROJECT_PALETTE } from "./theme";
import { mulberry32 } from "./rand";
import { crowd } from "./config";

export interface CrowdMember { x: number; z: number; shirt: string }
export interface CrowdCluster { anchor: { x: number; z: number }; heading: number; members: CrowdMember[]; talking: boolean }
export interface CrowdLayout { clusters: CrowdCluster[] }

// Deterministic gather spots: plaza edges, the park circle, and a couple of
// main-avenue corners. Never in a road or a building lot.
function anchors(blocks: PlacedBlock[], streets: Street[]): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const plaza = blocks.find((b) => b.kind === "plaza");
  if (plaza) {
    const hw = plaza.width / 2;
    const hd = plaza.depth / 2;
    out.push({ x: plaza.x, z: plaza.z - hd - 1.2 });
    out.push({ x: plaza.x + hw + 1.2, z: plaza.z });
  }
  // Main avenue corners (streets with the largest length on their axis).
  const sorted = [...streets].sort((a, b) => Math.max(b.width, b.depth) - Math.max(a.width, a.depth));
  for (const s of sorted.slice(0, 4)) {
    const horizontal = s.width >= s.depth;
    // stand just off the road edge, on the sidewalk/grass side
    const off = (horizontal ? s.depth : s.width) / 2 + 1.0;
    out.push(horizontal
      ? { x: s.x - s.width / 4, z: s.z + off }
      : { x: s.x + off, z: s.z - s.depth / 4 });
  }
  return out;
}

function clearOfEverything(x: number, z: number, blocks: PlacedBlock[], streets: Street[]): boolean {
  // Inside any block lot (excluding plaza, which is walkable)?
  const inLot = blocks.some((b) =>
    b.kind !== "plaza" &&
    x > b.x - b.width / 2 - 0.4 && x < b.x + b.width / 2 + 0.4 &&
    z > b.z - b.depth / 2 - 0.4 && z < b.z + b.depth / 2 + 0.4);
  if (inLot) return false;
  // On the road surface?
  const onRoad = streets.some((s) =>
    x > s.x - s.width / 2 - 0.3 && x < s.x + s.width / 2 + 0.3 &&
    z > s.z - s.depth / 2 - 0.3 && z < s.z + s.depth / 2 + 0.3);
  return !onRoad;
}

export function crowdLayout(blocks: PlacedBlock[], streets: Street[], seed = crowd.seed): CrowdLayout {
  const rand = mulberry32(seed);
  const candid = anchors(blocks, streets).filter((a) => clearOfEverything(a.x, a.z, blocks, streets));
  const clusters: CrowdCluster[] = [];
  // talking flags assigned to a deterministic subset, capped.
  const talkingSet = new Set<number>();
  for (let i = 0; i < Math.min(crowd.talkingCount, candid.length); i++) talkingSet.add(i);

  for (const anchor of candid.slice(0, crowd.clusters)) {
    const talking = talkingSet.has(clusters.length);
    const members: CrowdMember[] = [];
    const n = crowd.membersPerCluster;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rand() * 0.3;
      const r = crowd.clusterRadius * (0.55 + rand() * 0.4);
      const x = anchor.x + Math.cos(ang) * r;
      const z = anchor.z + Math.sin(ang) * r;
      if (!clearOfEverything(x, z, blocks, streets)) continue;
      if (members.length >= 6) break;
      members.push({ x, z, shirt: PROJECT_PALETTE[(i + clusters.length * 3) % PROJECT_PALETTE.length] });
    }
    if (members.length === 0) continue;
    clusters.push({ anchor, heading: Math.PI / 2, members, talking });
  }

  return { clusters };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/crowd.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: resolves.

- [ ] **Step 6: Commit**

```bash
git add app/src/crowd.ts app/src/crowd.test.ts
git commit -m "feat(crowd): pure deterministic crowd layout"
```

---

### Task 3: `Crowd.tsx` — batched renderer + NPC bubbles

**Files:**
- Create: `app/src/components/three/Crowd.tsx`
- Modify: `app/src/components/three/Scene.tsx` (import + mount)

**Interfaces:**
- Consumes: `crowdLayout`, `CrowdLayout` from `../../crowd`; `personVoxels`, `placeVoxels`, `Voxel` from `../../voxel`; `useApp` from `../../store`; `useCity` from `../../city`; `crowd` from `../../config`; `useFrame` from `@react-three/fiber`; `Html` from `@react-three/drei`; `useMemo`/`useRef`/`useState` from `react`; `InstancedVoxels` from `./InstancedVoxels`.
- Produces: `<Crowd />` (no props; reads `useCity`). Mounted in `Scene.tsx`.

- [ ] **Step 1: Write the component** (`app/src/components/three/Crowd.tsx`)

```tsx
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { personVoxels, placeVoxels, type Voxel } from "../../voxel";
import { crowdLayout } from "../../crowd";
import { crowd } from "../../config";
import { useApp } from "../../store";
import { useCity } from "../../city";
import { InstancedVoxels } from "./InstancedVoxels";

const PERSON_SIZE = 0.15;
const BUBBLE_H = 1.2;

const LINES = [
  ["Nice weather today, huh?", "Yeah, real cozy."],
  ["Did you see the new plaza?", "So nice."],
  ["This town grows every day.", "Told you!"],
];

function Bubble({ seed, anchor }: { seed: number; anchor: { x: number; z: number } }) {
  const pair = LINES[seed % LINES.length]!;
  // React state drives visibility — a ref would not re-render the JSX.
  const [visible, setVisible] = useState(true);
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    const cycle = crowd.bubbleDuration + crowd.quietDuration;
    const on = (t.current % cycle) < crowd.bubbleDuration;
    if (on !== visible) setVisible(on);
  });
  return (
    <group position={[anchor.x, BUBBLE_H, anchor.z]}>
      {visible && (
        <Html center distanceFactor={16} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "#fff6e5",
              border: "3px solid #4a4453",
              borderRadius: 12,
              boxShadow: "4px 4px 0 rgba(74,68,83,0.35)",
              padding: "5px 10px",
              fontFamily: '"Nunito", sans-serif',
              fontWeight: 700,
              fontSize: 12,
              color: "#4a4453",
              whiteSpace: "nowrap",
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {pair[0]}
          </div>
        </Html>
      )}
    </group>
  );
}

export function Crowd() {
  const { blocks, streets } = useCity();
  const showPeople = useApp((s) => s.tweaks.showPeople);
  const layout = useMemo(() => crowdLayout(blocks, streets), [blocks, streets]);

  // Batch all standing people by shirt colour → one InstancedVoxels per colour.
  const byColor = useMemo(() => {
    const map = new Map<string, Voxel[]>();
    for (const c of layout.clusters) {
      for (const m of c.members) {
        const arr = map.get(m.shirt) ?? [];
        arr.push(...placeVoxels(personVoxels(m.shirt), m.x, m.z, PERSON_SIZE));
        map.set(m.shirt, arr);
      }
    }
    return [...map.entries()].map(([shirt, voxels]) => ({ shirt, voxels }));
  }, [layout]);

  if (!showPeople || byColor.length === 0) return null;

  return (
    <group>
      {byColor.map(({ shirt, voxels }) => (
        <InstancedVoxels key={shirt} voxels={voxels} voxelSize={PERSON_SIZE} />
      ))}
      {layout.clusters.filter((c) => c.talking).map((c, i) => (
        <Bubble key={i} seed={i * 7 + 1} anchor={c.anchor} />
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Mount in `Scene.tsx`** — add the import and a `<Crowd />` after `<People />`:

```tsx
import { People } from "./People";
import { Crowd } from "./Crowd";
```

```tsx
      <People />
      <Crowd />
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: resolves.

- [ ] **Step 4: Run the full suite**

Run: `bun test`
Expected: all pass, including the newly added `crowd.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/three/Crowd.tsx app/src/components/three/Scene.tsx
git commit -m "feat(crowd): batched crowd renderer with npc bubbles"
```

---

## Verification (run after all tasks)

- `bun run typecheck` — clean.
- `bun test` — all suites pass (new `crowd.test.ts` included).
- `bun run dev` — visually confirm: clusters of people stand at plaza/park/avenue spots (grouped, tucked off roads), 1–2 bubbles show then auto-hide, and the frame rate holds (crowd is only ~2–3 draw calls).

## Self-Review

**Spec coverage:** config counts (Task 1) ✓; pure `crowdLayout` + tests for determinism/cluster-count/radius/no-road (Task 2) ✓; batched renderer + capped auto-hide bubbles + Scene mount (Task 3) ✓. YAGNI scope (no pathing/audio) ✓.

**Type consistency:** `CrowdMember`/`CrowdCluster`/`CrowdLayout`/`crowdLayout(blocks, streets, seed?)` used identically in Task 2 and Task 3; config names (`clusters`, `membersPerCluster`, `clusterRadius`, `talkingCount`, `bubbleDuration`, `quietDuration`, `seed`) match across tasks. `crowd.title`/naming consistent.

**Placeholder scan:** no TBD/TODO; all code steps have full code.
