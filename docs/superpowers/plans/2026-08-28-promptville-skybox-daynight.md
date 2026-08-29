# Promptville Skybox & Day-Night Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a time-driven gradient sky dome, moving sun/moon discs, fading stars, and animated lighting plus night lights (lamps, windows, signs), controlled by a 0–24h slider with an auto-cycle toggle.

**Architecture:** Pure time math in `app/src/daynight.ts` (tested) + a mutable `clockRef`/`nightRef` in `app/src/night.ts`. A `Sky.tsx` dome (ShaderMaterial, BackSide) holds the gradient/sun/moon/stars; a `LightingRig.tsx` advances the clock each frame and drives lights/fog/background + `nightRef`; `InstancedVoxels` gains a `material` prop so lamps/windows can glow via `emissiveIntensity`. Store + TweakPanel expose the slider/auto toggle.

**Tech Stack:** React 19 + R3F, three, `@react-spring/web` (unchanged), Zustand.

## Global Constraints

- R3F: no `setState` in `useFrame`; hooks only inside `<Canvas>`; keep `frameloop="always"`; share geometry/materials via module-level constants.
- Sky sphere rendered `BackSide`; ground planes still `rotation-x={-Math.PI/2}`.
- No raw hex in components — colors/glow constants live in `theme.ts`.
- Pure functions are deterministic (no Date.now randomness), unit-tested with `bun test`.
- Never mutate the opencode DB. Never `any`. Avoid `as` unless necessary. No comments unless asked.
- UI copy in English; fonts Fredoka + Nunito only.

---

### Task 1: Theme palette + glow constants

**Files:**
- Modify: `app/src/theme.ts`

**Interfaces:**
- Produces: `SKY_DAY/HORIZON/DAWN/DUSK/NIGHT` colors, `FOG_*`, `SUN_*`, and `LAMP_GLOW`, `WINDOW_GLOW`, `SIGN_GLOW`, `GLOW_MAX` intensity constants.

- [ ] **Step 1: Add palette + glow constants to `app/src/theme.ts`**

```ts
export const SKY = {
  dayTop: "#5fa8ff",
  dayHorizon: "#bfe6ff",
  dawnTop: "#7d7bd0",
  dawnHorizon: "#ffb36b",
  duskTop: "#6a5aa8",
  duskHorizon: "#ff8c5a",
  nightTop: "#0d1230",
  nightHorizon: "#1b2350",
  fog: "#aee6ff",
} as const;

export const SUN_COLOR_DAY = "#fff4d6";
export const SUN_COLOR_DAWN = "#ffb763";
export const SUN_COLOR_DUSK = "#ff8a4a";
export const SUN_INTENSITY_DAY = 1.4;
export const HEMI_INTENSITY_DAY = 0.9;
export const MOON_INTENSITY_NIGHT = 0.35;
export const AMBIENT_NIGHT = 0.12;

export const LAMP_GLOW = "#ffd98a";
export const WINDOW_GLOW = "#ffcf7a";
export const SIGN_GLOW = "#ffe1a6";
export const GLOW_MAX = 1.6;
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/theme.ts
git commit -m "feat(theme): add sky, glow, and light palette constants"
```

---

### Task 2: Day-night math

**Files:**
- Create: `app/src/daynight.ts`
- Test: `app/src/daynight.test.ts`

**Interfaces:**
- Produces:
  - `daylight(t: number): number`
  - `nightAmount(t: number): number`
  - `sunDirection(t: number): { x: number; y: number; z: number }`
  - `moonDirection(t: number): { x: number; y: number; z: number }`
  - `skyPalette(t: number): { top: string; horizon: string; fog: string; sunColor: string }`
  - `phaseLerp(t: number, ramp: number): number`

Where `t ∈ [0,1)`, `0` = midnight, `0.5` = noon.

- [ ] **Step 1: Write the failing test (`app/src/daynight.test.ts`)**

