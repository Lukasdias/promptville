# Promptville — Skybox & Day-Night Cycle Design Spec

Date: 2026-08-28
Status: Draft
Branch: feat/skybox-daynight

## Overview

The scene uses a flat `#aee6ff` background, a fog color, a hemisphere light, and one static shadow-casting directional "sun". This spec adds a time-driven sky dome (gradient shader), moving sun/moon discs, a fading star field, and lighting that animates dawn → day → dusk → night. At night the town lights up: street lamps glow, house windows warm, building signs glow. Controlled by a time-of-day slider (0–24h) plus an "Auto cycle" toggle.

## Goals

1. A cartoon gradient sky dome that shifts color through the day (dawn glow → midday blue → dusk orange → night indigo).
2. A visible sun and moon arcing across the sky; stars fade in at night.
3. Sun/ambient/fog lighting that follows time of day, with a soft moon light at night.
4. Night ambiance: lamp glow, lit windows, building signs glow.
5. Slider + auto toggle control, persisted.

## Architecture

```
app/src/
  daynight.ts            # NEW pure time math (tested)
  daynight.test.ts       # NEW
  components/three/
    Sky.tsx              # NEW: gradient dome + sun/moon discs + stars
    LightingRig.tsx      # NEW: drives lights/fog/background from time
    LitWindows.tsx       # NEW: warm emissive window instances, on at night
    Scene.tsx            # MODIFY: mount Sky + LightingRig; remove static lights/color/fog
    World.tsx            # MODIFY: lamp material gains animated emissive
    City.tsx             # MODIFY (or House): pass window positions to LitWindows via store/hook
  theme.ts               # MODIFY: add night/dawn palette + glow constants
  store.ts               # MODIFY: timeOfDay, autoCycle, cycleSpeed, setters
  components/hud/TweakPanel.tsx  # MODIFY: time slider + auto toggle
```

## Time Model (`daynight.ts`)

`t` is a fraction of 24h in `[0, 1)`: `0` = midnight, `0.5` = noon.

- `sunElevation(t): number` — `-1..1`. Peaks at noon (`t=0.5`), 0 at sunrise/sunset (`t=0.25`/`0.75`), `-1` at midnight. Implemented as `Math.sin((t - 0.25) * 2π)`.
- `moonElevation(t): number` — opposite of the sun: `-sunElevation(t)`.
- `daylight(t): number` — `0..1`; 1 when the sun is high, `0` at night, smooth ramps over sunrise/sunset. `clamp(sunElevation / DUSK_HALF + 1, 0, 1)` with `DUSK_HALF` defining ramp width.
- `nightAmount(t): number` — `1 - daylight(t)`.
- `skyPalette(t)` — returns `{ top, horizon, fog, sunColor, sunIntensity, hemiIntensity, moonIntensity, ambientColor }` by lerping between four keyed phases (night → dawn → day → dusk) using `daylight`/`nightAmount` and the sun elevation sign. Each phase carries hex colors defined in `theme.ts` (SKY_NIGHT_TOP, SKY_DAWN_TOP, SKY_DAY_TOP, SKY_DUSK_TOP, matching horizon/fog variants, plus light colors/intensities).

All pure, deterministic, unit-tested.

## Sky Dome (`Sky.tsx`)

- A sphere of radius `SKY_RADIUS` (≥ `extent * 1.5`) rendered `BackSide` so it wraps the city, using a `ShaderMaterial`:
  - Uniforms: `uElevation`, `uTopColor`, `uHorizonColor`, `uSunDir`, `uNight`.
  - Fragment: gradient from zenith → horizon (mix by view direction `y`), a soft warm glow halo near the sun direction that fades with `uNight`/elevation, and a night tint toward `uTopColor` (deep indigo).
