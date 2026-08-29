---
name: voxel-forms
description: Use when creating or modifying voxelized buildings (hospital, police, mall, bakery, pet shop, fire station), houses, trees, props, or scenery; when asked to "make X out of voxels" or design a new voxel form; when a building reads as brutalist/boxy/plain and needs cartoon identity; when working with app/src/voxel.ts, InstancedVoxels, placeVoxels, or a Voxel[] blueprint. Covers the procedural-composition pattern with a cartoon design language, not mesh voxelization, SVOs, or meshing optimization.
---

# Voxel Forms

## Overview

A voxel form in Promptville is a plain `Voxel[]` on a unit grid — `{ x, y, z, color }` where x/z/y are integer cell indices and the form spans y = 0..height (y=0 sits on the ground). Forms are built by composing shape primitives, then translated to world space with `placeVoxels` and rendered as one `InstancedMesh` via `InstancedVoxels`. One InstancedMesh per object keeps draw calls flat; do not hand-place individual `<mesh>` elements.

**The design goal is not "a box with a roof."** A blank box reads as brutalist — identical silhouette, flat facades, mud palette. Every form needs *identity*: a distinct silhouette, playful proportions, confident color blocking, and at least one character mark that names it. Build the identity into the blueprint, not as an afterthought.

## The Design Is Decided by Silhouette First

The single highest-leverage decision is the **silhouette** — the shape you'd draw if you traced the outline with one line. Sketch 3-5 candidate outlines before writing any code. Pick the one that is unique at a glance; any two forms should be separable from their outline alone, even before colour is applied.

Rules of thumb (pick and exaggerate, not all at once):

- **Vary the massing.** Not every form is a box. Give at least one: a step-back / setback, a tower on a wider base, a dome, a spire, a chunky overhang, a rounded (corner-rounded) footprint.
- **Push the hero element to the extreme.** A sign is 3 cells wide, not 1. Eaves overhang a full cell. A dome is 3-4 cells tall. Cartoon = exaggeration; if you'd describe it as "reasonable," push it further.
- **Break the rectangle at the roofline.** The top of the form carries the most identity. A stepped pyramid, a flat cap with a parapet, a dome, a gable with a chimney — anything but a naked slab.
- **Round a corner or two.** Cartoon forms are rarely razor-edged. Removing a corner cell (or a plinth flare) softens the block and reads "designed" not "imported".

## Cartoon Design Language (the anti-brutalist layer)

Primitives in `references/primitives.md` give you the shapes. This layer tells you how to *compose* them into something with personality. Use the checklist at the bottom to gate a form before you ship it.

### Silhouette
- Distinct outline first (see above). Two forms may share a footprint but must differ in massing or crown.
- Prefer **odd** footprints (5/7/9) so features centre on x=0/z=0 and mirror cleanly.

### Proportion
- **Exaggerate.** Cartoon = unrealistic ratio. A door is 1 cell wide (`walls` tall); a hero sign is 3-5 cells. A dome is a capital, not a bump.
- **Depth cues over flat faces.** Recess the door/window one cell (inset) or push an eave/awning one cell out (proud). Flat voxel faces with nothing proud or inset is what reads "brutalist concrete".

### Colour blocking
- 3-4 colours max per form: body, accent, roof, plus one **hero** colour for the identity mark. Pull them from `app/src/theme.ts` + constants in `app/src/voxel.ts`. No raw hex in blueprints.
- **Flat confident blocks, not mud.** Cartoon wants high-contrast planes. Keep the accent band and roof distinct; don't blend or drift hues. (Hue-jitter makes a *food* — a pumpkin patch; a building wants flat blocks — see the three-low-poly `FlagstoneFloor` note: lightness variance reads as wear, hue drift reads as stain.)
- Reuse the hero colour for the mark (cross/siren/etc.) so it reads as the building's voice.

### Character mark
- **One dominant mark that names the building**, plus at most one secondary. A hospital = the red cross. A mall = the awning row + rooftop band. A fire station = the tower + bell. If you have more than two marks, cut them.
- Place the mark where it's visible from `+z` (the front) and from the street. Don't bury it on the rear.

