---
name: environment-primitives
description: Use when creating or modifying environment / scenery voxel blueprints for the Promptville scene — floors (flagstone, plank, tile, cobble), flora (grass, flowers, bushes, tall-grass patches), foliage (leaf clusters, hedge blocks), rocks/boulders, trees (trunk + canopy variants), masonry wall patterns (brick, stone, mortar), and lighting props (lamps, lanterns, solar). When asked to "build a park/forest/rock garden," "make floors/masonry/rocks," or generate a natural voxel scatter; when working with app/src/voxel.ts, InstancedVoxels, placeVoxels, Voxel[], the ground/texture system, or a seeded scatter. Covers voxelized environment composition, not mesh voxelization, terrain meshing, or shader material authoring.
---

# Environment Primitives

## Overview

Environment primitives are `Voxel[]` blueprints for the natural and built background of Promptville — the ground treatments, flora, foliage, rocks, trees, masonry, and lighting props that dress the space between the buildings. They follow the same rules as `voxel-forms`: a plain `Voxel[]` on a unit grid, translated with `placeVoxels`, rendered as one `InstancedMesh` via `InstancedVoxels`, colours pulled from `app/src/theme.ts` + `app/src/voxel.ts` constants.

**The design tension.** Buildings are few and each carries identity. Environment primitives are **many and repeated** — dozens of bushes, a field of grass, a scatter of rocks. Identity is not the goal for each unit; **natural variety + a repeatable field** is. The unit must be believable in isolation AND cheap to repeat. So the levers shift from "silhouette + hero mark" to **deterministic scatter, per-instance variation, and a low cell budget per unit.**

The three-low-poly repo is the reference for the *style vocabulary* and the *scatter/factory* thinking (seeded layout, per-instance colour, merged/instanced batching). This skill translates that vocabulary into Promptville's voxel primitives.

## Voxel vs. Ground System (read this first)

Promptville has **two ground paths** — don't blur them:

1. **Flat surfaces** (grass, roads, crosswalks, plaza) → `app/src/textures.ts` `makeTileableTexture` + a `<mesh>` + `<planeGeometry>` in `Ground.tsx`. Textured planes, never voxels. Use this for the *base* ground the city sits on.
2. **Dimensional features** (flagstone seats, plank decking, boulders, tree canopies, lamps) → voxel blueprints via `InstancedVoxels`. Use this for anything with height or that should catch a shadow.

**Rule:** a *flat, walkable expanse* is a textured plane. Anything *raised, protruding, or silhouetted* is a voxel. Don't voxelize a whole lawn — that's thousands of cells for a flat surface. Voxelize the *details*: a stone path, a planter, a bench of grass tufts, a rock ring.

## Determinism + Seeded Scatter

Repeated environment is only believable if it's stable. **Never `Math.random()`.** Seed every scatter with `mulberry32` from `app/src/rand.ts`:

```ts
import { mulberry32 } from "./rand";
const rand = mulberry32(seed);
const x = (rand() - 0.5) * width;
const z = (rand() - 0.5) * depth;
```

`app/src/voxel.ts` blueprints are **pure** — no randomness inside a blueprint (pass options in). Do the scatter at the *call site*: build the layout (positions/seed/scale/tint) with `mulberry32`, then call a pure `Voxel[]` builder per unit and concatenate. This keeps the blueprint testable and the field reproducible.

For repeated units, vary **scale, yaw, tint, and offset** — not the geometry. Per-instance colour via `setColorAt` (rendered automatically) and per-instance transform via the instance matrix.

## Composition Pattern (per category)

Each category is a **pure builder + a call-site scatter**:

```ts
// pure unit builder (in voxel.ts) — no randomness, no world coords
export function tuftVoxels(color: string): Voxel[] { ... }

// call-site scatter (deterministic)
export function grassPatchVoxels(width: number, depth: number, seed: number): Voxel[] {
  const rand = mulberry32(seed);
  const voxels: Voxel[] = [];
  for (let i = 0; i < COUNT; i++) {
    const bx = (rand() - 0.5) * width;
    const bz = (rand() - 0.5) * depth;
    const jitter = (rand() - 0.5) * 0.4;
    voxels.push(...tuftVoxels(GRASS).map((v) => ({ ...v, x: v.x + bx + jitter, z: v.z + bz + jitter })));
  }
  return voxels;
}
```

Then render with `<InstancedVoxels voxels={voxels} voxelSize={0.2} />`.

## The Core Algorithm: Enumerate-and-Predicate

Every voxel blueprint reduces to one idea: **a shape is a predicate over grid cells.** Iterate the bounding cell region; emit a `Voxel` only where the predicate is true; give it a colour cell. Write it once and every shape falls out of the predicate:

```
Voxel[] = for each (x, y, z) in the bounding region:
            if shapePredicate(x, y, z):  emit { x, y, z, color(x, y, z) }
```

The "shape primitives" are just named predicates:

| Pattern | Predicate (test the cell) | Example |
|---|---|---|
| **Perimeter shell** | `\|x\| === hw \|\| \|z\| === hd` | hollow building walls |
| **Solid fill** | `true` inside the bounds | roof slab, cobble, trunk |
| **Shrinking ring / pyramid** | `r = hw - layer` derived from `y` | pitched roof, tree canopy, dome |
| **Radial ridge** | `t = \|d - radius\|`, emit where `t < halfWidth` | `mountainRingVoxels` |
| **Overlay / decor** | append a specific cell after the base | door, window, hero sign |

Write the base mass with one predicate, then append decor cells. Do **not** emit a solid cube when you meant a hollow shell — pick the predicate first, then fill the loop.

Three invariants hold for every blueprint (the tests in `app/src/voxel.test.ts` assert them):

1. **Pure + deterministic** — no `Math.random()`; colours from `theme.ts`/`voxel.ts` constants or params.
2. **Bounded** — cells stay inside the footprint / half-extents; `y = 0` is ground.
3. **Composable** — base shape emitted first, then decorations overwrite/append at specific cells, then `placeVoxels` translates the unit onto world coords and `InstancedVoxels` renders it.

## Category Recipes

Ladder: each recipe = **unit shape** + **repeat** rule. Adjust `Y_SCALE`/sizes to the voxel size (props ~0.15-0.25).

### Floor — dimensional stone paths & decking

For a **raised** surface that must catch shadows (a stepping path, a deck, a plaza edge). Keep it thin (1-2 cells tall) so it doesn't read as a wall.

- **Flagstone path**: individual slabs with a **grout gap** — place `W×H` pads at intervals with a gap, each offset + tinted (lightness, not hue). The gaps give perspective depth for free (three-low-poly `FlagstoneFloor` insight).
- **Plank decking**: rows of boards laid along one axis, ends butted with a **staggered joint** in neighbouring rows; a shortened starter board; never a runt at the end of a run (three-low-poly `PlankFloor`/`HardwoodFloor` insight).
- **Cobble set**: irregular small cells; vary height by ±1 to add a bumpy silhouette.

```ts
// flagstone: one slab unit = a 2×2 pad, 1 tall. Scatter pads with a gap.
export function flagstoneVoxels(color: string): Voxel[] {
  const v: Voxel[] = [];
  for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) v.push({ x, y: 0, z, color });
  return v;
}
// call site: gap = 1 cell between pads; jitter each pad's tint (lightness), never hue.
```

### Flora — grass, flowers, bushes, tall-grass patches

The small living things. Each unit is tiny (1-3 cells); variety comes from the field.

- **Grass tuft**: 1-3 vertical cells in a tight cluster, height jittered.
- **Flowers**: the existing `flowersVoxels` pattern (a 3×3 ground blot + upright blooms, per-instance colour from `FLOWER_COLORS`).
- **Bush**: existing `bushVoxels` — a rounded clump; vary tint, squash (scale y), and yaw.
- **Tall-grass patch**: a dense scatter of tufts with a colour gradient from ground to tip.

### Foliage — leaf clusters & hedge blocks

Bulk greenery, not individual leaves. One voxel = a leafy blob, not a leaf.

- **Leaf cluster**: a rounded 3×3×2 blob (use the tree-canopy profile) — the foliage unit for trees and hedges.
- **Hedge block**: a low rectangular mass along a path; cap it with a slightly wider top row for a clipped top.
- **Foliage shaderless rule**: tint per-instance (green variance in lightness, never hue — a hue shift reads as rot). The `three-low-poly` leaf example double-sides and uses flat shading; in voxels just keep the palette in the green family.

### Rocks — boulders & stone clusters

Nearly always a **field/ring**, with heavy per-instance variation. This is the `scatterMossyRocks` idea from three-low-poly, voxelized.

- **Boulder unit**: an irregular 2-3 cell lump, taller in the middle, with a corner rounded off (skip a corner cell).
- **Mossy rock**: a boulder with a 1-cell green cap (`BUSH_COLOR`) on top.
- **Scatter**: seeded placement with **clearance** (a minimum gap between neighbours, or a max local density) so rocks don't overlap into a wall; arrange in a ring around a plaza/park or along a path. Vary scale (0.6-1.3) and yaw.

### Trees — trunk + canopy variants

Two eras: 2-4 cell trunk + a canopy mass. Give variants by **canopy shape**, not detail.

