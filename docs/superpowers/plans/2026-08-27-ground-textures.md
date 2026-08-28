# Ground Textures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtle, deterministic procedural canvas textures to the town's ground surfaces — streets, crosswalks, and grass — while consolidating the sidewalk brick rendering.

**Architecture:** A pure, DOM-free module (`app/src/texturePatterns.ts`) generates pattern descriptors; `app/src/textures.ts` paints them onto shared `CanvasTexture` singletons (one canvas per surface, seeded PRNG). `Ground.tsx` and `Sidewalks.tsx` swap their flat per-rect materials for these textures; crosswalks get a brick-tone restyle with a "paper shadow" band and cross both directions at each intersection.

**Tech Stack:** three.js `CanvasTexture`/`MeshStandardMaterial` (as `Sidewalks.tsx` already uses); Bun for the pure-pattern tests.

## Global Constraints

- Texture painters are browser-only (DOM canvas) — never import `app/src/textures.ts` from a test or server file.
- `app/src/texturePatterns.ts` must be DOM-free so `bun test` can import it.
- All randomness comes from `mulberry32` in `app/src/rand.ts` (deterministic — same data → same scene).
- React Compiler enabled; shared textures/materials are module-level singletons, not created in render.
- Keep the pastel toy-town identity: patterns are subtle, textures never replace the crisp white dash/centerline geometry.
- Run `bun run typecheck` (both workspaces), `bun test`, and `bun run build` after each task.

---

## File Structure

- **Create** `app/src/texturePatterns.ts` — pure: `shade`, `mottleBlobs`, `stripeBands`.
- **Create** `app/src/texturePatterns.test.ts` — unit tests for the pure patterns.
- **Create** `app/src/textures.ts` — `makeTileableTexture`, `makeMaterial`, `sidewalkMaterialFor`, six shared texture singletons + materials.
- **Modify** `app/src/theme.ts` — add texture palette constants.
- **Modify** `app/src/components/three/Ground.tsx` — grass/lot/park/asphalt/plaza materials.
- **Modify** `app/src/components/three/Sidewalks.tsx` — shared brick texture + restyled two-direction crosswalks.
- **Untouched** — all 3D voxel components, `layout.ts`, `city.ts`, traffic, HUD.

---

### Task 1: Pure texture-pattern math

**Files:**
- Create: `app/src/texturePatterns.ts`
- Test: `app/src/texturePatterns.test.ts`

**Interfaces:**
- Consumes: `mulberry32` from `app/src/rand.ts` (already exists).
- Produces:
  - `shade(hex: string, f: number): string` — mix toward white (f>0) or black (f<0), |f| clamped to 1.
  - `interface Blob { x; y; r; lighten }`
  - `mottleBlobs(size: number, count: number, rand: () => number): Blob[]`
  - `interface StripeBand { y; h; tone: number }`
  - `stripeBands(size: number, bands: number): StripeBand[]` — tiles the size, `tone` alternates 0/1.

- [ ] **Step 1: Write the failing test**

Create `app/src/texturePatterns.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mottleBlobs, shade, stripeBands } from "./texturePatterns";
import { mulberry32 } from "./rand";

describe("shade", () => {
  test("mixes toward white for f > 0 and toward black for f < 0", () => {
    expect(shade("#000000", 1)).toBe("rgb(255, 255, 255)");
    expect(shade("#ffffff", -1)).toBe("rgb(0, 0, 0)");
    expect(shade("#808080", 0)).toBe("rgb(128, 128, 128)");
    expect(shade("#808080", 1)).toBe("rgb(255, 255, 255)");
    expect(shade("#808080", -1)).toBe("rgb(0, 0, 0)");
  });
});

describe("mottleBlobs", () => {
  test("is deterministic for a given seed", () => {
    const a = mottleBlobs(128, 28, mulberry32(101));
    const b = mottleBlobs(128, 28, mulberry32(101));
    expect(a).toEqual(b);
  });

  test("stays inside the tile with a sane lighten range", () => {
    for (const blob of mottleBlobs(128, 60, mulberry32(7))) {
      expect(blob.x).toBeGreaterThanOrEqual(0);
      expect(blob.x).toBeLessThanOrEqual(128);
      expect(blob.y).toBeGreaterThanOrEqual(0);
      expect(blob.y).toBeLessThanOrEqual(128);
      expect(blob.r).toBeGreaterThan(0);
      expect(blob.lighten).toBeGreaterThanOrEqual(-0.06);
      expect(blob.lighten).toBeLessThanOrEqual(0.06);
    }
  });
});

describe("stripeBands", () => {
  test("tiles the size exactly and alternates tone", () => {
    const bands = stripeBands(128, 6);
    expect(bands[0]!.y).toBe(0);
    expect(bands[bands.length - 1]!.y + bands[bands.length - 1]!.h).toBe(128);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.y).toBeCloseTo(bands[i - 1]!.y + bands[i - 1]!.h);
    }
    expect(bands.map((b) => b.tone)).toEqual([0, 1, 0, 1, 0, 1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/texturePatterns.test.ts`