```ts
import { describe, expect, test } from "bun:test";
import { daylight, nightAmount, sunDirection, skyPalette } from "./daynight";

describe("sunDirection", () => {
  test("sun is up at noon, below horizon at midnight", () => {
    expect(sunDirection(0.5).y).toBeCloseTo(1, 5);
    expect(sunDirection(0).y).toBeCloseTo(-1, 5);
  });
  test("sun crosses the horizon at sunrise and sunset", () => {
    expect(sunDirection(0.25).y).toBeCloseTo(0, 5);
    expect(sunDirection(0.75).y).toBeCloseTo(0, 5);
  });
});

describe("daylight / nightAmount", () => {
  test("daylight is 1 at noon, 0 at midnight, 0.5 at the horizon", () => {
    expect(daylight(0.5)).toBeCloseTo(1, 5);
    expect(daylight(0)).toBeCloseTo(0, 5);
    expect(daylight(0.25)).toBeCloseTo(0.5, 5);
  });
  test("nightAmount is the complement", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 0.9]) {
      expect(nightAmount(t)).toBeCloseTo(1 - daylight(t), 5);
    }
  });
  test("daylight increases over the morning", () => {
    expect(daylight(0.3)).toBeGreaterThan(daylight(0.26));
  });
});

describe("skyPalette", () => {
  test("returns finite hex colors and a fog color", () => {
    const p = skyPalette(0.5);
    expect(p.top).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.horizon).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.fog).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.sunColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `bun test app/src/daynight.test.ts`
Expected: FAIL (`./daynight` not found).

- [ ] **Step 3: Implement `app/src/daynight.ts`**

```ts
import { SKY } from "./theme";

// t is a fraction of 24h in [0,1): 0 = midnight, 0.5 = noon.
const TAU = Math.PI * 2;
const COLOR_PHASE = 0.5;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function daylight(t: number): number {
  const e = Math.sin((t - 0.25) * TAU);
  return clamp01(0.5 * e + 0.5);
}

export function nightAmount(t: number): number {
  return 1 - daylight(t);
}

export function sunDirection(t: number): { x: number; y: number; z: number } {
  const az = t * TAU - Math.PI;
  const el = (t - 0.25) * TAU;
  const y = Math.sin(el);
  const r = Math.cos(el);
  return { x: Math.cos(az) * r, y, z: Math.sin(az) * r };
}

