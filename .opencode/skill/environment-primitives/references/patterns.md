# Environment Primitives — Patterns & Blueprint Examples

Concrete voxel unit builders and deterministic scatter patterns for each environment category, adapted to Promptville's `Voxel[]` + `InstancedVoxels` system. Unit builders live in `app/src/voxel.ts` (pure — no randomness, no world coords, colours from constants). Scatters happen at the call site with `mulberry32`.

All examples assume:

```ts
import type { Voxel } from "./voxel";
import { mulberry32 } from "./rand";
// and the colour constants from ./voxel (BUSH_COLOR, TRUNK_COLOR, LAMP_GLOW, FLOWER_COLORS...) or ./theme
```

## Colour helpers — use `tintHex`, never `shade()`

Voxel colours must be `#rrggbb` **hex** strings. `shade()` in `app/src/texturePatterns.ts` returns an `rgb(r,g,b)` string instead, which renders fine but **breaks every hex colour-equality assertion** in `app/src/voxel.test.ts` (e.g. `v.color === WINDOW_COLOR`). Use this hex-returning helper for per-instance lightness variation:

```ts
// Lighten (f>0) or darken (f<0) a #rrggbb colour, always returning #rrggbb.
// Why this exists: shade() in ./texturePatterns returns rgb(...), which breaks
// the hex colour-equality assertions in voxel.test.ts. tintHex keeps voxel
// colours as hex so equality tests keep passing.
export function tintHex(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = f >= 0 ? 255 : 0;
  const a = Math.min(1, Math.abs(f));
  const c = (v: number) => Math.round(v + (mix - v) * a);
  const hex2 = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  return `#${hex2(c(r))}${hex2(c(g))}${hex2(c(b))}`;
}
```

Variation rule: shift **lightness** (f), never hue — a hue shift reads as rot/stain; a lightness shift reads as wear (see the `FlagstoneFloor` lesson).

## The two ground paths (recap)

- **Flat + walkable** → `textures.ts` `makeTileableTexture` + `<planeGeometry>` in `Ground.tsx`. Never voxels.
- **Raised / protruding / silhouetted** → a `Voxel[]` blueprint + `<InstancedVoxels>`. Any height, any footprint that catches a shadow.

Decision test: *does it stick up off the ground, or is it a flat plane you could roll a lawnmower over?* Flat → texture. Sticks up → voxel.

## Unit builder + scatter skeleton

```ts
// 1) PURE unit — no rand, no world coords, colours by param.
export function tuftVoxels(color: string = BUSH_COLOR): Voxel[] {
  // three vertical cells, top two jittered by param? No — pure means deterministic by arg.
  const v: Voxel[] = [];
  v.push({ x: 0, y: 0, z: 0, color });
  v.push({ x: 0, y: 1, z: 0, color });
  v.push({ x: 0, y: 2, z: 0, color });
  return v;
}

// 2) SCATTER at the call site — deterministic, adds world offsets.
export function grassPatchVoxels(width: number, depth: number, seed: number, color: string = BUSH_COLOR): Voxel[] {
  const rand = mulberry32(seed);
  const COUNT = Math.floor((width * depth) * 0.3); // density factor
  const voxels: Voxel[] = [];
  for (let i = 0; i < COUNT; i++) {
    const bx = (rand() - 0.5) * width;
    const bz = (rand() - 0.5) * depth;
    const jitter = (rand() - 0.5) * 0.35;
    const h = Math.floor(rand() * 3); // 0..2 cells tall variety
    for (const v of tuftVoxels(color)) {
      voxels.push({ x: v.x + bx + jitter, y: v.y + h, z: v.z + bz, color: v.color });
    }
  }
  return voxels;
}
```

Remember: the unit builder is testable in isolation; the scatter is what introduces world variety. Keep randomness out of the unit.

## Floor

### Flagstone path (grout-gap slabs, lightness tint)

```ts
// one 2×2, 1-tall slab
export function flagstoneVoxels(color: string): Voxel[] {
  const v: Voxel[] = [];
  for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) v.push({ x, y: 0, z, color });
  return v;
}