### Grounding
- A form should sit *on* the ground, not float. Add a **plinth/base** (1-2 cells of a darker or body colour) and a **door step** (a single proud cell at the doorway) so the building is clearly planted.

## Core Pattern (Procedural Composition)

Choose pattern 3 (procedural generation) from the voxelization taxonomy: shapes are described by loops and math over grid cells, not converted from meshes.

1. **Start from a silhouette** — pick the outline from your sketches; note where the tower/dome/step-back sits.
2. **Footprint → walls**: iterate the footprint, building walls (hollow or with a tower), stacking `walls` cells of the body colour.
3. **Crown**: roof that extends the silhouette — stepped pyramid, dome, flat parapet, tower cap. This is where most identity lives.
4. **Colour block**: accent band at a fixed row, roof plate, and the hero mark.
5. **Depth cues**: inset door/window, proud eave/awning, plinth, corner rounding.
6. **Verify** it passes the character checklist.

## Workflow

1. **Read the theme** — pull colours from `app/src/theme.ts` and constants from `app/src/voxel.ts` (DOOR_COLOR, WINDOW_COLOR, AWNING_COLORS, etc.). No raw hex literals buried in blueprints.
2. **Write the blueprint** in `app/src/voxel.ts` as `export function <name>Voxels(opts): Voxel[]`, composed from the primitives in `references/primitives.md`.
3. **Translate** — callers translate the unit form to world coords with `placeVoxels(pattern, bx, bz, size)` and render with `<InstancedVoxels voxels={...} voxelSize={size} />`.
4. **Test** — add a test asserting the blueprint emits voxels within its footprint bounds and that distinct forms are distinguishable (see `app/src/voxel.test.ts`).
5. **Verify visually** — run `bun run dev`; confirm the form is legible at town scale, matches the cartoon palette, and reads as its own thing.

## Character Checklist (gate a form before shipping)

- Does it read at ~0.4 voxel scale from a distance — one glance identifies it?
- Is the silhouette distinct from every other form, ignoring colour?
- Is the `+z` front face legible and facing the street?
- Is there exactly **one** clear hero element (dominant mark / crown / massing)?
- Are the colours flat and confident (body/accent/roof/hero) — no mud?
- Are there depth cues (inset door, proud eave/awning, plinth)?
- Does it sit on the ground (plinth/step), not float?

If any answer is no — go back and push the massing or the mark before adding more detail. More detail on a bad silhouette just makes a busy box.

## Conventions

- `Voxel` cells are integers; `y=0` is ground level; a form's height is its `walls` (+ roof).
- Voxel sizes: buildings ~0.35-0.5, props ~0.15-0.25. Match the size to `placeVoxels`' `size` so one cell ≈ one rendered cube.
- Front face is `+z`. Doors centred at `(0,0,hd)`, windows mirrored at `±2`.
- Never mutate the opencode DB; blueprints are pure — no randomness inside a blueprint (pass options in).
- Blueprints may be shared by many instances via `InstancedVoxels`; per-object variation (colour) belongs in the options/params, not in the geometry.

## Primitives Reference

See `references/primitives.md` for the reusable shape primitives — both the geometric ones (box fill, hollow walls, slab, stepped pyramid, columns) and the identity levers (overhang eave, inset window, awning row, plinth/base, stepped dome, corner rounding, hero sign) — with canonical examples.

## Common Mistakes

- **Adding detail before fixing the silhouette.** A busy box is still a box. Massing first.
- **Per-building hue drift / mottling.** Buildings want flat, confident colour blocks — not a stain. Use the hero colour for the mark.
- **A single-cell hero mark that vanishes at distance.** Make the sign 3-5 cells; push the crown.
- **Burying the mark on the rear or roof the camera never sees.** Face `+z` and the street.
- **Forgetting the plinth.** A form that floats reads unfinished. Ground it.
