---
name: atmospheric-effects
description: Use when adding or tuning atmospheric particle effects to the Promptville scene — rain, dust motes, drifting petals, will-o-the-wisps, ground fog, glow halos, emissive pulsing, or lightning flashes; when asked to "make it rain/snow/foggy" or add ambient particle motion; when working with app/src/components/three/ scene objects, useFrame, Points/PointsMaterial, InstancedMesh, or adding a new effect component. Covers the R3F pattern for update(dt)-driven instanced/merged particle effects, not mesh voxelization, object hover/bob, or shader authoring beyond a basic material.
---

# Atmospheric Effects

## Overview

An atmospheric effect in Promptville is a **continuous, `update(dt)`-driven particle system** rendered as few draw calls (one `InstancedMesh` or `Points` per effect). It is driven from `useFrame` and never owns React state. This is the R3F form of the `RainEffect` / `DustMotesEffect` / `GroundFogEffect` particle classes in the `three-low-poly` library — but written the Promptville way.

The core is a single principle: **the effect is a plain three.js object with an `update(dt)` method; React renders it once and drives it every frame.** Everything else is material and instancing choice.

## The R3F Pattern (always this)

Adapting a plain-three effect (like `three-low-poly`'s `RainEffect`) to R3F is three steps:

1. **Build the object once** in `useMemo` — `InstancedMesh`, `InstancedBufferGeometry`, or `Points` with its geometry/material, plus a private `update(dt)` closure that mutates it.
2. **Attach it** declaratively (`<primitive object={effect} />`), or build it as a JSX subtree and grab the mesh via `useRef`.
3. **Drive it** from `useFrame((_, delta) => effect.update(delta))`.

```tsx
function RainEffect({ area = 12, height = 16, count = 1400 }: Props) {
  const effect = useMemo(() => buildRain({ area, height, count }), [area, height, count]);

  useFrame((_, delta) => effect.update(delta));

  return <primitive object={effect.object} />;
}
```

`buildRain` returns `{ object, update }`. The object is created once; `update` mutates its position matrices in place. `useFrame`'s second argument (`delta`) is passed straight through — **never use `clock` accumulation or `setState`**.

### Rules (from the repo conventions)

- **Effects live in `app/src/components/three/`** as one `.tsx` component per effect, alongside `Sky`, `Traffic`, `Ground`, etc.
- **Never `setState` inside `useFrame`.** Mutate refs / instance matrices / material props directly. (See `docs/r3f-reference.md` and `InstancedVoxels.tsx`.)
- **Only use `delta`** (frame time), not accumulated `clock` time — so speed is refresh-rate independent.
- **Share geometries/materials via module-level constants** (like `InstancedVoxels`'s shared `BoxGeometry` and `House.tsx`'s shared materials) — create once, reuse across instances.
- **`frameloop="always"` stays.** Effects are perpetual animation; never switch the Canvas to `demand`.
- **No `any`.** Type the props and the built object.
- **Never mutate the opencode DB.** Effects are pure client-side.

## Determinism

The city is deterministic (see `app/src/rand.ts`). Effects should be too. Seed every particle's initial placement with `mulberry32`:

```ts
import { mulberry32 } from "../../rand";

const rand = mulberry32(seed);
const x = (rand() - 0.5) * area;
```

Never use `Math.random()` — it breaks the reproducible scene and the memory of a place.

## Wrapping a volume (toroidal wrap)

Particles leave and reset. To keep a fixed count simulating an infinite field, **wrap each particle around a volume** — when it falls past the floor, respawn it at the top; when it drifts past an edge, wrap it to the opposite edge. This is why a bounded count reads as a dense, endless effect.

```ts
function update(dt: number): void {
  const arr = positions.array as Float32Array;
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    arr[j + 1] -= speedY * dt;              // fall
    arr[j] += driftX * dt;                  // wind
    if (arr[j + 1] < 0) { arr[j + 1] += height; }   // wrap vertically
    if (arr[j] > area / 2) arr[j] -= area;          // wrap horizontally
    else if (arr[j] < -area / 2) arr[j] += area;
  }
  attr.needsUpdate = true;
}
```

## Materials / glow recipes

The atmospheric look is 90% material choice. Match the recipe to the effect:

| Effect | Geometry | Material | Recipe |
|--------|----------|----------|--------|
| Rain | vertical streak (instanced thin box / `LineSegments`) | `meshBasicMaterial` | `transparent`, low `opacity` (~0.3), `depthWrite:false`, `toneMapped:false` |
| Dust motes | `Points` small size | `pointsMaterial` | `transparent`, `opacity`, `sizeAttenuation`, faint color |
| Petal drift | `PlaneGeometry` (instanced) | `meshBasicMaterial` | `DoubleSide`, flutter via per-instance `rotation` |
| Wisp | `Points` (billboard) | `pointsMaterial` | `additive`, `blending: AdditiveBlending`, `depthWrite:false` |
| Ground fog | `PlaneGeometry` (instanced) | `meshBasicMaterial`/`meshStandardMaterial` | `transparent`, low opacity, `depthWrite:false`, large soft quads |
| Glow halo | `PlaneGeometry`/`Sprite` | `meshBasicMaterial` | `additive`, `toneMapped:false`, always faces camera (billboard) |
| Emissive pulse | none (drives a light/material) | — | sine on `emissiveIntensity` / light intensity |
| Lightning | `DirectionalLight`/emissive | — | decay a spike toward 0 |

### The glow rule

- **Additive glow** (`AdditiveBlending`, `toneMapped:false`, `depthWrite:false`) = cheap fake light with no light budget — use thousands of them freely.
- **`color` tint via `setColorAt`** (instanced) or a `Color` uniform — keep the cartoon palette from `app/src/theme.ts`.
- **Billboard** any glow card so it always faces the camera: simplest is `Sprite` + `SpriteMaterial`; otherwise copy the camera's quaternion each frame in `update`.

## Per-effect recipes

Each is its own `app/src/components/three/` component. Parameters are opinions, not mandates — expose them as props with sensible defaults (matching `three-low-poly`'s ranges).

### Rain
Vertical streaks, intensity-scaled density/speed/opacity, optional wind drift.
- Build: `InstancedMesh` of a thin `BoxGeometry` (`0.009 × 1 × 0.009`) or a `LineSegments` cloud; `meshBasicMaterial` transparent.
- `update`: fall at a per-instance speed, wind-drift on x/z, toroidal wrap.
- Props: `area` (12), `height` (16), `count` (1400), `opacity` (0.3), `windDirection`, `windStrength`, `intensity`.

### Dust motes
Fine additive specks wafting through a lit volume; each twinkles.
- Build: `Points`; `pointsMaterial` faint, `transparent`, small `size`.
- `update`: settle downward + waft laterally; twinkle = per-particle sin on a scale or material `opacity`/size.
- Props: `count` (150), `width/height/depth` (9), `color` (airy blue), `settleMin/MAX`, `waft`.

### Petal drift
Soft petals drifting down with gentle flutter (not stiff tumble).
- Build: instanced flat `PlaneGeometry`, `DoubleSide`, per-instance color range (pink/pale).
- `update`: fall + lateral drift + a slow per-particle rotation to fake flutter.
- Props: `count` (100), `width/height/depth` (14), `fallSpeedMin/MAX`, `driftMin/MAX`, `flutter`.

### Wisp
Will-o'-the-wisps bobbing through a volume — motion and pulse. Optional real `PointLight`s for hero scenes.
- Build: `Points` additive, plus optional one `PointLight` per wisp (low count — light budget).
- `update`: bob on a sin path, pulse `emissiveIntensity`/light intensity, drift.
- Props: `count` (3), `castLight`, `color`, `driftX/driftY`.

### Ground fog
Drifting mist near the floor; interior scatter cards plus optional perimeter cards that soften terrain edges.
- Build: instanced large soft `PlaneGeometry` quads, `transparent`, `depthWrite:false`; lay near y≈0.
- `update`: slow x/z drift with a gentle y bob, looping across `area`.
- Props: `count`, `area`, `perimeterCount`, `cameraFacing`.

### Glow halo
Additive billboard glare around a bright object — fake light, no `PointLight`. Hundreds cost nothing.
- Build: `Sprite` (or camera-facing quad) with `SpriteMaterial` / `meshBasicMaterial`, `AdditiveBlending`, `toneMapped:false`.
- `update`: only if pulsing; otherwise static. Keep size modest vs. the fixture to avoid slicing artifacts.
- Props: `color`, `size`, `opacity`.

### Emissive pulse
An LED-like pulse overlaying an existing emissive material — no geometry of its own.
- Build: nothing; hold a reference to a material or light.
- `update`: `mat.emissiveIntensity = min + (max-min) * (0.5 + 0.5*sin(t*speed))`, driven by `delta`.
- Props: `material`, `speed`, `maxIntensity`, `minIntensity`.

### Lightning
Thunderstorm flash via decaying light spikes — no timers; the flash level decays on its own.
- Build: a `DirectionalLight` (or emissive material) held by the effect.
- `update`: hold a `level`; on a random (seeded) interval spike it to a peak, then decay `level *= exp(-dt*k)`; drive light intensity + fog/sky brightening from `level`.
- Props: `light`, `peak`, `minGap`, `maxGap`, plus a readout `level`.

## Workflow

1. **Pick the recipe** above; check the device/count budget (instanced keeps draw calls low).
2. **Extract the builder** (`buildRain`-style) as a pure function in `app/src/voxel-adjacent` or within the component file; seed with `mulberry32`, never `Math.random`.
3. **Write the component** in `app/src/components/three/<Effect>.tsx`: `useMemo` the object, attach it, `useFrame((_, delta) => effect.update(delta))`. Never `setState` in the loop.
4. **Add it to the scene** — mount it inside `<Scene>` / the relevant `Canvas` tree, or a `<group>`.
5. **Verify** — `bun run dev`; confirm it animates continuously, doesn't jank (draw calls stay low), reads correctly at town scale, and matches the palette in `app/src/theme.ts`.

## Common Mistakes

- **`setState` inside `useFrame`** — re-renders every frame and tanks FPS. Mutate refs / attributes directly.
- **`Math.random()`** — breaks determinism. Seed with `mulberry32`.
- **Using `clock.elapsedTime` instead of `delta`** — speed changes with refresh rate. Use the `delta` arg.
- **`AdditiveBlending` without `depthWrite:false` / `toneMapped:false`** — glow washes out or hilts. Follow the recipes table.
- **One `PointLight` per wisp at high count** — the light budget dies. Use additive glow for scale; reserve real lights for hero count.
- **Forgetting to wrap the volume** — particles fall out and the effect thins. Toroidal-wrap so a fixed count fills the field.
- **Building a fresh geometry/material every render** — recreate the effect object in `useMemo`, share module-level geometry/material constants.