export function flagstonePathVoxels(
  columns: number,
  rows: number,
  color: string,
  seed: number,
): Voxel[] {
  const rand = mulberry32(seed);
  const GAP = 1;                 // grout gap between slabs — the depth cue
  const voxels: Voxel[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const bx = c * (2 + GAP);
      const bz = r * (2 + GAP);
      const lightness = 0.86 + rand() * 0.12;      // LIGHTNESS only — not hue
      const slabColor = tintHex(color, lightness);
      for (const v of flagstoneVoxels(slabColor)) {
        voxels.push({ x: v.x + bx, y: v.y, z: v.z + bz, color: v.color });
      }
    }
  }
  return voxels;
}
```

The grout gap is the important part — it gives converging perspective lines for depth for free. `tintHex` (defined above) keeps the per-slab tint as hex so colour-equality tests keep passing.

### Plank decking (staggered butt joints)

Rows of boards along one axis; offsets — whether a butt joint in one row lines up with a neighbouring row — is the whole rule. Stagger so joints never align:

```ts
export function deckVoxels(length: number, rows: number, color: string, seed: number): Voxel[] {
  const rand = mulberry32(seed);
  const voxels: Voxel[] = [];
  for (let r = 0; r < rows; r++) {
    const rowColor = tintHex(color, 0.9 + rand() * 0.12);
    let x = 0;
    while (x < length) {
      const plankLen = 1 + Math.floor(rand() * 3);   // 1..3 per plank
      const end = Math.min(x + plankLen, length);
      for (let px = x; px < end; px++) voxels.push({ x: px, y: 0, z: r, color: rowColor });
      x = end;
      if (length - x < 1) break;                    // no runt at the end of a run
    }
  }
  return voxels;
}
```

### Cobble set (irregular, bumpy height)

```ts
export function cobbleVoxels(width: number, depth: number, color: string, seed: number): Voxel[] {
  const rand = mulberry32(seed);
  const voxels: Voxel[] = [];
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      const h = rand() < 0.2 ? 1 : 0;             // some bumps one cell high
      voxels.push({ x, y: 0, z, color: tintHex(color, 0.85 + rand() * 0.2) });
      if (h) voxels.push({ x, y: 1, z, color: tintHex(color, 0.8) });
    }
  }
  return voxels;
}
```

## Flora

### Grass tuft — see the skeleton above. Height-jitter is the natural look.

### Flowers — extend the existing `flowersVoxels`:

```ts
// ground blot + upright blooms; per-instance flower colour from FLOWER_COLORS
export function flowerVoxels(colors: string[] = FLOWER_COLORS, ground: string = FLOWER_GROUND): Voxel[] {
  const v: Voxel[] = [];
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) v.push({ x, y: 0, z, color: ground });
  v.push({ x: -1, y: 1, z: -1, color: colors[0] });
  v.push({ x: 1, y: 1, z: -1, color: colors[1] });
  v.push({ x: 0, y: 1, z: 1, color: colors[2] });
  v.push({ x: 0, y: 1, z: 0, color: colors[3] });
  return v;
}
```

## Foliage

### Hedge block (clipped top)

```ts
export function hedgeVoxels(length: number, color: string): Voxel[] {
  const v: Voxel[] = [];
  for (let x = 0; x < length; x++) {
    v.push({ x, y: 0, z: 0, color });
    v.push({ x, y: 1, z: 0, color });
  }
  // clipped top: overhang by one cell on each end
  v.push({ x: -1, y: 2, z: 0, color });
  v.push({ x: length, y: 2, z: 0, color });
  for (let x = 0; x < length; x++) v.push({ x, y: 2, z: 0, color });
  return v;
}
```

### Leaf cluster (the canopy/blob unit)

Reuse the tree-canopy profile as a standalone blob for hedges/florets. Round it by trimming corners:

```ts
export function leafClusterVoxels(color: string): Voxel[] {
  const v: Voxel[] = [];
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      for (let y = 0; y < 2; y++)
        // trim the four top corners → rounder
        if (!(y === 1 && Math.abs(x) === 1 && Math.abs(z) === 1))
          v.push({ x, y, z, color });
  return v;
}
```

## Rocks

### Boulder + mossy variant + seeded ring with clearance

```ts
export function boulderVoxels(color: string): Voxel[] {
  const v: Voxel[] = [];
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++) {
      v.push({ x, y: 0, z, color });
      // corner trim → not a perfect box
      if (!(Math.abs(x) === 1 && Math.abs(z) === 1)) v.push({ x, y: 1, z, color });
    }
  v.push({ x: 0, y: 2, z: 0, color });
  return v;
}

export function mossyBoulderVoxels(color: string, moss: string = BUSH_COLOR): Voxel[] {
  const v = boulderVoxels(color);
  for (const b of v) if (b.y === 2) v.push({ x: b.x, y: 3, z: b.z, color: moss });
  return v;
}

// Ring scatter with a minimum spacing so rocks never pile into a wall.
export function rockRingVoxels(cx: number, cz: number, radius: number, color: string, seed: number): Voxel[] {
  const rand = mulberry32(seed);
  const voxels: Voxel[] = [];
  const count = Math.floor(radius * 3);
  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const a = i * step + rand() * 0.3;             // wobble the ring
    const r = radius * (0.85 + rand() * 0.3);
    const bx = cx + Math.cos(a) * r;
    const bz = cz + Math.sin(a) * r;
    const s = 0.6 + rand() * 0.7;                  // scale 0.6..1.3
    for (const v of boulderVoxels(tintHex(color, 0.85 + rand() * 0.2))) {
      voxels.push({ x: v.x * s + bx, y: v.y * s, z: v.z * s + bz, color: v.color });
    }
  }
  return voxels;
}
```

## Trees

One builder, a `shape` option for the canopy. `TRUNK_COLOR` for the trunk; canopy from the green family.

```ts
export type TreeShape = "round" | "pine" | "oak" | "palm";

