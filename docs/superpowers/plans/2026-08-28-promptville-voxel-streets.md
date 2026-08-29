# Promptville Voxel Streets & Rolling Terrain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat stacked ground/street/sidewalk planes with geometrically-separated geometry (asphalt slabs, raised voxel brick sidewalks with curbs) on a flat city pad plus a gently rolling grass terrain, eliminating z-fighting.

**Architecture:** Pure math in `app/src/ground.ts` (pad rect + hill-height) is unit-tested; voxel blueprints in `app/src/voxel.ts` add `streetSidewalkVoxels(streets, size)` to emit world-positioned sidewalk/curb cells (crossing-street overlaps culled); tiny components `Terrain.tsx` (displaced grass), `Streets.tsx` (asphalt slab boxes), reworked `Sidewalks.tsx` (one `InstancedVoxels` + crosswalks) are mounted in `Scene.tsx`.

**Tech Stack:** React 19 + R3F, three, `simplex-noise`, Tailwind (HUD only), Drizzle/Bun for server (unchanged).

## Global Constraints

- Ground planes / surfaces: rotate `rotation-x={-Math.PI/2}`; never leave +Z-facing.
- All scene props voxel-based via `InstancedVoxels`; never hand-build from many `<mesh>`. A hand full of thin asphalt slab boxes (one per street) is allowed.
- R3F: no `setState` in `useFrame`; hooks only inside `<Canvas>`; keep `frameloop="always"`; share geometry/materials via module-level constants.
- Pure blueprints: integer/int cell indices, `y=0` ground, colors from `./theme` + `./voxel` constants only (no raw hex in blueprints), no randomness inside a blueprint (pass params in).
- Never mutate the opencode DB. Never `any`. Avoid `as` unless necessary. No comments unless asked.
- Heights are world units; grass base = 0. Do not overlap coplanar layers without `polygonOffset`.

---

### Task 1: Add curb color to theme

**Files:**
- Modify: `app/src/theme.ts`

**Interfaces:**
- Produces: `COLORS.curb` (`string`).

- [ ] **Step 1: Add `curb` to `COLORS`**

In `app/src/theme.ts`, inside `export const COLORS = {...}`, add after `crosswalk`:

```ts
  curb: "#b8623f",
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/theme.ts
git commit -m "feat(theme): add curb color"
```

---

### Task 2: Ground math (pad + hill height)

**Files:**
- Create: `app/src/ground.ts`
- Test: `app/src/ground.test.ts`

**Interfaces:**
- Consumes: `Bounds` from `./layout`.
- Produces:
  - `export interface PadRect { cx: number; cz: number; halfX: number; halfZ: number }`
  - `cityPad(bounds: Bounds, margin: number): PadRect`
  - `padOvershoot(px: number, pz: number, pad: PadRect): number`
  - `hillHeight(overshoot: number, maxHill?: number, ramp?: number): number`
  - `export const PAD_MARGIN = 8; export const HILL_MAX = 5; export const HILL_RAMP = 40;`

- [ ] **Step 1: Write the failing test (`app/src/ground.test.ts`)**

```ts
import { describe, expect, test } from "bun:test";
import { cityPad, hillHeight, padOvershoot, HILL_MAX, PAD_MARGIN } from "./ground";

const B = { minX: -20, maxX: 20, minZ: -10, maxZ: 10 };

describe("cityPad", () => {
  test("expands bounds by the margin and centers on the city", () => {
    const pad = cityPad(B, PAD_MARGIN);
    expect(pad.cx).toBe(0);
    expect(pad.cz).toBe(0);
    expect(pad.halfX).toBe(20 + PAD_MARGIN);
    expect(pad.halfZ).toBe(10 + PAD_MARGIN);
  });
});

describe("padOvershoot", () => {
  test("is zero inside the pad and positive outside", () => {
    const pad = cityPad(B, PAD_MARGIN);
    expect(padOvershoot(0, 0, pad)).toBe(0);
    expect(padOvershoot(0, pad.halfZ - 1, pad)).toBe(0);
    expect(padOvershoot(0, pad.halfZ + 1, pad)).toBeGreaterThan(0);
  });
});

describe("hillHeight", () => {
  test("is zero inside the pad and grows smoothly outside", () => {
    expect(hillHeight(0)).toBe(0);
    expect(hillHeight(-5)).toBe(0);
    const r = HILL_RAMP;
    expect(hillHeight(r / 2)).toBeGreaterThan(0);
    expect(hillHeight(r)).toBeCloseTo(HILL_MAX, 5);
    expect(hillHeight(r * 2)).toBeCloseTo(HILL_MAX, 5);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `bun test app/src/ground.test.ts`
Expected: FAIL (`./ground` not found).

- [ ] **Step 3: Implement `app/src/ground.ts`**

```ts
import type { Bounds } from "./layout";