- **Round** (existing `treeVoxels`): stepped blob, blockier corners trimmed.
- **Pine/cone**: canopy narrows to a point (a stepped pyramid of foliage), taller trunk.
- **Bulk oak**: wide, squat canopy (3×3 bottom, 1-2 rows), short chunky trunk.
- **Palm-ish / exotic**: a tall trunk with a small irregular top cluster.
- Variants differ by **canopy profile** (columns of foliage) — one builder, a `shape` option. Trunk colour `TRUNK_COLOR`, canopy from the green family.

### Masonry — wall & brick voxel patterns

The built surface between/around buildings — a retaining wall, a planter curb, a fence pier. Pattern, not identity.

- **Brick coursing**: rows of `W`-wide cells, offset by half a brick each row (running bond), with the mortar colour in the gaps. Use brick body + the mortar tone from `theme.ts` (`COLORS.brick` / `COLORS.mortar`).
- **Stone block**: larger blocks, irregular sizes, grout gap.
- **Curb / planter wall**: a 1-2 cell high hollow run; cap with a top row that overhangs by one cell.
- **Arch you can't extrude**: for an arched opening, approximate with a stepped taper (the `landmarkVoxels` massing idea inverted) — don't try to carry an `ArchGeometry` curve into voxels.

```ts
// brick coursing: half-offset rows
export function brickWallVoxels(width: number, rows: number, brick: string, mortar: string): Voxel[] {
  const v: Voxel[] = [];
  const push = (x: number, y: number, z: number, c: string) => v.push({ x, y, z, color: c });
  for (let y = 0; y < rows; y++) {
    const offset = y % 2 === 0 ? 0 : 1;
    for (let x = 0; x < width; x++) {
      push(x, y, 0, (x + offset) % 2 === 0 ? brick : mortar); // running bond
    }
  }
  return v;
}
```

### Lighting — lamps, lanterns, solar props

Static, emissive-lit voxel props (driven by the day/night cycle in `LitWindows`/`Signals` — not self-authored shaders).

- **Street lamp**: the existing `lampVoxels` (pole + glow cap), placed along curbs by a seeded run.
- **Lantern**: a small post with a glowing head; a "lit at night" marker the `night.ts` system can toggle.
- **Solar / bollard**: a short ground post with a cap — cheap to place in dense lines.
- Glow colour from `LAMP_GLOW` / `GLOW_COLOR`. For night brightness, reuse the `nightRef`/emissive pattern seen in `LitWindows.tsx` rather than a new material.

## Workflow

1. **Pick the path** — flat surface goes to `textures.ts`/`Ground.tsx`; raised/dimensional goes to a voxel blueprint. Don't voxelize the flat lawn.
2. **Write the pure unit builder** in `app/src/voxel.ts` (no randomness, no world coords, colours from constants).
3. **Write the call-site scatter** with `mulberry32` seed — positions, scale, yaw, tint (lightness), clearance.
4. **Concatenate & render** — one `Voxel[]` → `<InstancedVoxels voxels={voxels} voxelSize={...} />`.
5. **Test** — add a test asserting units stay in bounds and the field is deterministic for a seed (see `app/src/voxel.test.ts`).
6. **Verify** — `bun run dev`; confirm the field reads naturally, per-instance tint varies (lightness, not hue), and draw calls stay low (one InstancedMesh per field).

## Common Mistakes

- **Voxelizing a flat lawn.** A walkable flat surface is a textured plane; a voxel field of a whole grass area is thousands of cells for nothing. Voxelize the details.
- **Hue-drift per instance.** A rock or tree tinted by hue reads as rot/stain. Vary **lightness** — that's the three-low-poly `FlagstoneFloor` lesson (lightness = wear, hue = stain).
- **`Math.random()` in a scatter.** Breaks determinism; the field reshuffles every reload. Seed with `mulberry32`.
- **Overlapping scatter into a wall.** Rocks/bushes piled without clearance become a blob. Enforce a min gap or a max local density.
- **Carrying an arch curve into voxels.** Approximate an arch with a stepped taper; don't try to replicate `ArchGeometry`.
- **Authoring a new glow material.** Reuse the existing day/night emissive pattern (`LitWindows.tsx` / `night.ts`) — `LAMP_GLOW`, `GLOW_COLOR`.
- **Hardcoding hex in a blueprint.** Always from `theme.ts` + `voxel.ts` constants.

## References

- `SKILL.md` — this design language.
- Floor & masonry detail and the unit/scatter code patterns: `references/patterns.md`.
- Existing unit builders to extend: `treeVoxels`, `bushVoxels`, `flowersVoxels`, `lampVoxels`, `fountainVoxels`, `benchVoxels` in `app/src/voxel.ts`.
- Ground system: `app/src/textures.ts`, `app/src/components/three/Ground.tsx`.
- Seeded RNG: `app/src/rand.ts` (`mulberry32`).