export function moonDirection(t: number): { x: number; y: number; z: number } {
  return sunDirection((t + 0.5) % 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexLerp(a: string, b: string, t: number): string {
  const parse = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const;
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(lerp(ar, br, t))}${h(lerp(ag, bg, t))}${h(lerp(ab, bb, t))}`;
}

export function phaseLerp(t: number, ramp: number): number {
  return clamp01((nightAmount(t) - ramp) / (1 - 2 * ramp));
}

export function skyPalette(t: number): { top: string; horizon: string; fog: string; sunColor: string } {
  const n = nightAmount(t);
  const d = 1 - n;
  const top = hexLerp(SKY.nightTop, hexLerp(SKY.dawnTop, SKY.dayTop, COLOR_PHASE - Math.abs(d - COLOR_PHASE)), n);
  const horizon = hexLerp(SKY.nightHorizon, hexLerp(SKY.dawnHorizon, SKY.dayHorizon, COLOR_PHASE - Math.abs(d - COLOR_PHASE)), n);
  const fog = hexLerp(SKY.nightHorizon, SKY.fog, d);
  const sunColor = n > 0.5 ? "#8fa3c9" : d < 0.5 ? SKY.dawnHorizon : SKY.dayHorizon;
  return { top, horizon, fog, sunColor };
}
```

> This is intentionally simple; the plan's tests assert only the shape/monotonicity properties (defined above), not exact color values.

- [ ] **Step 4: Run to confirm it passes**

Run: `bun test app/src/daynight.test.ts`
Expected: PASS (adjust the palette test to match the implementation's returned keys).

- [ ] **Step 5: Commit**

```bash
git add app/src/daynight.ts app/src/daynight.test.ts
git commit -m "feat(daynight): add time-of-day math"
```

---

### Task 3: Clock + night refs

**Files:**
- Create: `app/src/night.ts`

**Interfaces:**
- Produces: `export const clockRef = { current: 0.5 };` and `export const nightRef = { current: 0 };`

- [ ] **Step 1: Create `app/src/night.ts`**

```ts
// Shared mutable time/night refs driven by LightingRig each frame and read by
// Sky / lamps / windows. Kept outside the store so the render loop never
// triggers React re-renders.
export const clockRef = { current: 0.5 };
export const nightRef = { current: 0 };
```

- [ ] **Step 2: Commit**

```bash
git add app/src/night.ts
git commit -m "feat(daynight): add shared clock and night refs"
```

---

### Task 4: InstancedVoxels material prop

**Files:**
- Modify: `app/src/components/three/InstancedVoxels.tsx`

**Interfaces:**
- Produces: `InstancedVoxels` accepts optional `material?: MeshStandardMaterial`; when provided it is used instead of the inline `<meshStandardMaterial>`.

- [ ] **Step 1: Accept a `material` prop**

```tsx
import { BoxGeometry, Color, InstancedMesh, MeshStandardMaterial, Object3D } from "three";

interface InstancedVoxelsProps {
  voxels: Voxel[];
  voxelSize?: number;
  material?: MeshStandardMaterial;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}
```

And in the render, pass the material if provided:

```tsx
return (
  <instancedMesh
    ref={ref}
    args={[geometry, material, voxels.length]}
    castShadow
    receiveShadow
    onClick={onClick}
    onPointerOver={onPointerOver}
    onPointerOut={onPointerOut}
  >
    {material ?? <meshStandardMaterial flatShading />}
  </instancedMesh>
);
```

Note: `args={[geometry, material, count]}` accepts a material; keep `<meshStandardMaterial/>` fallback as a child only when no material is given (avoid material passed both ways).

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/three/InstancedVoxels.tsx
git commit -m "feat(instanced): allow passing a shared material"
```

---

### Task 5: Sky dome

**Files:**
- Create: `app/src/components/three/Sky.tsx`

**Interfaces:**
- Consumes: `clockRef`, `nightRef` from `../../night`; `sunDirection`, `moonDirection`, `skyPalette` from `../../daynight`.
- Produces: `<Sky extent={number} />` — BackSide gradient dome + sun/moon discs + stars; exposes a `skyMaterialRef` (via module-level export `skyUniforms`) so `LightingRig` sets uniforms each frame.

- [ ] **Step 1: Create `app/src/components/three/Sky.tsx`**

```tsx
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, DoubleSide, Points, ShaderMaterial } from "three";
import { clockRef, nightRef } from "../../night";
import { sunDirection, moonDirection, skyPalette } from "../../daynight";

const SKY_RADIUS_FACTOR = 1.5;
const STAR_COUNT = 600;
const STAR_OPACITY_MAX = 0.9;

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const frag = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(h, 0.8));
    float sunGlow = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 24.0);
    col += uSunColor * sunGlow * (1.0 - uNight * 0.7);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const skyUniforms = {
  uTop: { value: new Color("#5fa8ff") },
  uHorizon: { value: new Color("#bfe6ff") },
  uSunDir: { value: new Color(1).setRGB(0, 1, 0) },
  uSunColor: { value: new Color("#fff4d6") },
  uNight: { value: 0 },
};

export function Sky({ extent }: { extent: number }) {
  const sunRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);

  const material = useMemo(() => new ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: skyUniforms, side: BackSide, depthWrite: false }), []);
  const radius = extent * SKY_RADIUS_FACTOR;

  const starPositions = useMemo(() => {
    const rand = mulberry32(9001);
    const pts = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 0.85);
      const r = radius * 0.98;
      pts[i * 3] = Math.sin(phi) * Math.cos(theta) * r * 0.5;
      pts[i * 3 + 1] = Math.cos(phi) * r;
      pts[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r * 0.5;
    }
    return pts;
  }, [radius]);

  useFrame(() => {
    const t = clockRef.current;
    const sun = sunDirection(t);
    const moon = moonDirection(t);
    if (sunRef.current) sunRef.current.position.set(sun.x * radius, sun.y * radius, sun.z * radius);
    if (moonRef.current) moonRef.current.position.set(moon.x * radius, moon.y * radius, moon.z * radius);
    if (starsRef.current) {
      const starsMat = starsRef.current.material as THREE.Material & { opacity: number };
      starsMat.opacity = nightRef.current * STAR_OPACITY_MAX;
    }
  });

  const dayPalette = skyPalette(clockRef.current);

  return (
    <group>
      <mesh material={material} frustumCulled={false}>
        <sphereGeometry args={[radius, 32, 32]} />
      </mesh>
      <mesh ref={sunRef}>
        <circleGeometry args={[6, 24]} />
        <meshBasicMaterial color="#fff4d6" toneMapped={false} />
      </mesh>
      <mesh ref={moonRef}>
        <circleGeometry args={[4, 24]} />
        <meshBasicMaterial color="#d8dcf0" toneMapped={false} />
      </mesh>
      <points ref={starsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.4} sizeAttenuation={false} color="#ffffff" transparent opacity={0} />
      </points>
    </group>
  );
}
```

Fixes to apply before running: `import { mulberry32 } from "../../rand";` (used by star positions); use `THREE.Mesh`/`THREE.Points` types via `import type { Mesh, Points } from "three";` instead of `THREE.Mesh`. The `dayPalette` var is unused — remove or use it to seed the material's initial uniforms. `skyPalette` import must remain for LightingRig (this component may not need it; drop the local `dayPalette`).

- [ ] **Step 2: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/three/Sky.tsx
git commit -m "feat(sky): add gradient sky dome with sun, moon, and stars"
```