- Sun disc: a small emissive circle mesh positioned on the dome along the sun arc (`sunDirection * SKY_RADIUS * ~0.98`), warm color, `toneMapped` off.
- Moon disc: similar, pale/cool, positioned on the moon arc, dimmer.
- Stars: a `Points` cloud (random directions on the upper hemisphere, seeded) whose `animate` opacity = `nightAmount`; `sizeAttenuation` off so they read as pinpricks. Or an additive star ring on the dome.
- The dome also drives `scene.background` (set `scene.background` to a `Color` per `skyPalette.top` for safety) and the fog color; fog near/far stay constant but the color follows the horizon color.

## Lighting Rig (`LightingRig.tsx`)

- A `useFrame`-driven component that reads `timeOfDay`/`autoCycle`/`cycleSpeed` from the store (via a ref) and, advancing time when auto is on, mutates the scene lights each frame (never `setState`).
- Manages:
  - `directionalLight` **sun**: position = `sunDirection * SUN_DIST`, `intensity` = `sunIntensity` (fades to 0 below horizon), `color` = `sunColor`.
  - `hemisphereLight`: `intensity` = `hemiIntensity`, `skyColor`/`groundColor` = palette.
  - An ambient `moonLight` (cool directional, low intensity) + a minimal ambient floor so the town is visible at night.
  - `scene.fog` color and `scene.background`.
- The sun kept `castShadow` so shadows soften only when the sun is up.

## Night Lights

- **Lamps** (`World.tsx`): the shared lamp `InstancedVoxels` material gets `emissive` (LAMP_GLOW, warm) with `emissiveIntensity` driven by `nightAmount`. Since lamps are one `InstancedVoxels`, one material brightens the whole lamp. A ref to the material is exposed so `LightingRig` can animate it (via a shared night-amount ref in a small module `night.ts`).
- **Windows** (`LitWindows.tsx`): compute, per house, the voxel positions that are `WINDOW_COLOR` in `houseVoxels`, then render one warm-emissive `InstancedVoxels` (a `windowVoxels` blueprint per house translated to world) whose material `emissiveIntensity` fades in at night. Houses already know their session/`x`/`z`/palette; `House`/`Block` can expose the computed window voxels to a `litWindows` scene layer via the store or a derived array.
- **Building signs** (`BuildingSign`): add a night glow class (brighter border / warm tint on the `Html` sign) toggled by `nightAmount` via a shared ref.
- **Traffic lights**: already glow (unchanged).

## Time Control

- `store.ts` additions: `timeOfDay: number` (24h fraction or hours), `autoCycle: boolean`, `cycleSpeed: number`, `setTimeOfDay`, `toggleAutoCycle`; persisted in the existing tweaks slice.
- `LightingRig` advances `timeOfDay` at `cycleSpeed` game-hours/second when `autoCycle`.
- `TweakPanel`: a "Time of day" slider (0–24) + an "Auto cycle" toggle. The slider reflects/pauses on auto (write through when manual).

## Theme

`theme.ts`: add day/night palette constants (SKY_DAY_TOP/HORIZON, SKY_DAWN_*, SKY_DUSK_*, SKY_NIGHT_*, SUN_* light colors, LAMP_GLOW, WINDOW_GLOW, SIGN_GLOW) and intensities. No raw hex in components.

## Testing

- `daynight.test.ts`: sun elevation is 0 at sunrise/sunset, ≈1 at noon, ≈-1 at midnight; `daylight` monotonic increasing over morning and `1` around noon / `0` at night; `nightAmount` is complement; `skyPalette` returns finite hex strings and monotonically decreasing top luminance from day → dusk → night.

## Verification

- `bun test`, `bun run typecheck`, `bun run build`.
- Manual `bun run dev`: scrub the slider — dome gradient, sun/moon arc, stars appear at night, lamps/windows/signs glow, houses/streets/sidewalks remain legible; auto mode rolls through the day.

## Out of Scope

- Weather/precipitation, bloom/post-processing, fireflies, seasonal/temporary effects (later "more effects").
- Changes to the traffic/road graph.
- Physical sky scattering (drei `Sky`) — the dome is a stylized gradient, not atmospheric scattering.