export const PAD_MARGIN = 8;
export const HILL_MAX = 5;
export const HILL_RAMP = 40;

export interface PadRect {
  cx: number;
  cz: number;
  halfX: number;
  halfZ: number;
}

export function cityPad(bounds: Bounds, margin: number): PadRect {
  return {
    cx: (bounds.minX + bounds.maxX) / 2,
    cz: (bounds.minZ + bounds.maxZ) / 2,
    halfX: (bounds.maxX - bounds.minX) / 2 + margin,
    halfZ: (bounds.maxZ - bounds.minZ) / 2 + margin,
  };
}

export function padOvershoot(px: number, pz: number, pad: PadRect): number {
  const dx = Math.max(0, Math.abs(px - pad.cx) - pad.halfX);
  const dz = Math.max(0, Math.abs(pz - pad.cz) - pad.halfZ);
  return Math.hypot(dx, dz);
}

export function hillHeight(overshoot: number, maxHill: number = HILL_MAX, ramp: number = HILL_RAMP): number {
  if (overshoot <= 0) return 0;
  const t = Math.min(1, overshoot / ramp);
  return maxHill * t * t * (3 - 2 * t);
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `bun test app/src/ground.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/ground.ts app/src/ground.test.ts
git commit -m "feat(ground): add pad extent and hill-height math"
```

---

### Task 3: Sidewalk/curb voxel blueprints

**Files:**
- Modify: `app/src/voxel.ts`
- Test: `app/src/voxel.test.ts`

**Interfaces:**
- Consumes: `Street` from `./layout`; `COLORS` from `./theme`.
- Produces:
  - `export const SIDEWALK_SIZE = 0.4; export const SIDEWALK_CELLS = 2;`
  - `streetSidewalkVoxels(streets: Street[], size?: number, walk?: string, curb?: string): Voxel[]` — world-positioned cells (`y = 0`), crossing-street road overlap culled.

- [ ] **Step 1: Write the failing tests (append to `app/src/voxel.test.ts`)**

```ts
import { COLORS } from "./theme";
import { streetSidewalkVoxels, SIDEWALK_SIZE } from "./voxel";

describe("streetSidewalkVoxels", () => {
  const horizontal: Street = { x: 0, z: 0, width: 8, depth: 3.5 };
  const vertical: Street = { x: 0, z: 0, width: 3.5, depth: 8 };

  test("lays sidewalk cells along both flanks of a horizontal street", () => {
    const v = streetSidewalkVoxels([horizontal]);
    const tops = v.filter((c) => Math.abs(c.z * SIDEWALK_SIZE + 0.5 * 0) >= 0); // placeholder, replaced below
    expect(v.length).toBeGreaterThan(0);
    expect(v.some((c) => c.y === 0)).toBe(true);
  });

  test("no sidewalk cell lands inside the asphalt band of its street", () => {
    const v = streetSidewalkVoxels([horizontal]);
    const cells = v.map((c) => ({ wx: (c.x + 0.5) * SIDEWALK_SIZE, wz: (c.z + 0.5) * SIDEWALK_SIZE }));
    for (const c of cells) {
      expect(Math.abs(c.wz) > horizontal.depth / 2).toBe(true);
    }
  });

  test("vertical street flanks on the x axis", () => {
    const v = streetSidewalkVoxels([vertical]);
    const cells = v.map((c) => ({ wx: (c.x + 0.5) * SIDEWALK_SIZE, wz: (c.z + 0.5) * SIDEWALK_SIZE }));
    for (const c of cells) {
      expect(Math.abs(c.wx) > vertical.width / 2).toBe(true);
    }
  });

  test("curb cells are the street-facing row, walk cells outside", () => {
    const v = streetSidewalkVoxels([horizontal]);
    const near = v.filter((c) => c.color === COLORS.curb);
    const far = v.filter((c) => c.color === COLORS.brick);
    const nearMin = Math.min(...near.map((c) => (c.z + 0.5) * SIDEWALK_SIZE));
    const farMin = Math.min(...far.map((c) => (c.z + 0.5) * SIDEWALK_SIZE));
    expect(Math.abs(nearMin)).toBeCloseTo(horizontal.depth / 2 + SIDEWALK_SIZE / 2, 1);
    expect(Math.abs(farMin)).toBeGreaterThan(Math.abs(nearMin));
  });

  test("culls sidewalk cells that a crossing street's road would cover", () => {
    const crossing: Street = { x: 0, z: 0, width: 3.5, depth: 12 };
    const v = streetSidewalkVoxels([horizontal, crossing]);
    const cells = v.map((c) => ({ wx: (c.x + 0.5) * SIDEWALK_SIZE, wz: (c.z + 0.5) * SIDEWALK_SIZE }));
    // No cell from the crossing street's own band also inside the horizontal road:
    for (const c of cells) {
      const inHorizontal = Math.abs(c.wz) < horizontal.depth / 2;
      const inVertical = Math.abs(c.wx) < vertical.width / 2;
      expect(inHorizontal && inVertical).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `bun test app/src/voxel.test.ts`
Expected: FAIL (`streetSidewalkVoxels` not exported).

- [ ] **Step 3: Implement `streetSidewalkVoxels` in `app/src/voxel.ts`**

Add near the top after the color constants (import `type { Street }` from `./layout` at the top of the file):

```ts
import type { Street } from "./layout";
import { COLORS } from "./theme";
```

Then add:

```ts
export const SIDEWALK_SIZE = 0.4;
export const SIDEWALK_CELLS = 2;

export function streetSidewalkVoxels(
  streets: Street[],
  size: number = SIDEWALK_SIZE,
  walk: string = COLORS.brick,
  curb: string = COLORS.curb,
): Voxel[] {
  const insideRoad = (wx: number, wz: number) =>
    streets.some((s) => Math.abs(wx - s.x) < s.width / 2 && Math.abs(wz - s.z) < s.depth / 2);

  const voxels: Voxel[] = [];
  const emit = (wx: number, wz: number, color: string) => {
    if (insideRoad(wx, wz)) return;
    voxels.push({ x: wx / size - 0.5, y: 0, z: wz / size - 0.5, color });
  };

  for (const s of streets) {
    const horizontal = s.width >= s.depth;
    const half = horizontal ? s.width / 2 : s.depth / 2;
    const roadHalf = horizontal ? s.depth / 2 : s.width / 2;

    for (let p = 0; p < Math.ceil((2 * half) / size); p++) {
      const ac = -half + (p + 0.5) * size;
      for (const sign of [-1, 1]) {
        // curb (street-facing) then walk (one cell outward)
        const cOff = roadHalf + size / 2;
        const wOff = roadHalf + size + size / 2;
        if (horizontal) {
          emit(s.x + ac, s.z + sign * cOff, curb);
          emit(s.x + ac, s.z + sign * wOff, walk);
        } else {
          emit(s.x + sign * cOff, s.z + ac, curb);
          emit(s.x + sign * wOff, s.z + ac, walk);
        }
      }
    }
  }

  return voxels;
}
```

- [ ] **Step 4: Fix the placeholder test then run**

Replace the placeholder `tops` line in the first test with:

```ts
    const v = streetSidewalkVoxels([horizontal]);
    expect(v.length).toBeGreaterThan(0);
    expect(v.some((c) => c.y === 0)).toBe(true);
```

Run: `bun test app/src/voxel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/voxel.ts app/src/voxel.test.ts
git commit -m "feat(voxel): add raised sidewalk and curb blueprints"
```

---

### Task 4: Terrain component (rolling grass)

**Files:**
- Create: `app/src/components/three/Terrain.tsx`
- Modify: `app/src/components/three/Scene.tsx` (mount + remove flat base use in Ground is Task 5)

**Interfaces:**
- Consumes: `cityPad`, `padOvershoot`, `hillHeight`, `PAD_MARGIN` from `../../ground`; `Bounds` from `../../layout`; `grassMaterial`, `grassTexture`, `GRASS_TILE_WORLD` from `../../textures`; `createNoise3D` from `simplex-noise`; `mulberry32` from `../../rand`; `useApp` store.
- Produces: `<Terrain extent={number} bounds={Bounds | null} />` — flat grass inside the pad, gently rolling hills outside.

- [ ] **Step 1: Create `app/src/components/three/Terrain.tsx`**

```tsx
import { useMemo } from "react";
import { PlaneGeometry, type BufferAttribute } from "three";
import { createNoise3D } from "simplex-noise";
import { mulberry32 } from "../../rand";
import { cityPad, hillHeight, padOvershoot, PAD_MARGIN } from "../../ground";
import { grassMaterial, grassTexture, GRASS_TILE_WORLD } from "../../textures";
import type { Bounds } from "../../layout";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";

const SEG = 120;
const NOISE_SCALE = 0.02;

export function Terrain({ extent, bounds }: { extent: number; bounds: Bounds | null }) {
  const clearSelection = useApp((s) => s.clearSelection);

  const geometry = useMemo(() => {
    const size = extent * 2;
    const g = new PlaneGeometry(size, size, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pad = bounds ? cityPad(bounds, PAD_MARGIN) : null;
    const noise = createNoise3D(mulberry32(1313));
    const pos = g.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      let h = 0;
      if (pad) {
        const over = padOvershoot(wx, wz, pad);
        h = hillHeight(over);
        if (over > 0) {
          h += (noise(wx * NOISE_SCALE, 0, wz * NOISE_SCALE) + 1) * 0.6 * Math.min(1, over / 8);
        }
      }
      pos.setY(i, h);
    }
    g.computeVertexNormals();
    grassTexture.repeat.set(Math.max(2, Math.round(size / GRASS_TILE_WORLD)), Math.max(2, Math.round(size / GRASS_TILE_WORLD)));
    grassTexture.needsUpdate = true;
    return g;
  }, [extent, bounds]);

  return (
    <mesh
      geometry={geometry}
      position={[0, -0.05, 0]}
      receiveShadow
      material={grassMaterial}
      onClick={(e) => {
        if (isPanActive()) return;
        e.stopPropagation();
        clearSelection();
      }}
    />
  );
}
```

- [ ] **Step 2: Mount in `Scene.tsx` and pass `bounds`**

In `Scene.tsx`, add import `import { Terrain } from "./Terrain";`, render `<Terrain extent={extent} bounds={bounds} />` right after the background/lights (before Ground), and remove the flat grass base plane from `Ground` (see Task 5). Keep the `bounds` value already destructured from `useCity()` as `bounds`.

- [ ] **Step 3: Verify typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/three/Terrain.tsx app/src/components/three/Scene.tsx
git commit -m "feat(terrain): add rolling grass terrain on a flat city pad"
```

---

### Task 5: Streets as asphalt slabs + tidy Ground

**Files:**
- Create: `app/src/components/three/Streets.tsx`
- Modify: `app/src/components/three/Ground.tsx`
- Modify: `app/src/components/three/Scene.tsx`

**Interfaces:**
- Consumes: `Street` from `../../layout`; `asphaltMaterial` from `../../textures`; `useApp` + `isPanActive`.
- Produces: `<Streets streets={Street[]} />` (one asphalt slab box per street); `Ground` no longer renders street planes/dashes (keeps lots/plaza/park).

- [ ] **Step 1: Create `app/src/components/three/Streets.tsx`**

```tsx
import { BoxGeometry, MeshStandardMaterial } from "three";
import type { Street } from "../../layout";
import { asphaltMaterial } from "../../textures";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";

const SLAB_H = 0.06;

export function Streets({ streets }: { streets: Street[] }) {
  const clearSelection = useApp((s) => s.clearSelection);
  const clear = (e: { stopPropagation: () => void }) => {
    if (isPanActive()) return;
    e.stopPropagation();
    clearSelection();
  };
  return (
    <group>
      {streets.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, SLAB_H / 2, s.z]}
          receiveShadow
          material={asphaltMaterial}
          onClick={clear}
        >
          <boxGeometry args={[s.width, SLAB_H, s.depth]} />
        </mesh>
      ))}
    </group>
  );
}
```

Note: per-instance `boxGeometry` is fine (one per street). The shared `asphaltMaterial` has `polygonOffset` already? No — it does not. Add `polygonOffset` to the asphalt material's shader via a per-slab material is unnecessary since the slab is a real 3D box (0.06 tall) that sits above the grass at y=0 — it is not coplanar, so no z-fight. No polygonOffset needed.

- [ ] **Step 2: Tidy `Ground.tsx`**

Remove the `streets.map(...)` asphalt plane block (lines ~84-96) and the `streets.flatMap((s) => streetDashes(s))` dashes block (~97-107), plus the now-unused `streetDashes`/`Dash` helpers and `COLORS` import and the `streets` prop. `Ground` becomes:

```tsx
import { useEffect } from "react";
import type { PlacedBlock, Street } from "../../layout";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";
import { pickParkSpot, PARK_RADIUS } from "../../placement";
import { grassLotMaterial, plazaMaterial } from "../../textures";

export function Ground({ blocks }: { blocks: PlacedBlock[] }) {
  const clearSelection = useApp((s) => s.clearSelection);
  const clear = (e: { stopPropagation: () => void }) => {
    if (isPanActive()) return;
    e.stopPropagation();
    clearSelection();
  };
  if (blocks.length === 0) return null;
  const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2)) + 8;
  const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2)) + 8;
  const minX = Math.min(...blocks.map((b) => b.x - b.width / 2)) - 8;
  const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2)) - 8;
  const park = pickParkSpot(blocks, minX, maxX, minZ, maxZ);

  return (
    <group>
      {blocks.map((b) => {
        if (b.kind === "plaza") {
          return (
            <group key={b.projectId}>
              <mesh position={[b.x, 0.06, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear} material={plazaMaterial}>
                <planeGeometry args={[b.width + 0.4, b.depth + 0.4]} />
              </mesh>
              <mesh position={[b.x, 0.065, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear}>
                <circleGeometry args={[3, 24]} />
                <meshStandardMaterial color="#7fc9ff" />
              </mesh>
            </group>
          );
        }
        return (
          <mesh
            key={b.projectId}
            position={[b.x, 0.06, b.z]}
            rotation-x={-Math.PI / 2}
            receiveShadow
            onClick={clear}
            material={grassLotMaterial}
          >
            <planeGeometry args={[b.width + 0.4, b.depth + 0.4]} />
          </mesh>
        );
      })}
      {park && (
        <mesh position={[park.x, 0.06, park.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear} material={parkMaterial}>
          <circleGeometry args={[PARK_RADIUS, 24]} />
        </mesh>
      )}
    </group>
  );
}
```

Imports to add: `import { grassLotMaterial, plazaMaterial, parkMaterial } from "../../textures";` (drop `grassMaterial`/`grassTexture`/`GRASS_TILE_WORLD` and the `useEffect` + tile-repeat logic, which moved to `Terrain`).

- [ ] **Step 3: Wire in `Scene.tsx`**

Add `import { Streets } from "./Streets";` and render `<Streets streets={renderStreets} />` after `<Ground ... />`. Change `<Ground blocks={blocks} streets={renderStreets} extent={extent} />` to `<Ground blocks={blocks} />`.

- [ ] **Step 4: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/three/Streets.tsx app/src/components/three/Ground.tsx app/src/components/three/Scene.tsx
git commit -m "feat(streets): render asphalt slab boxes and slim down ground layer"
```

---

### Task 6: Sidewalks as voxels

**Files:**
- Modify: `app/src/components/three/Sidewalks.tsx`

**Interfaces:**
- Consumes: `streetSidewalkVoxels`, `SIDEWALK_SIZE` from `../../voxel`; `buildCrosswalks` from `../../crosswalk`; `Intersection`/`Street` types; `useApp` + `isPanActive`.
- Produces: one `InstancedVoxels` for all sidewalk/curb cells plus raised crosswalk planes.

- [ ] **Step 1: Rewrite `app/src/components/three/Sidewalks.tsx`**

```tsx
import { useMemo } from "react";
import { MeshStandardMaterial } from "three";
import type { Street } from "../../layout";
import type { Intersection } from "../../traffic";
import { streetSidewalkVoxels, SIDEWALK_SIZE } from "../../voxel";
import { buildCrosswalks } from "../../crosswalk";
import { CROSSWALK_BRICK } from "../../theme";
import { InstancedVoxels } from "./InstancedVoxels";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";

const CROSSWALK_MATERIAL = new MeshStandardMaterial({ color: CROSSWALK_BRICK, roughness: 1 });

export function Sidewalks({
  streets,
  intersections,
}: {
  streets: Street[];
  intersections: Intersection[];
}) {
  const clearSelection = useApp((s) => s.clearSelection);
  const voxels = useMemo(() => streetSidewalkVoxels(streets), [streets]);
  const crosswalks = useMemo(
    () => buildCrosswalks(intersections, streets),
    [intersections, streets],
  );

  const clear = (e: { stopPropagation: () => void }) => {
    if (isPanActive()) return;
    e.stopPropagation();
    clearSelection();
  };

  return (
    <group>
      <InstancedVoxels voxels={voxels} voxelSize={SIDEWALK_SIZE} onClick={clear} />
      {crosswalks.map((c, i) => (
        <mesh
          key={`cs${i}`}
          position={[c.x, 0.075, c.z]}
          rotation-x={-Math.PI / 2}
          material={CROSSWALK_MATERIAL}
          onClick={clear}
        >
          <planeGeometry args={[c.w, c.d]} />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/three/Sidewalks.tsx
git commit -m "feat(sidewalks): render raised voxel sidewalks with curbs"
```

---

### Task 7: Full verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: PASS (ground, voxel, and all existing suites).

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Run the production build**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev`, open `http://localhost:5173`. Verify:
- No grass z-fights through the streets at any zoom/rotation.
- Sidewalks are raised voxel brick with a distinct curb edge along both sides of every street.
- Street intersections have no sidewalk running across the road.
- Outer grass rolls gently toward the mountains; the city pad (blocks, lots, plaza, sidewalks) sits flat and flush.
- Clicking ground/street/sidewalk clears the selection (house click still selects).
- Frame rate remains smooth (sidewalks are one instanced draw call).

- [ ] **Step 5: Commit (if smoke found fixes, address them first)**

```bash
git add -A
git commit -m "chore: verify voxel streets and terrain build"
```

---

## Self-Review

**Spec coverage:**

- pad extent + hill-height math → Task 2.
- rolling grass terrain (flat pad) → Task 4.
- asphalt slab streets (no flat plane z-fight) → Task 5.
- raised voxel sidewalks + curbs, crossing culling → Tasks 3 + 6.
- heights (grass 0, slab 0.06, crosswalk 0.075, sidewalk 0.4) → Tasks 4-6.
- theme curb color → Task 1.
- dashes removed → Task 5.
- tests (ground + voxel) → Tasks 2, 3.
- verify build/tests → Task 7.

**Placeholder scan:** no TBD/TODO; the one placeholder test line in Task 3 is explicitly corrected in Step 4. Real code throughout.

**Type consistency:** `padOvershoot`/`hillHeight`/`cityPad`/`PAD_MARGIN` used consistently (Tasks 2, 4). `streetSidewalkVoxels(streets, size, walk, curb)` + `SIDEWALK_SIZE` used in Tasks 3, 6. `bounds`/`renderStreets`/`crosswalkIntersections` exist from `useCity()` in `city.ts`. `grassLotMaterial`/`plazaMaterial`/`parkMaterial`/`asphaltMaterial` imported from `../../textures`. `BufferAttribute` cast used in Terrain.
