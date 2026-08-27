# Promptville — Civ-Style Camera Controls + Help Panel

Date: 2026-08-27
Status: Draft

## Overview

Replace the drei `OrbitControls` in Promptville with a Civilization-style camera: fixed-angle top-down-ish view, free panning (drag, edge scroll, WASD/arrows), 45°-snapped rotation (Q/E), damped zoom, and a focus-on-selection fly-to. Add keyboard commands throughout and a Tab-triggered help panel listing every control. Two existing bugs are fixed as part of the redesign: the camera can no longer dip into/under the ground, and Tab no longer moves browser focus outside the app.

## Background / Bugs Fixed

**Bug 1 — camera goes "under the earth".** Current `OrbitControls` allows polar angle down to `π/2.4` (75°, i.e. only 15° above horizontal) with `minDistance={6}`. At min zoom the camera sits ~1.5 units above the grass looking nearly edge-on, so it visually skims/clips into the terrain. Fix: the new camera uses a fixed steep pitch and enforces a hard height floor.

**Bug 2 — Tab steals focus.** Pressing Tab moves browser focus (tab cycle / page focus) instead of toggling help. Fix: the keyboard handler calls `preventDefault()` on every handled key, Tab included.

## Camera Model

Pure math lives in `app/src/camera.ts` (testable, no R3F).

```
CameraState {
  target: { x: number; z: number }   // ground point camera looks at, clamped to city bounds
  yaw: number                        // rotation around Y, snapped to 45° steps
  pitch: number                      // fixed ~55° from vertical (never user-changed)
  distance: number                   // zoom, clamped [MIN_DISTANCE, MAX_DISTANCE]
}
```

Constants: `PITCH ≈ 55°`, `MIN_DISTANCE = 8`, `MAX_DISTANCE = 80`, `MIN_CAM_HEIGHT = 3`, `YAW_STEP = π/4`, `EDGE_MARGIN = 24px`, `DRAG_THRESHOLD = 5px`, `DEFAULT_YAW`, `DEFAULT_DISTANCE`.

### Position & floor invariant

Each frame the controller derives camera position from spherical math:

```
camX = target.x + distance * sin(pitch) * sin(yaw)
camY = distance * cos(pitch)
camZ = target.z + distance * sin(pitch) * cos(yaw)
camY = max(camY, MIN_CAM_HEIGHT)   // hard floor: never under the ground
camera.position.set(camX, camY, camZ)
camera.lookAt(target.x, 0, target.z)
```

The `MIN_CAM_HEIGHT` floor is applied **after** computing position, so the camera mathematically cannot intersect the ground plane regardless of zoom, pan, or future pitch changes. The target is clamped to the city bounds (radius `extent` from origin; default extent ~40 when no data).

### Panning

Three input sources produce a single screen-space pan vector (so WASD "up" always means screen-up after rotation):

- **Keys** — W/A/S/D and arrow keys while held.
- **Edge scroll** — cursor within `EDGE_MARGIN` px of a viewport edge; on by default, toggled with M.
- **Left-drag** — Civ-style: dragging the mouse pans the map. A `DRAG_THRESHOLD` (~5px) of pointer movement separates a pan from a click; a module-level `panActive` flag is set once exceeded so R3F `onClick` on houses/ground never fires after a pan.

Pan direction converts to world space using `yaw`, and the target is damped toward `target + panDelta` (`THREE.MathUtils.damp`, λ≈6). Resulting target is clamped to bounds.

### Zoom

- Mouse wheel (non-passive, `preventDefault`) toward `target`.
- `+` / `-` (and Numpad `+`/`-`) keys.
- Distance damps toward goal (λ≈5), clamped `[8, 80]`.

### Rotation

- Q / E nudge the **yaw goal** by ±`YAW_STEP` (45°); current yaw damps to the goal (λ≈8) for a quick Civ-like snap.
- R resets to `DEFAULT_YAW`, `DEFAULT_DISTANCE`, target = city center.

### Focus