Expected: FAIL — module `./texturePatterns` not found.

- [ ] **Step 3: Implement the pure module**

Create `app/src/texturePatterns.ts`:

```ts
// Pure pattern math for the ground canvas textures. DOM-free so it runs under
// bun test; the painters in textures.ts consume these descriptors.

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = f >= 0 ? 255 : 0;
  const a = Math.min(1, Math.abs(f));
  const c = (v: number) => Math.round(v + (mix - v) * a);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export interface Blob {
  x: number;
  y: number;
  r: number;
  lighten: number;
}

export function mottleBlobs(size: number, count: number, rand: () => number): Blob[] {
  return Array.from({ length: count }, () => ({
    x: rand() * size,
    y: rand() * size,
    r: size * (0.05 + rand() * 0.15),
    lighten: -0.06 + rand() * 0.12,
  }));
}

export interface StripeBand {
  y: number;
  h: number;
  tone: number;
}

export function stripeBands(size: number, bands: number): StripeBand[] {
  const h = size / bands;
  return Array.from({ length: bands }, (_, i) => ({ y: i * h, h, tone: i % 2 }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/texturePatterns.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/texturePatterns.ts app/src/texturePatterns.test.ts
git commit -m "feat: pure ground-pattern math (shade, mottle, lawn stripes)"
```

---

### Task 2: Theme palette + texture singletons

**Files:**
- Modify: `app/src/theme.ts`
- Create: `app/src/textures.ts`

**Interfaces:**
- Consumes: `shade`, `mottleBlobs`, `stripeBands` (Task 1); `mulberry32` from `app/src/rand.ts`; `COLORS` from `app/src/theme.ts`.
- Produces (all exported from `app/src/textures.ts`):
  - `makeTileableTexture(width, height, paint): CanvasTexture`
  - `grassTexture` / `grassMaterial`
  - `grassLotTexture` / `grassLotMaterial`
  - `parkTexture` / `parkMaterial`
  - `asphaltTexture` / `asphaltMaterial`
  - `plazaTexture` / `plazaMaterial`
  - `sidewalkTexture`
  - `sidewalkMaterialFor(width: number, depth: number): MeshStandardMaterial`
  - `GRASS_TILE_WORLD = 6`

- [ ] **Step 1: Add theme palette constants**

In `app/src/theme.ts`, after `COLORS`, add:

```ts
// Ground texture palette (bases reuse COLORS; painters derive tones via shade()).
export const LAWN_B = "#7ab34a";
export const STONE_GROUT = "#e6d6bc";
export const CROSSWALK_BRICK = "#f2c9a8";
export const CROSSWALK_SHADOW = "#c9744f";
```

- [ ] **Step 2: Verify theme compiles**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Write the texture module**

Create `app/src/textures.ts`:

