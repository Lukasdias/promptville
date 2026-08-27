# Voxel Form Primitives

Reusable shape primitives for building `Voxel[]` blueprints. Canonical source: `app/src/voxel.ts` (`houseVoxels`, `treeVoxels`, `carVoxels`, etc.). A `Voxel` is `{ x: number; y: number; z: number; color: string }` with integer cell indices.

## Table of Contents

- [Conventions](#conventions)
- [Primitives](#primitives)
  - [Box fill](#box-fill)
  - [Hollow walls (perimeter)](#hollow-walls-perimeter)
  - [Slab roof](#slab-roof)
  - [Stepped pyramid roof](#stepped-pyramid-roof)
  - [Decoration cells](#decoration-cells)
  - [Signs / marks](#signs--marks)
- [Canonical example: houseVoxels](#canonical-example-housevoxels)
- [Translation + rendering](#translation--rendering)

## Conventions

- Integer cells; `y=0` is ground; height = `walls` (+ roof).
- Footprint `W×D` odd (5/7/9); half-extents `hw = floor(W/2)`, `hd = floor(D/2)`.
- Front face `+z`: door at `(0, 0, hd)`, windows mirrored at `±x`.
- Colors come from `app/src/theme.ts` + constants in `app/src/voxel.ts`. No raw hex in blueprints.

## Primitives

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

### Decoration cells

Overwrite specific wall cells. Doors centered on the front face; windows mirrored; side windows climb in columns for tall buildings.

```ts
// door (walls >= 2): push(0, 0, hd, door); push(0, 1, hd, door);
// front windows (walls >= 4): push(-2, 2, hd, window); push(2, 2, hd, window);
// side windows: for (y = 2; y < walls - 1; y += 2) { push(hw, y, ±1, window); push(-hw, y, ±1, window); }
```

### Signs / marks

A distinguishing mark makes each form legible at distance — colored cells above the roof line or on the facade.

```ts
// roof sign: push(-1, walls+1, 0, SIGN_COLOR); push(0, walls+1, 0, SIGN_COLOR); push(1, walls+1, 0, SIGN_COLOR);
// facade cross: push(0, h+1, hd, red); push(-1, h, hd, red); push(1, h, hd, red); push(0, h, hd, red);
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