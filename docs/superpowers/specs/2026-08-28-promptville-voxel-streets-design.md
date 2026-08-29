# Promptville — Voxel Streets & Rolling Terrain Design Spec

Date: 2026-08-28
Status: Draft
Branch: feat/voxel-streets

## Overview

The ground layer is built from flat planes stacked within ~0.015 world units of each other (grass `-0.05`, street `-0.045`, sidewalk `-0.035`, lot `-0.04`, plaza `-0.039`). At distance the depth buffer z-fights, so grass bleeds through the street and sidewalks flicker. This spec replaces that layer with geometrically-separated geometry on a flat city pad plus gentle rolling outer grass — streets become asphalt slabs, sidewalks become raised voxel brick walkways with curb edges, and a displaced grass terrain rises outside the ring toward the mountains.

## Goals

1. Kill the z-fighting so streets/sidewalks render cleanly everywhere (no grass through the street).
2. Give the town raised dimension (curb + sidewalk step) instead of flat painted planes.
3. Add a gentle rolling grass "terrain" in the outer area (flat city pad).
4. Keep the voxel/instanced philosophy and stay performant (sidewalks are the only dense voxel layer).

## Architecture

New/changed files:

```
app/src/
  ground.ts            # NEW: pure pad extent + hill-height math (tested), like layout.ts
  ground.test.ts       # NEW
  voxel.ts             # + streetSidewalkVoxels(street, size): Voxel[] (two strips + curb row)
  voxel.test.ts        # + sidewalk voxel tests
  theme.ts             # + CURB color (and maybe deeper brick tone)
  components/three/
    Terrain.tsx        # NEW: displaced rolling grass mesh, flat inside pad
    Streets.tsx        # NEW: asphalt slab boxes per street (polygonOffset)
    Sidewalks.tsx      # MODIFY: render voxel sidewalk strip + curb (one InstancedVoxels), keep crosswalks
    Ground.tsx         # MODIFY: drop street planes; raise lot/plaza/park heights + polygonOffset
    Scene.tsx          # MODIFY: mount Streets, Sidewalks, Terrain
```

## Geometry & Heights

Single source of truth in `app/src/ground.ts`:

- `padExtent(bounds)` — flat rectangle = city bounds expanded by `PAD_MARGIN` (one cell pitch outward). Inside it everything is flat.
- Heights (world units, grass base = 0):
  - grass base: `0`
  - street asphalt slab top: `0.06`
  - grass lots / plaza pad: `0.06`
  - crosswalk plane: `0.07`
  - sidewalk voxels: `0`..`~0.28` (1 cell tall)
  - curb voxel row: same top, darker tone, at the street-facing edge
- `hillHeight(dist)` — `0` for `dist <= padHalf`, then a smooth eased rise (sinusoidal toward the mountain ring). Used by Terrain to displace vertices.

Every thin slab uses `polygonOffset` (factor positive) so coplanar surfaces resolve deterministically; sidewalks are real 3D so they can't fight the ground.

## Ground & Terrain (`Terrain.tsx`)

Replace the flat grass base plane in `Ground.tsx` with a single gridded plane whose vertices are displaced:

- Size = `extent * 2` square, subdivided to ~a low-poly density (e.g. ~96×96 segments).
- Vertex displacement: `hillHeight(distanceFromPadCenter)` + small seeded simplex noise, clamped so the pad region stays exactly `y = 0`.
- `computeVertexNormals()` for gentle shading; grass texture tiled at `GRASS_TILE_WORLD` (reuse `grassMaterial`, repeat updated with extent as today).
- Excludes the mountain ring overlap (mountains sit on top, drawn separately).

## Voxel Sidewalks (`voxel.ts`)

New pure blueprint `streetSidewalkVoxels(street, size)`:

- Input: a `Street` (`x, z, width, depth`), `size` (voxel edge in world units, ~0.5).
- For axis-aligned streets, fill the two sidewalk strips that flank the road (top/bottom for horizontal, left/right for vertical), each `~1 cell` wide and the full street length, `1 cell` tall (`y = 0`).
- Mark the street-facing edge cells with the **curb** color (slightly darker brick); rest are brick sidewalk.
- Emits integer-cell `Voxel[]`. No voxels inside the asphalt band.
- The caller (`Sidewalks.tsx`) concatenates every street's sidewalks/curbs into one array and renders a single `<InstancedVoxels voxels={...} voxelSize={size} />` (one draw call, per-instance color).
- Voxel size tuned (~0.5) to bound the instance count to roughly tens of thousands — fine for one instanced mesh (mountains already similar).

Chosen colors from `theme.ts`: sidewalk brick reuses `COLORS.brick`; new `COLORS.curb` (a darker warm tone).

## Streets (`Streets.tsx`)

- Per street, one thin asphalt **box slab** (`s.width × 0.06 × s.depth`) centred at `(x, 0.03, z)`, `receiveShadow`, `asphaltMaterial` (existing textured asphalt), `polygonOffset`. Keeps the dark speckled asphalt look without z-fighting.
- Center-line dashes removed from the ground plane and are out of scope for this pass (kept only if already present in another layer — see Out of scope).

## Components Wiring

`Scene.tsx`:

- Replace `<Ground blocks streets renderStreets ... />` usage for the base plane with `<Terrain extent />`; keep lots/plaza/park + street clearing in `Ground.tsx`.
- Mount `<Streets streets={renderStreets} />`, `<Sidewalks ... />`.

`Ground.tsx`: remove the `streets.map(...)` asphalt plane block and the dashes; keep grass-lot, plaza, park planes (heights raised to `0.06`, `polygonOffset`).

## Testing

- `ground.test.ts`: `hillHeight` is `0` inside the pad and `> 0` and non-decreasing outside; `padExtent` derives the expected expanded rectangle from bounds.
- `voxel.test.ts` additions: `streetSidewalkVoxels` for a horizontal and a vertical street — voxels lie within footprint bounds, curb cells present on the street-facing edge, no voxels inside the asphalt band; height stays `y = 0`.
- Run `bun run typecheck`, `bun test`, `bun run build`.

## Verification (manual)

`bun run dev`:

- No grass z-fights through streets at any zoom.
- Sidewalks visibly raised above the asphalt with a curb step.
- Outer grass rolls gently toward the mountains; the city pad is flat.
- Houses, props, lots, plaza sit flush (no floating/sinking).
- Perf: town still renders at interactive frame rate (sidewalk layer is one instanced draw call).

## Out of Scope

- Skybox, day-night cycle, time-of-day lighting (deferred to subsystem B).
- Heightfield terrain under the streets/blocks (the pad stays flat).
- Any change to the traffic/road graph (visual layer only; `renderStreets` coords unchanged).
- Center-line / lane dashes and other road-marking refinements.