export function envTreeVoxels(shape: TreeShape, foliage: string, trunk: string = TRUNK_COLOR): Voxel[] {
  const v: Voxel[] = [];
  const push = (x: number, y: number, z: number, c: string) => v.push({ x, y, z, color: c });

  const canopy = (r: number, y: number, t: string) => {
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++)
        if (r === 1 && !(Math.abs(x) === 1 && Math.abs(z) === 1)) push(x, y, z, t);
        else if (r !== 1) push(x, y, z, t);
  };

  switch (shape) {
    case "pine": {
      // tall narrow trunk, tapering cone canopy
      for (let y = 0; y < 4; y++) push(0, y, 0, trunk);
      canopy(1, 4, foliage);
      canopy(1, 5, foliage);
      canopy(0, 6, foliage);
      break;
    }
    case "oak": {
      // short chunky trunk, wide squat canopy
      for (let y = 0; y < 2; y++) push(0, y, 0, trunk);
      canopy(2, 2, foliage);
      canopy(1, 3, foliage);
      break;
    }
    case "palm": {
      // tall trunk, small irregular top cluster
      for (let y = 0; y < 5; y++) push(0, y, 0, trunk);
      push(0, 5, 0, foliage); push(1, 5, 0, foliage);
      push(-1, 5, 1, foliage); push(0, 5, -1, foliage);
      break;
    }
    case "round":
    default: {
      // existing treeVoxels-style stepped blob
      for (let y = 0; y < 2; y++) push(0, y, 0, trunk);
      canopy(1, 2, foliage);
      canopy(1, 3, foliage);
      push(0, 4, 0, foliage);
      break;
    }
  }
  return v;
}
```

Variants differ only by **canopy profile** — height of trunk, how the foliage mass tapers. Tint the field by lightness, never hue.

## Masonry

### Brick coursing (running bond) — see SKILL.md for the half-offset loop.

```ts
export function brickWallVoxels(width: number, rows: number, brick: string, mortar: string): Voxel[] {
  const v: Voxel[] = [];
  const push = (x: number, y: number, z: number, c: string) => v.push({ x, y, z, color: c });
  for (let y = 0; y < rows; y++) {
    const offset = y % 2 === 0 ? 0 : 1;
    for (let x = 0; x < width; x++) push(x, y, 0, (x + offset) % 2 === 0 ? brick : mortar);
  }
  return v;
}
```

### Curb / planter wall (hollow run, overhanging cap)

```ts
export function planterWallVoxels(length: number, height: number, body: string, cap: string): Voxel[] {
  const v: Voxel[] = [];
  for (let x = 0; x < length; x++)
    for (let y = 0; y < height; y++) {
      v.push({ x, y, z: 0, color: body });
      v.push({ x, y, z: 1, color: body });
    }
  // cap overhangs by one cell on the outer edge
  for (let x = 0; x < length; x++) {
    v.push({ x, y: height, z: 0, color: cap });
    v.push({ x, y: height, z: -1, color: cap });
  }
  return v;
}
```

### Arched opening (stepped taper, not an extrude)

Approximate an arch with a stepped taper so the opening's top curves. Don't reproduce `ArchGeometry`:

```ts
export function archWallVoxels(height: number, span: number, body: string): Voxel[] {
  const v: Voxel[] = [];
  for (let y = 0; y < height; y++) {
    // widen as the opening rises toward a peak
    const innerX = Math.max(1, Math.floor(span / 2) - Math.floor((y * (span / 2)) / height));
    for (let x = -innerX; x <= innerX; x++) v.push({ x, y, z: 0, color: body });
  }
  return v;
}
```

## Lighting

### Street lamp (existing `lampVoxels`) — place in a seeded run along a curb.

```ts
export function lampRunVoxels(count: number, spacing: number, seed: number): Voxel[] {
  const rand = mulberry32(seed);
  const v: Voxel[] = [];
  for (let i = 0; i < count; i++) {
    const bx = i * spacing + (rand() - 0.5) * 0.3;
    for (const l of lampVoxels(POLE_COLOR, GLOW_COLOR)) {
      v.push({ x: l.x + bx, y: l.y, z: l.z, color: l.color });
    }
  }
  return v;
}
```

### Lantern / bollard

```ts
export function bollardVoxels(post: string = POLE_COLOR, glow: string = LAMP_GLOW): Voxel[] {
  const v: Voxel[] = [];
  v.push({ x: 0, y: 0, z: 0, color: post });
  v.push({ x: 0, y: 1, z: 0, color: glow });   // lit cap; toggleable at night
  return v;
}
```

Glow props toggle brightness with the existing day/night system (`night.ts`, `LitWindows.tsx`) — reuse `LAMP_GLOW`/`GLOW_COLOR`; don't author a new emissive material. For short "lit at night" markers, cross-reference the `LitWindows` emissive approach but keep the voxel geometry as the unit.