- F or Home sets the camera target goal to the selected house's `{x, z}` via `focusTargetFor(blocks, selected)`; with nothing selected it targets city center.
- Selecting a house also auto-focuses.
- Damped pan (λ≈6) produces the fly-to.

## Keyboard Commands

All handled keys call `preventDefault()` (no browser tab-cycle, no page scroll).

| Key | Action |
|-----|--------|
| W / A / S / D, Arrow keys | Pan (hold) |
| Q / E | Rotate camera 45° left / right |
| R | Reset to default view |
| `+` / `-` (incl. Numpad) | Zoom in / out |
| F or Home | Focus selected house (or city center) |
| Esc | Close help panel if open, else clear selection |
| Tab | Toggle help panel |
| M | Toggle edge scrolling |

## Help Panel

`app/src/components/hud/HelpPanel.tsx` — paper-card overlay matching the HUD identity (cream fill, thick rounded ink border, soft shadow, Fredoka headings / Nunito body). Keycap chips (rounded squares, letter). Grouped rows:

- **Move** — W A S D / Arrows pan, drag pan, edge scroll (M)
- **Rotate** — Q / E, R reset
- **Zoom** — scroll wheel, `+` / `-`
- **Select** — click a house, F focus, Esc clear
- **General** — Tab help

`pointer-events-none` so it never blocks the 3D scene. Visibility stored in zustand (`helpOpen` + `toggleHelp`) — UI state, consistent with the existing "Zustand only for UI selection state" rule. Esc closes help before clearing selection.

## Architecture

- `app/src/camera.ts` — pure functions + constants (unit-tested).
- `app/src/components/three/CivCamera.tsx` — inside `<Canvas>`, renders `null`. Refs for camera state and input state; `useFrame((_, delta))` damps toward goals and applies the position + floor logic. No `setState` in the loop (AGENTS rule). DOM listeners on `gl.domElement` (pointerdown/move/up, wheel `passive:false`) and `window` (keydown/keyup). Watches `useApp(s => s.selected)` for focus.
- `app/src/components/hud/HelpPanel.tsx` — overlay; mounts alongside existing HUD.
- `app/src/store.ts` — add `helpOpen`, `toggleHelp`.
- `app/src/App.tsx` — replace `<OrbitControls>` with `<CivCamera />`; keep `<Canvas camera={{ position: [0, 18, 26], fov: 50 }}>` as the initial camera.
- `app/src/components/hud/HintBar.tsx` — text → "WASD/Arrows pan · Q/E rotate · Scroll zoom · Tab help".

Replaces `@react-three/drei` `OrbitControls` usage in `App.tsx` (drei stays for other components).

## Edge Cases & Error Handling

- **No data (DB missing)**: `blocks` empty → extent defaults to ~40; camera still pans/zooms/rotates over an empty plane. `focusTargetFor` returns city center.
- **Help open + Esc**: closes help first, does not clear selection.
- **Drag from a house**: `panActive` flag suppresses the selection click.
- **Keys during drag**: panning input still works; no conflicts (all paths write to the same target goal).
- **Focus with no selection**: flies to city center instead of erroring.

## Testing

`tests/camera.test.ts` (mirrors `layout.ts` test pattern, run via `bun test`):

- **Height floor**: for a range of distances/pitches, computed `camY ≥ MIN_CAM_HEIGHT`.
- **Target clamp**: pan beyond bounds → target stays inside extent.
- **Rotation snap**: Q/E nudges yaw by exactly ±45°; yaw normalizes to [0, 2π).
- **Zoom clamp**: wheel/keys beyond bounds → distance stays in [8, 80].
- **Focus resolution**: `focusTargetFor(blocks, selected)` returns house `{x, z}` for a selected session and city center when none.

Also run `bun run typecheck` after implementation. `CivCamera`/`HelpPanel` are manual-smoke-tested (R3F + DOM listeners, not unit-covered — consistent with the project's approach).

## Out of Scope

- No tilt/roll of the camera (fixed pitch by design).
- No minimap.
- No configurable keybindings.
- No touch/pinch support (desktop keyboard+mouse focus).