```ts
import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from "three";
import { mulberry32 } from "./rand";
import { mottleBlobs, shade, stripeBands } from "./texturePatterns";
import { COLORS, LAWN_B, STONE_GROUT } from "./theme";

const TILE = 128;
const GRASS_SEED = 101;
const GRASS_BLOBS = 28;
const GRASS_LOT_SEED = 202;
const GRASS_LOT_BLOBS = 20;
const PARK_SEED = 303;
const LAWN_BANDS = 6;
const ASPHALT_SEED = 404;
const ASPHALT_SPECKLES = 240;
const STONE_SEED = 505;
const STONE_TILES = 4;

// World units one texture tile covers, per surface (fixed world scale).
export const GRASS_TILE_WORLD = 6;
export const BRICK_TILE_X = 1.6;
export const BRICK_TILE_Y = 0.8;

export function makeTileableTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  paint(ctx);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function makeMaterial(texture: CanvasTexture): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ map: texture, roughness: 1 });
  material.needsUpdate = true;
  return material;
}

// Draws `draw` at the 3x3 wrapped offsets so edge-crossing shapes tile seamlessly.
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  size: number,
  draw: (dx: number, dy: number) => void,
): void {
  for (let dx = -size; dx <= size; dx += size) {
    for (let dy = -size; dy <= size; dy += size) draw(dx, dy);
  }
}

function paintGrass(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, TILE, TILE);
  const rand = mulberry32(GRASS_SEED);
  for (const blob of mottleBlobs(TILE, GRASS_BLOBS, rand)) {
    ctx.fillStyle = shade(COLORS.grass, blob.lighten);
    ctx.globalAlpha = 0.45;
    drawWrapped(ctx, TILE, (dx, dy) => {
      ctx.beginPath();
      ctx.arc(blob.x + dx, blob.y + dy, blob.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

function paintGrassLot(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.grassLot;
  ctx.fillRect(0, 0, TILE, TILE);
  const rand = mulberry32(GRASS_LOT_SEED);
  for (const blob of mottleBlobs(TILE, GRASS_LOT_BLOBS, rand)) {
    ctx.fillStyle = shade(COLORS.grassLot, blob.lighten);
    ctx.globalAlpha = 0.45;
    drawWrapped(ctx, TILE, (dx, dy) => {
      ctx.beginPath();
      ctx.arc(blob.x + dx, blob.y + dy, blob.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  // Faint vertical mow stripes (axis-aligned so the tile wraps seamlessly).
  ctx.globalAlpha = 0.5;
  const step = 16;
  for (let i = 1; i * step < TILE; i += 2) {
    ctx.fillStyle = shade(COLORS.grassLot, -0.05);
    ctx.fillRect(i * step, 0, step, TILE);
  }
  ctx.globalAlpha = 1;
}

function paintPark(ctx: CanvasRenderingContext2D): void {
  const rand = mulberry32(PARK_SEED);
  for (const band of stripeBands(TILE, LAWN_BANDS)) {
    ctx.fillStyle = band.tone === 0 ? COLORS.grassDark : LAWN_B;
    ctx.fillRect(0, band.y, TILE, band.h);
  }
  for (const blob of mottleBlobs(TILE, 10, rand)) {
    ctx.fillStyle = shade(COLORS.grassDark, blob.lighten);
    ctx.globalAlpha = 0.25;
    drawWrapped(ctx, TILE, (dx, dy) => {
      ctx.beginPath();
      ctx.arc(blob.x + dx, blob.y + dy, blob.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

function paintAsphalt(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.road;
  ctx.fillRect(0, 0, TILE, TILE);
  const rand = mulberry32(ASPHALT_SEED);
  for (let i = 0; i < ASPHALT_SPECKLES; i++) {
    const x = rand() * TILE;
    const y = rand() * TILE;
    ctx.fillStyle = rand() < 0.5 ? shade(COLORS.road, 0.05) : shade(COLORS.road, -0.07);
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

function paintStone(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, TILE, TILE);
  const rand = mulberry32(STONE_SEED);
  const t = TILE / STONE_TILES;
  for (let i = 0; i < STONE_TILES; i++) {
    for (let j = 0; j < STONE_TILES; j++) {
      ctx.fillStyle = shade(COLORS.cream, (rand() - 0.5) * 0.08);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
    }
  }
  ctx.globalAlpha = 1;
  // Grout lines: interior jittered for a natural look, edges fixed so the tile wraps.
  ctx.strokeStyle = STONE_GROUT;
  ctx.lineWidth = 2;
  for (let i = 1; i < STONE_TILES; i++) {
    const x = i * t + (rand() - 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, TILE);
    ctx.stroke();
  }
  for (let j = 1; j < STONE_TILES; j++) {
    const y = j * t + (rand() - 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TILE, y);
    ctx.stroke();
  }
}

function paintBrick(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.mortar;
  ctx.fillRect(0, 0, 96, 48);
  const rows = 2;
  const cols = 3;
  const brickH = 48 / rows;
  const brickW = 96 / cols;
  const mortar = 3;
  ctx.fillStyle = COLORS.brick;
  for (let r = 0; r < rows; r++) {
    const y = r * brickH;
    const off = r % 2 === 0 ? 0 : brickW / 2;
    for (let c = 0; c < cols; c++) {
      const x = c * brickW + off;
      ctx.fillRect(x, y + mortar / 2, brickW - mortar, brickH - mortar);
    }
  }
}

export const grassTexture = makeTileableTexture(TILE, TILE, paintGrass);
export const grassMaterial = makeMaterial(grassTexture);
export const grassLotTexture = makeTileableTexture(TILE, TILE, paintGrassLot);
export const grassLotMaterial = makeMaterial(grassLotTexture);
export const parkTexture = makeTileableTexture(TILE, TILE, paintPark);
export const parkMaterial = makeMaterial(parkTexture);
export const asphaltTexture = makeTileableTexture(TILE, TILE, paintAsphalt);
export const asphaltMaterial = makeMaterial(asphaltTexture);
export const plazaTexture = makeTileableTexture(TILE, TILE, paintStone);
export const plazaMaterial = makeMaterial(plazaTexture);

// Brick sidewalk: one shared canvas; per-strip clones carry only their own
// repeat so brick world-scale stays constant on varying-length strips.
export const sidewalkTexture = makeTileableTexture(96, 48, paintBrick);

export function sidewalkMaterialFor(width: number, depth: number): MeshStandardMaterial {
  const tex = sidewalkTexture.clone();
  tex.repeat.set(Math.max(1, width / BRICK_TILE_X), Math.max(1, depth / BRICK_TILE_Y));
  tex.needsUpdate = true;
  const material = new MeshStandardMaterial({ map: tex, roughness: 1 });
  material.needsUpdate = true;
  return material;
}
```

