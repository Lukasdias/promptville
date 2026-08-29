# Voxel Form Primitives

Reusable shape primitives for building `Voxel[]` blueprints. Canonical source: `app/src/voxel.ts` (`houseVoxels`, `treeVoxels`, `carVoxels`, etc.). A `Voxel` is `{ x: number; y: number; z: number; color: string }` with integer cell indices.

The primitives split into two layers:

- **Geometry primitives** — the raw shapes (box fill, hollow walls, slab, stepped pyramid).
- **Identity levers** — what turns a blank box into a designed, cartoon form (massing, eave, inset, awning, plinth, dome, corner rounding, hero sign).

Use the geometry to get the mass, then the identity levers to break the rectangle. See `SKILL.md` for the cartoon design language and character checklist that governs composition.

## Table of Contents

- [Conventions](#conventions)
- [Geometry primitives](#geometry-primitives)
  - [Box fill](#box-fill)
  - [Hollow walls (perimeter)](#hollow-walls-perimeter)
  - [Slab roof](#slab-roof)
  - [Stepped pyramid roof](#stepped-pyramid-roof)
  - [Columns](#columns)
- [Identity levers (anti-brutalist)](#identity-levers-anti-brutalist)
  - [Massing / step-back tower](#massing--step-back-tower)
  - [Overhang eave](#overhang-eave)
  - [Inset window / door](#inset-window--door)
  - [Awning row](#awning-row)
  - [Plinth / base](#plinth--base)
  - [Stepped dome / crown](#stepped-dome--crown)
  - [Corner rounding](#corner-rounding)
  - [Hero sign](#hero-sign)
- [Canonical example: houseVoxels](#canonical-example-housevoxels)
- [Canonical example: civic building with identity](#canonical-example-civic-building-with-identity)
- [Translation + rendering](#translation--rendering)

## Conventions

- Integer cells; `y=0` is ground; height = `walls` (+ roof).
- Footprint `W×D` odd (5/7/9); half-extents `hw = floor(W/2)`, `hd = floor(D/2)`.
- Front face `+z`: door at `(0, 0, hd)`, windows mirrored at `±x`.
- Colors come from `app/src/theme.ts` + constants in `app/src/voxel.ts`. No raw hex in blueprints.
- Blueprints are pure — no randomness inside; pass options in.

## Geometry primitives

### Box fill

Solid rectangular volume. Used for roofs, slabs, trunks, chunks.

```ts
for (let x = -hw; x <= hw; x++)
  for (let z = -hd; z <= hd; z++)
    for (let y = 0; y < h; y++) push(x, y, z, color);
```

### Hollow walls (perimeter)

Shell of a box — walls only, no fill. The base of every building.

```ts
for (let x = -hw; x <= hw; x++)
  for (let z = -hd; z <= hd; z++)
    if (Math.abs(x) === hw || Math.abs(z) === hd)
      for (let y = 0; y < walls; y++) push(x, y, z, body);
```

### Slab roof

Flat cap for skyscrapers/shops. Optional chimney/antenna above.

```ts
for (let x = -hw; x <= hw; x++)
  for (let z = -hd; z <= hd; z++) push(x, walls, z, roof);
// antenna: push(0, walls+1, 0, ANTENNA_COLOR); push(0, walls+2, 0, ANTENNA_TIP_COLOR);
```

### Stepped pyramid roof

Pitched roof; each layer shrinks by one ring until a point. Solid, so no underside.

```ts
for (let layer = 0; layer <= hw; layer++) {
  const r = hw - layer;
  const y = walls + layer;
  for (let x = -r; x <= r; x++)
    for (let z = -r; z <= r; z++) push(x, y, z, roof);
}
// chimney: push(2, walls + hw + 1, 0, CHIMNEY_COLOR);
```

### Columns

A solid vertical post (not a full wall) — the base of a tower, chimney, or lamp.

```ts
// a 1×1 column rising `h` cells from y=0:
for (let y = 0; y < h; y++) push(cx, y, cz, color);
```

## Identity levers (anti-brutalist)

These break the plain box. Pick and exaggerate — don't apply all of them to one form.

### Massing / step-back tower

Stack a smaller footprint on top of a wider base. This is the single most effective silhouette breaker — a tower on a podium.

```ts
// podium (wider base) z-height 0..podiumH
for (let x = -hw; x <= hw; x++)
  for (let z = -hd; z <= hd; z++)
    for (let y = 0; y < podiumH; y++) push(x, y, z, body);

// tower on top, inset by one ring each side
const tw = hw - 1, td = hd - 1;
for (let x = -tw; x <= tw; x++)
  for (let z = -td; z <= td; z++)
    for (let y = podiumH; y < walls; y++)
      if (Math.abs(x) === tw || Math.abs(z) === td) push(x, y, z, body);
```

### Overhang eave

A roof layer that extends one cell beyond the wall on all sides (proud). Adds a chunky, cartoon eave and a shadow line.

```ts
// at y = walls, one ring larger than the footprint
for (let x = -hw - 1; x <= hw + 1; x++)
  for (let z = -hd - 1; z <= hd + 1; z++) push(x, walls, z, roof);
// optional second layer of the eave, tucked in one ring:
for (let x = -hw; x <= hw; x++)
  for (let z = -hd; z <= hd; z++) push(x, walls + 1, z, roof);
```

### Inset window / door

Recess a window or door one cell into the wall (sink) instead of flat on the surface. Gives depth and a real shadowed reveal. Just place the cell one `z` step back from the facade.

```ts
// door recessed on the front face: place it at hd - 1 instead of hd
if (o.walls >= 2) { push(0, 0, hd - 1, door); push(0, 1, hd - 1, door); }
// window inset: push(±2, 2, hd - 1, window) instead of hd
```

### Awning row

A proud strip above the front door or windows, overhanging one cell. The mall's signature — colored and repeated across the front.

```ts
// a colored awning hanging over the front face (z = hd), one cell proud
for (let x = -hw; x <= hw; x++) push(x, 1, hd, AWNING_COLORS[(x + hw + 4) % AWNING_COLORS.length]);
```

### Plinth / base

A 1-2 cell darker or body-coloured ring at the bottom of the walls, so the building sits on the ground rather than floating. Add a single proud cell as a door step.

```ts
// plinth ring at y = 0 (and optionally y = 1)
for (let x = -hw; x <= hw; x++)
  for (let z = -hd; z <= hd; z++)
    if (Math.abs(x) === hw || Math.abs(z) === hd)
      push(x, 0, z, plinthColor);
// door step, one cell proud of the facade:
push(0, 0, hd + 1, plinthColor);
```

### Stepped dome / crown

A rounded crown — shrink a square/ring layer by layer (like the pyramid) but scale down faster toward a smaller cap, and ring it with the accent colour. Reads as a dome rather than a pile.

```ts
// dome over a 5 (hw=2) footprint: shrink radii 2,2,1,1,0 with a rounded profile
for (const [r, y] of [[2, 0], [2, 1], [1, 2], [1, 3], [0, 4]] as const) {
  for (let x = -r; x <= r; x++)
    for (let z = -r; z <= r; z++) push(x, walls + y, z, y === 4 ? hero : roof);
}
```

### Corner rounding

Remove the footprint's corner cells to soften the box. Combine with a plinth flare for a "designed" corner.

```ts
// in the hollow-walls loop, skip the four corners:
if (Math.abs(x) === hw && Math.abs(z) === hd) continue;
```

### Hero sign

A dominant, multi-cell mark (3-5 cells) that names the building, placed above the roof line or on the facade front. This is the building's voice — make it big.

```ts
// a 5-cell hero sign centered on the front, above the roof:
for (let x = -2; x <= 2; x++) push(x, walls + 1, 0, heroColor);
// hospital cross (hero, tall):
push(0, walls + 1, 0, hero); push(-1, walls + 1, 0, hero); push(1, walls + 1, 0, hero);
push(0, walls + 2, 0, hero);
```

## Canonical example: houseVoxels

```ts
export function houseVoxels(o: HouseVoxelOptions): Voxel[] {
  const W = o.width ?? 7, D = o.depth ?? 7;
  const hw = Math.floor(W / 2), hd = Math.floor(D / 2);
  const voxels: Voxel[] = [];
  const push = (x: number, y: number, z: number, color: string) => voxels.push({ x, y, z, color });

  for (let x = -hw; x <= hw; x++)
    for (let z = -hd; z <= hd; z++)
      if (Math.abs(x) === hw || Math.abs(z) === hd)
        for (let y = 0; y < o.walls; y++) push(x, y, z, o.body);

  if (o.walls >= 2) { push(0, 0, hd, o.door ?? DOOR_COLOR); push(0, 1, hd, o.door ?? DOOR_COLOR); }
  if (o.windows !== false && o.walls >= 4) { push(-2, 2, hd, WINDOW_COLOR); push(2, 2, hd, WINDOW_COLOR); }
  if (o.sideWindows) for (let y = 2; y < o.walls - 1; y += 2) {
    push(hw, y, -1, WINDOW_COLOR); push(hw, y, 1, WINDOW_COLOR);
    push(-hw, y, -1, WINDOW_COLOR); push(-hw, y, 1, WINDOW_COLOR);
  }

  if (o.pitched) {
    for (let layer = 0; layer <= hw; layer++) {
      const r = hw - layer, y = o.walls + layer;
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) push(x, y, z, o.roof);
    }
    if (o.chimney) push(2, o.walls + hw + 1, 0, CHIMNEY_COLOR);
  } else {
    for (let x = -hw; x <= hw; x++) for (let z = -hd; z <= hd; z++) push(x, o.walls, z, o.roof);
    if (o.chimney) push(2, o.walls + 1, 0, CHIMNEY_COLOR);
    if (o.antenna) { push(0, o.walls + 1, 0, ANTENNA_COLOR); push(0, o.walls + 2, 0, ANTENNA_TIP_COLOR); }
  }

  return voxels;
}
```

`houseVoxels` is the base box. To give it identity, layer the levers on top: an **overhang eave** at the roof line, a **plinth** at y=0, an **inset** door, and **corner rounding** — see the next example.

## Canonical example: civic building with identity

The `publicBuildingVoxels` function in `app/src/voxel.ts` already gives each kind a mark (cross, siren, garage, awning, bread). That is the right idea — the building needs identity. To break the box itself, extend the pattern: vary the massing (tower or step-back), add an overhang eave, ground it with a plinth, and let the **hero mark** be 3-5 cells.

```ts
// silhouette: 5×5 base (hw=2) with a step-back tower on top (hw=1), flat cap + hero sign.
export function landmarkVoxels(hero: string, accent: string, roof: string): Voxel[] {
  const voxels: Voxel[] = [];
  const push = (x: number, y: number, z: number, color: string) => voxels.push({ x, y, z, color });

  const baseH = 4; // podium walls
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++)
      if (Math.abs(x) === 2 || Math.abs(z) === 2)
        for (let y = 0; y < baseH; y++) push(x, y, z, accent);

  // overhang eave at the podium top
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) push(x, baseH, z, accent);

  // step-back tower (1×1 ring), hollow
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      if (Math.abs(x) === 1 || Math.abs(z) === 1)
        for (let y = baseH + 1; y < baseH + 4; y++) push(x, y, z, accent);

  // flat cap
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) push(x, baseH + 4, z, roof);

  // hero mark, 5 cells, proud and centered, facing +z
  for (let x = -2; x <= 2; x++) push(x, baseH + 5, 0, hero);

  return voxels;
}
```

This is far more distinctive than a plain box: the podium + step-back give a silhouette, the eave and cap give a crown, and the 5-cell hero sign names it at distance. That is the level of identity a civic building should carry.

## Translation + rendering

Unit forms never carry world coordinates. Translate and render at the call site:

```ts
// placeVoxels: bx/bz are world coords; size = voxel cell size. One cell ≈ one rendered cube.
export function placeVoxels(pattern: Voxel[], bx: number, bz: number, size: number): Voxel[] {
  return pattern.map((v) => ({
    x: bx / size - 0.5 + v.x,
    y: v.y,
    z: bz / size - 0.5 + v.z,
    color: v.color,
  }));
}

// render: one InstancedMesh per object
<InstancedVoxels voxels={voxels} voxelSize={0.4} />
```

`InstancedVoxels` (`app/src/components/three/InstancedVoxels.tsx`) shares a unit `BoxGeometry` and one `meshStandardMaterial flatShading`; per-instance color comes from `setColorAt`. Keep voxel counts modest (a few hundred per object is fine) — instancing, not meshing, is the efficiency strategy here.