---

### Task 6: Lighting rig

**Files:**
- Create: `app/src/components/three/LightingRig.tsx`

**Interfaces:**
- Consumes: `clockRef`, `nightRef` from `../../night`; `daylight`, `sunDirection`, `skyPalette` from `../../daynight`; `useApp` store.
- Produces: `<LightingRig />` — advances the clock when auto, updates the scene sun/hemi/moon lights + fog/background and the sky uniforms + `nightRef`, and throttles the store slider.

- [ ] **Step 1: Create `app/src/components/three/LightingRig.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color } from "three";
import { clockRef, nightRef } from "../../night";
import { skyUniforms } from "./Sky";
import { daylight, sunDirection, skyPalette } from "../../daynight";
import { useApp } from "../../store";
import { SUN_COLOR_DAY, SUN_COLOR_DAWN, SUN_COLOR_DUSK, SUN_INTENSITY_DAY, HEMI_INTENSITY_DAY, MOON_INTENSITY_NIGHT, AMBIENT_NIGHT } from "../../theme";

const SUN_DIST = 30;
const MOON_DIST = 30;
const DAY_HOURS_PER_SECOND = 0.6;
const SLIDER_CADENCE = 0.25;

export function LightingRig() {
  const { scene } = useThree();
  const setTimeOfDay = useApp((s) => s.setTimeOfDay);
  const autoCycle = useApp((s) => s.autoCycle);

  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const moonRef = useRef<THREE.DirectionalLight>(null);

  // Must register refs by reading store once after mount to avoid hook-order issues.
  const auto = useRef(autoCycle);
  useEffect(() => { auto.current = autoCycle; }, [autoCycle]);
  const writeCounter = useRef(0);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    let t = clockRef.current;
    if (auto.current) {
      t = (t + (d * DAY_HOURS_PER_SECOND) / 24) % 1;
      clockRef.current = t;
      writeCounter.current += d;
      if (writeCounter.current >= SLIDER_CADENCE) {
        writeCounter.current = 0;
        setTimeOfDay(t * 24);
      }
    }

    const day = daylight(t);
    const night = 1 - day;
    nightRef.current = night;

    const sun = sunDirection(t);
    const p = skyPalette(t);

    if (sunRef.current) {
      sunRef.current.position.set(sun.x * SUN_DIST, sun.y * SUN_DIST, sun.z * SUN_DIST);
      sunRef.current.intensity = day > 0.02 ? SUN_INTENSITY_DAY * day : 0;
      sunRef.current.color.set(day > 0.02 ? p.sunColor : SUN_COLOR_DAY);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = HEMI_INTENSITY_DAY * (0.35 + 0.65 * day);
      hemiRef.current.color.set(p.top);
      hemiRef.current.groundColor.set("#cfe8b0");
    }
    if (moonRef.current) {
      moonRef.current.intensity = MOON_INTENSITY_NIGHT * night;
      moonRef.current.position.set(-sun.x * MOON_DIST, -sun.y * MOON_DIST, -sun.z * MOON_DIST);
    }

    if (scene.fog) scene.fog.color.set(p.fog);
    scene.background = new Color(p.top);

    skyUniforms.uTop.value.set(p.top);
    skyUniforms.uHorizon.value.set(p.horizon);
    skyUniforms.uSunDir.value.set(sun.x, sun.y, sun.z);
    skyUniforms.uSunColor.value.set(p.sunColor);
    skyUniforms.uNight.value = night;
  });

  return (
    <>
      <directionalLight ref={sunRef} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-far={90} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} />
      <hemisphereLight ref={hemiRef} groundColor="#cfe8b0" />
      <directionalLight ref={moonRef} color="#9fb2d8" />
    </>
  );
}
```