- [ ] **Step 4: Verify it typechecks and builds**

Run: `bun run typecheck` then `bun run build`
Expected: PASS (module is browser-only; nothing imports it in tests yet).

- [ ] **Step 5: Commit**

```bash
git add app/src/theme.ts app/src/textures.ts
git commit -m "feat: shared ground canvas textures (grass, lots, park, asphalt, plaza, brick)"
```

---

### Task 3: Wire Ground.tsx to the new materials

**Files:**
- Modify: `app/src/components/three/Ground.tsx`

**Interfaces:**
- Consumes: `grassTexture`/`grassMaterial`, `grassLotMaterial`, `parkMaterial`, `asphaltMaterial`, `plazaMaterial`, `GRASS_TILE_WORLD` (Task 2); `useEffect` from React.
- Produces: textured ground — grass field (repeat scales with extent), asphalt streets, grass lots, stone plaza, lawn-striped park. Centerline dashes unchanged.

- [ ] **Step 1: Update imports**

In `app/src/components/three/Ground.tsx`:

```ts
import { useEffect } from "react";
import type { PlacedBlock, Street } from "../../layout";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";
import { COLORS } from "../../theme";
import { pickParkSpot, PARK_RADIUS } from "../../placement";
import {
  asphaltMaterial,
  grassLotMaterial,
  grassMaterial,
  grassTexture,
  GRASS_TILE_WORLD,
  parkMaterial,
  plazaMaterial,
} from "../../textures";
```

- [ ] **Step 2: Add the grass-repeat effect**

In `Ground`, before the `if (blocks.length === 0) return null;` guard, add:

```tsx
useEffect(() => {
  const repeat = Math.max(2, Math.round((extent * 2) / GRASS_TILE_WORLD));
  grassTexture.repeat.set(repeat, repeat);
  grassTexture.needsUpdate = true;
}, [extent]);
```

- [ ] **Step 3: Swap materials**

Replace the per-mesh inline materials:

- Grass plane (`<meshStandardMaterial color={COLORS.grass} />`) → `material={grassMaterial}`.
- Street meshes (`<meshStandardMaterial color={COLORS.road} />`) → `material={asphaltMaterial}` (keep the dashes' `COLORS.roadLine` material as-is).
- Grass lots (`<meshStandardMaterial color={COLORS.grassLot} />`) → `material={grassLotMaterial}`.
- Plaza pad (`<meshStandardMaterial color="#f7efe0" />`) → `material={plazaMaterial}`.
- Park circle (`<meshStandardMaterial color={COLORS.grassDark} />`) → `material={parkMaterial}`.

- [ ] **Step 4: Verify**

Run: `bun run typecheck` then `bun test` then `bun run build`
Expected: all PASS (no behavior change tested — surfaces are visual).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/three/Ground.tsx
git commit -m "feat: textured grass, asphalt, lots, plaza, and park ground"
```

---

### Task 4: Sidewalks + restyled two-direction crosswalks

**Files:**
- Modify: `app/src/components/three/Sidewalks.tsx`

**Interfaces:**
- Consumes: `sidewalkTexture`? No — `sidewalkMaterialFor(width, depth)` (Task 2); `CROSSWALK_BRICK`, `CROSSWALK_SHADOW` (Task 2 theme); `Street`, `Intersection`.
- Produces: shared-texture sidewalks (per-strip repeat), brick-tone crosswalks with a "paper shadow" band over **both** the avenue and the side street at each intersection.

- [ ] **Step 1: Rewrite Sidewalks.tsx**

Replace the whole file with:

```tsx
import { useMemo } from "react";
import { MeshStandardMaterial } from "three";
import type { Street } from "../../layout";
import type { Intersection } from "../../traffic";
import { sidewalkMaterialFor } from "../../textures";
import { CROSSWALK_BRICK, CROSSWALK_SHADOW } from "../../theme";

const SIDEWALK_WIDTH = 0.7;
const CROSS_SPACING = 0.5;
const CROSS_WIDTH = 0.4;
const SHADOW_OFFSET = 0.08;

const CROSSWALK_MATERIAL = new MeshStandardMaterial({ color: CROSSWALK_BRICK, roughness: 1 });
const CROSSWALK_SHADOW_MATERIAL = new MeshStandardMaterial({ color: CROSSWALK_SHADOW, roughness: 1 });

interface SidewalkRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export function Sidewalks({
  streets,
  intersections,
}: {
  streets: Street[];
  intersections: Intersection[];
}) {
  const sidewalks = useMemo<SidewalkRect[]>(() => {
    const out: SidewalkRect[] = [];
    for (const s of streets) {
      if (s.width >= s.depth) {
        out.push({ x: s.x, z: s.z - s.depth / 2 - SIDEWALK_WIDTH / 2, w: s.width, d: SIDEWALK_WIDTH });
        out.push({ x: s.x, z: s.z + s.depth / 2 + SIDEWALK_WIDTH / 2, w: s.width, d: SIDEWALK_WIDTH });
      } else {
        out.push({ x: s.x - s.width / 2 - SIDEWALK_WIDTH / 2, z: s.z, w: SIDEWALK_WIDTH, d: s.depth });
        out.push({ x: s.x + s.width / 2 + SIDEWALK_WIDTH / 2, z: s.z, w: SIDEWALK_WIDTH, d: s.depth });
      }
    }
    return out;
  }, [streets]);

  const sidewalkMaterials = useMemo(
    () => sidewalks.map((sw) => sidewalkMaterialFor(sw.w, sw.d)),
    [sidewalks],
  );

  // Crosswalks cross both the avenue and the side street at each intersection;
  // each crossing has a shadow band offset behind its stripes ("paper shadow").
  const crosswalks = useMemo(() => {
    const stripes: SidewalkRect[] = [];
    const bands: SidewalkRect[] = [];
    for (const it of intersections) {
      const avenue = streets.find((s) => s.width >= s.depth && Math.abs(s.z - it.z) < 0.01);
      if (avenue) {
        bands.push({ x: it.x - 0.85, z: it.z - avenue.depth / 2 - 0.15, w: 1.9, d: avenue.depth + 0.3 });
        for (let i = -1; i <= 2; i++) {
          stripes.push({ x: it.x + i * CROSS_SPACING - 0.15, z: it.z, w: CROSS_WIDTH, d: avenue.depth });
        }
      }
      const side = streets.find((s) => s.width < s.depth && Math.abs(s.x - it.x) < 0.01);
      if (side) {
        bands.push({ x: it.x - side.width / 2 - 0.15, z: it.z - 0.85, w: side.width + 0.3, d: 1.9 });
        for (let i = -1; i <= 2; i++) {
          stripes.push({ x: it.x, z: it.z + i * CROSS_SPACING - 0.15, w: side.width, d: CROSS_WIDTH });
        }
      }
    }
    return { stripes, bands };
  }, [intersections, streets]);

  return (
    <group>
      {sidewalks.map((sw, i) => (
        <mesh key={i} position={[sw.x, -0.035, sw.z]} rotation-x={-Math.PI / 2} receiveShadow material={sidewalkMaterials[i]}>
          <planeGeometry args={[sw.w, sw.d]} />
        </mesh>
      ))}
      {crosswalks.bands.map((c, i) => (
        <mesh
          key={`sb${i}`}
          position={[c.x + SHADOW_OFFSET, -0.042, c.z + SHADOW_OFFSET]}
          rotation-x={-Math.PI / 2}
          material={CROSSWALK_SHADOW_MATERIAL}
        >
          <planeGeometry args={[c.w, c.d]} />
        </mesh>
      ))}
      {crosswalks.stripes.map((c, i) => (
        <mesh
          key={`cs${i}`}
          position={[c.x, -0.041, c.z]}
          rotation-x={-Math.PI / 2}
          material={CROSSWALK_MATERIAL}
        >
          <planeGeometry args={[c.w, c.d]} />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Verify**

Run: `bun run typecheck` then `bun test` then `bun run build`
Expected: all PASS. The `sidewalkMaterialFor` clones share the brick canvas; crosswalk geometry unchanged in count per direction, doubled at full 4-way intersections.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/three/Sidewalks.tsx
git commit -m "feat: shared brick sidewalks and brick-tone two-way crosswalks"
```

---

### Task 5: Full verification + spec sync

**Files:**
- Modify: `docs/superpowers/specs/2026-08-27-ground-textures-design.md` (already updated for material clones + grain-only asphalt — verify wording)
- Test: full suite

- [ ] **Step 1: Full verification**

Run: `bun run typecheck` then `bun test` then `bun run build`.
Expected: all PASS (existing 96 tests stay green; new pattern tests pass).

- [ ] **Step 2: Manual smoke (dev server)**

The dev server (`bun run dev`) is already running with HMR. Visually confirm: grass mottling, lot mow stripes, park lawn stripes, asphalt grain, stone plaza, brick sidewalks (same scale as before), brick-tone crosswalks with shadow band in both directions at intersections, dashed centerline unchanged.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: ground textures — verified"
```

---

## Self-Review

**1. Spec coverage:**
- Six surfaces textured → Task 2 (all six) + Task 3 (Ground wiring). ✓
- Sidewalk consolidation (one canvas, per-strip clones) → Task 2 `sidewalkMaterialFor` + Task 4. ✓
- Crosswalk restyle + both directions + paper shadow → Task 4. ✓
- Determinism (seeded PRNG) → Task 1 patterns + Task 2 seeds. ✓
- No new unit tests for DOM painters; pure math tested → Task 1. ✓

**2. Placeholder scan:** All steps have complete code; no TODOs/TBDs.

**3. Type consistency:**
- `makeTileableTexture(width, height, paint)` signature consistent across all call sites (Task 2). ✓
- `sidewalkMaterialFor(width, depth)` used identically in Task 4. ✓
- `GRASS_TILE_WORLD` exported in Task 2, consumed in Task 3. ✓
- `CROSSWALK_BRICK`/`CROSSWALK_SHADOW` defined in Task 2 theme, consumed in Task 4. ✓
- Crosswalk stripe geometry uses `SidewalkRect` — same shape as `stripeBands`'s `StripeBand`? No — distinct types; no name collision. ✓

**Deviations from the spec (documented):**
- Asphalt uses isotropic grain only (no wear lanes) — lanes would misalign on vertical streets with a shared texture.
- Grass-lot mow stripes are axis-aligned (vertical) instead of 45° so the tile wraps seamlessly.