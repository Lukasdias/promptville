---
name: voxel-forms
description: Define voxel building and prop blueprints for the Promptville 3D scene (React Three Fiber). Use when creating or modifying voxelized buildings (hospital, police, mall, bakery, pet shop, fire station), houses, trees, props, or scenery; when asked to "make X out of voxels" or design a new voxel form; when working with app/src/voxel.ts, InstancedVoxels, placeVoxels, or a Voxel[] blueprint. Covers the procedural-composition pattern (declarative primitives), not mesh voxelization, SVOs, or meshing optimization.
---

# Voxel Forms

## Overview

A voxel form in Promptville is a plain `Voxel[]` on a unit grid — `{ x, y, z, color }` where x/z/y are integer cell indices and the form spans y = 0..height (y=0 sits on the ground). Forms are built by composing shape primitives, then translated to world space with `placeVoxels` and rendered as one `InstancedMesh` via `InstancedVoxels`. One InstancedMesh per object keeps draw calls flat; do not hand-place individual `<mesh>` elements.

## Core Pattern (Procedural Composition)

Choose pattern 3 (procedural generation) from voxelization taxonomy: shapes are described by loops and math over grid cells, not converted from meshes. Concretely:

- **Footprint-first**: pick a footprint `W×D` (odd integers, ~5-9 cells) and wall height `walls`.
- **Hollow walls**: iterate the perimeter ring `(x,z)` where `|x|===hw || |z|===hd`, stacking `walls` cells of the body color.
- **Roofs**: pitched = stepped pyramid (layer `r` shrinks per y); flat = solid slab + optional antenna.
- **Decorations**: door/window cells overwrite wall cells at known coordinates; add one or two distinguishing marks (sign, siren, awning, cross) so each building reads instantly.
- **Symmetric + front-facing**: the front face is `+z`; keep forms symmetric about the x/z axes so rotation stays predictable.

## Workflow

1. **Read the theme** — pull colors from `app/src/theme.ts` and color constants from `app/src/voxel.ts` (DOOR_COLOR, WINDOW_COLOR, etc.). No raw hex literals buried in blueprints.
2. **Write the blueprint** in `app/src/voxel.ts` as `export function <name>Voxels(opts): Voxel[]`, composed from the primitives in `references/primitives.md`.
3. **Translate** — callers translate the unit form to world coords with `placeVoxels(pattern, bx, bz, size)` and render with `<InstancedVoxels voxels={...} voxelSize={size} />`.
4. **Test** — add a test asserting the blueprint emits voxels within its footprint bounds and that distinct forms are distinguishable (see `app/src/voxel.test.ts`).
5. **Verify visually** — run `bun run dev`; confirm the form is legible at town scale and matches the cartoon palette.

## Conventions

- `Voxel` cells are integers; `y=0` is ground level; a form's height is its `walls` (+ roof).
- Voxel sizes: buildings ~0.35-0.5, props ~0.15-0.25. Match the size to `placeVoxels`' `size` so one cell ≈ one rendered cube.
- Front face is `+z`. Doors centered at `(0,0,hd)`, windows mirrored at `±2`.
- Never mutate the opencode DB; blueprints are pure — no randomness inside a blueprint (pass options in).
- Blueprints may be shared by many instances via `InstancedVoxels`; per-object variation (color) belongs in the options/params, not in the geometry.

## Primitives Reference

See `references/primitives.md` for the reusable shape primitives (box fill, hollow walls, slab, stepped pyramid, columns, decorations) with canonical examples.