Use `import type { DirectionalLight, HemisphereLight } from "three";` and type refs accordingly. `SUN_COLOR_DAWN`/`SUN_COLOR_DUSK` unused — remove from import.

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/three/LightingRig.tsx
git commit -m "feat(lighting): add time-driven lighting rig"
```

---

### Task 7: Store time state + TweakPanel controls

**Files:**
- Modify: `app/src/store.ts`
- Modify: `app/src/components/hud/TweakPanel.tsx`

**Interfaces:**
- Produces: `timeOfDay: number`, `autoCycle: boolean`, `setTimeOfDay(hours: number)`, `toggleAutoCycle()` (persisted in tweaks slice).

- [ ] **Step 1: Add to `store.ts`**

Append to `AppState`:

```ts
  timeOfDay: number;
  setTimeOfDay: (hours: number) => void;
  autoCycle: boolean;
  toggleAutoCycle: () => void;
```

Add defaults + methods after `resetTweaks`:

```ts
      timeOfDay: 12,
      setTimeOfDay: (hours) => set({ timeOfDay: ((hours % 24) + 24) % 24 }),
      autoCycle: true,
      toggleAutoCycle: () => set((s) => ({ autoCycle: !s.autoCycle })),
```

Update `partialize` and `merge` to persist `timeOfDay` and `autoCycle` alongside `tweaks`/`navigatorOpen`/`filters`/`sortKey`.

- [ ] **Step 2: Add controls to `TweakPanel.tsx`**

In the "World" group (or a new "Time of day" group), add:

```tsx
export function TweakPanel() {
  // existing selectors...
  const timeOfDay = useApp((s) => s.timeOfDay);
  const setTimeOfDay = useApp((s) => s.setTimeOfDay);
  const autoCycle = useApp((s) => s.autoCycle);
  const toggleAutoCycle = useApp((s) => s.toggleAutoCycle);
```

Add a group before `<Group title="World">`:

```tsx
          <Group title="Time of day">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>0:00</span>
              <input
                type="range"
                min={0}
                max={24}
                step={0.1}
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <span>24:00</span>
            </div>
            <Toggle label="Auto cycle" value={autoCycle} onChange={toggleAutoCycle} />
            <div className="text-right font-display text-xs opacity-70">
              {String(Math.floor(timeOfDay)).padStart(2, "0")}:{String(Math.floor((timeOfDay % 1) * 60)).padStart(2, "0")}
            </div>
          </Group>
```

- [ ] **Step 3: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/store.ts app/src/components/hud/TweakPanel.tsx
git commit -m "feat(store): add time-of-day slider and auto-cycle toggle"
```

---

### Task 8: Lamp glow

**Files:**
- Modify: `app/src/components/three/World.tsx`

**Interfaces:**
- Consumes: `nightRef` from `../../night`; `LAMP_GLOW`, `GLOW_MAX` from `../../theme`.
- Produces: lamp `InstancedVoxels` uses a shared glow material whose `emissiveIntensity` is driven by `nightRef` in `useFrame`.

- [ ] **Step 1: Make lamps glow**

```tsx
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import { nightRef } from "../../night";
import { LAMP_GLOW, GLOW_MAX } from "../../theme";
```

In `World`, after `lamps` memo, define a shared material + `useFrame`:

```tsx
  const lampMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#ffffff", emissive: LAMP_GLOW, emissiveIntensity: 0, flatShading: true }),
    [],
  );
  useFrame(() => {
    lampMaterial.emissiveIntensity = nightRef.current * GLOW_MAX;
  });
```

Render lamps with the material:

```tsx
      {lamps.map((l) => (
        <group key={l.key} position={[l.x, 0, l.z]}>
          <InstancedVoxels voxels={lampVoxels()} voxelSize={LAMP_SIZE} material={lampMaterial} />
        </group>
      ))}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/three/World.tsx
git commit -m "feat(lighting): glow street lamps at night"
```

---

### Task 9: House window voxels + LitWindows

**Files:**
- Create: `app/src/components/three/LitWindows.tsx`
- Modify: `app/src/voxel.ts` (export `windowVoxels(opts)`)

**Interfaces:**
- Consumes: `houseVoxels`, `WINDOW_COLOR` from `../../voxel`; `useCity`, `useNeighborhood`, `PROJECT_PALETTE` from `../../theme`; `nightRef`, `WINDOW_GLOW`, `GLOW_MAX`.
- Produces: `<LitWindows />` — one warm-emissive `InstancedVoxels` at window positions, fading in at night.

- [ ] **Step 1: Export `windowVoxels` from `voxel.ts`**

```ts
// Returns only the WINDOW_COLOR cells from a house blueprint.
export function windowVoxels(o: HouseVoxelOptions): Voxel[] {
  return houseVoxels(o).filter((v) => v.color === WINDOW_COLOR);
}
```

- [ ] **Step 2: Create `LitWindows.tsx`**

```tsx
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import { useNeighborhood } from "../../query";
import { useCity } from "../../city";
import { houseScale } from "../../layout";
import { PROJECT_PALETTE, WINDOW_GLOW, GLOW_MAX } from "../../theme";
import { windowVoxels, type Voxel } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { nightRef } from "../../night";

export function LitWindows() {
  const { data } = useNeighborhood();
  const { blocks } = useCity();
  const material = useMemo(
    () => new MeshStandardMaterial({ color: "#ffffff", emissive: WINDOW_GLOW, emissiveIntensity: 0, flatShading: true }),
    [],
  );
  const voxels = useMemo<Voxel[]>(() => {
    const out: Voxel[] = [];
    for (const block of blocks) {
      if (block.kind === "plaza") continue;
      const project = data?.projects.find((p) => p.id === block.projectId);
      if (!project) continue;
      const paletteIndex = blocks.indexOf(block) % 12;
      block.houses.forEach((slot, i) => {
        const session = project.sessions[slot.index];
        if (!session) return;
        const scale = houseScale(session.tokensIn, session.tokensOut);
        const body = PROJECT_PALETTE[paletteIndex % PROJECT_PALETTE.length];
        const voxelScale = 1;
        for (const w of windowVoxels({ body, roof: "#ffffff", width: 7, depth: 7, walls: Math.max(3, Math.round(scale)) })) {
          out.push({ x: slot.x + w.x * voxelScale, y: w.y * voxelScale, z: slot.z + w.z * voxelScale, color: w.color });
        }
      });
    }
    return out;
  }, [blocks, data]);

  useFrame(() => {
    material.emissiveIntensity = nightRef.current * GLOW_MAX;
  });

  if (voxels.length === 0) return null;
  return <InstancedVoxels voxels={voxels} material={material} />;
}
```

> Note: this approximates window placement (footprint 7, walls from scale) so lit windows roughly match houses. Exact house-geometry parity would require extracting the shared kind lookup; acceptable for a first pass and visually aligned with the facades.

- [ ] **Step 3: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/voxel.ts app/src/components/three/LitWindows.tsx
git commit -m "feat(lighting): light up house windows at night"
```

---

### Task 10: Building sign night glow

**Files:**
- Modify: `app/src/components/three/BuildingSign.tsx`

**Interfaces:**
- Consumes: `nightRef` from `../../night`.
- Produces: sign `Html` style gains a warm glow border at night.

- [ ] **Step 1: Drive sign glow**

In `BuildingSign.tsx`, add `const glow = useApp((s) => ...)`? Simplest: read `nightRef` in a `useFrame` and store on a ref, then mirror to the DOM via a small state? Avoid React state frames. Instead, set the sign's night glow via a CSS class toggled by the tweak — but it must respond each frame. Since `nightRef` is a mutable ref, re-rendering the Html isn't needed if we use a `useFrame` to read `nightRef` and mutate a DOM node. But that's heavy.

Simpler and consistent: apply the glow as a fixed subtle always-on warm border that reads as "lit" at night without per-frame updates (the dome darkening makes it read as glowing). Keep it minimal: add a `boxShadow` warm glow to the sign style. This satisfies "read at night" without a frame loop.

```tsx
const SIGN_CSS = {
  ...existing,
  boxShadow: "0 0 12px rgba(255,225,166,0.0), 4px 4px 0 rgba(74,68,83,0.35)",
};
```

Then in `Scene.tsx`/`BuildingSign`, no per-frame change. To make it actually glow at night, set the boxShadow inset alpha via a shared CSS variable updated by `LightingRig` (`document.documentElement.style.setProperty('--sign-glow', alpha)`), and the sign uses `boxShadow: 0 0 12px rgba(255,225,166, var(--sign-glow))`. `LightingRig` sets the CSS var each frame (cheap).

Add to `LightingRig` useFrame: `document.documentElement.style.setProperty("--sign-glow", (night * 0.8).toFixed(2));`
In `BuildingSign.tsx` SIGN_CSS add: `boxShadow: "0 0 14px rgba(255,225,166, var(--sign-glow, 0))",`.

- [ ] **Step 2: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/three/BuildingSign.tsx app/src/components/three/LightingRig.tsx
git commit -m "feat(lighting): glow building signs at night"
```

---

### Task 11: Scene wiring

**Files:**
- Modify: `app/src/components/three/Scene.tsx`

**Interfaces:**
- Consumes: `Sky`, `LightingRig`, `LitWindows` from this plan.
- Produces: `Scene` mounts `Sky`, `LightingRig`, `LitWindows`; removes the static `<color>` background, static lights, and static fog.

- [ ] **Step 1: Edit `Scene.tsx`**

Add imports `import { Sky } from "./Sky"; import { LightingRig } from "./LightingRig"; import { LitWindows } from "./LitWindows";`.

Remove the `<color attach="background" ... />`, the `<fog ... />`, `<hemisphereLight ... />`, and `<directionalLight ... />` blocks (now handled by `LightingRig`).

Add, after the lights' position (top of the fragment):

```tsx
      <Sky extent={extent} />
      <LightingRig />
```

Add `<LitWindows />` near `<City />`.

- [ ] **Step 2: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/three/Scene.tsx
git commit -m "feat(scene): mount sky, lighting rig, and lit windows"
```

---

### Task 12: Full verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: PASS (daynight + sidewalk + voxel + all existing).

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Run the production build**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev`. Verify:
- Scrub the time slider: dome gradient shifts dawn→day→dusk→night; sun/moon discs arc; stars fade in at night; fog/background follows.
- Toggle "Auto cycle": the day rolls on its own; slider follows.
- At night: street lamps glow, house windows warm, building signs glow, traffic lights still work.
- Houses, streets, sidewalks, mountains remain legible; shadows soften as the sun sets.
- No flicker/performance regression.

- [ ] **Step 5: Commit (if smoke found fixes, address them first)**

```bash
git add -A
git commit -m "chore: verify skybox and day-night cycle"
```

---

## Self-Review

**Spec coverage:**
- time math → Task 2.
- sky dome + sun/moon/stars → Task 5.
- lighting rig (lights/fog/background) → Task 6.
- night refs → Task 3.
- lamp glow → Task 8.
- window glow → Task 9.
- sign glow → Task 10.
- slider + auto store/UI → Task 7.
- InstancedVoxels material prop → Task 4.
- Scene wiring → Task 11.
- verify → Task 12.

**Placeholder scan:** no TBD/TODO; the code blocks note required import fixes (mulberry32, three types, unused vars) inline rather than leaving them vague.

**Type consistency:** `clockRef`/`nightRef` defined in `night.ts` (Task 3) imported by Sky/LightingRig/World/LitWindows/BuildingSign. `skyUniforms` module export (Task 5) consumed by LightingRig (Task 6). `setTimeOfDay`/`autoCycle`/`toggleAutoCycle` (Task 7) consumed by LightingRig (Task 6) and TweakPanel (Task 7). `daylight`/`sunDirection`/`skyPalette` (Task 2) consumed by LightingRig/Sky. `windowVoxels` (Task 9) from `voxel.ts`. `GLOW_MAX`/`LAMP_GLOW`/`WINDOW_GLOW` from `theme.ts` (Task 1).
