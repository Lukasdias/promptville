# Civ-Style Camera Controls + Help Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OrbitControls with a Civilization-style fixed-angle camera (pan via drag/edge-scroll/WASD, 45° Q/E rotation, damped zoom, focus-on-selection), add keyboard commands, and a Tab-triggered help panel.

**Architecture:** Pure camera math in `app/src/camera.ts` (unit-tested). A `CivCamera` R3F component inside `<Canvas>` reads input (keys, pointer, wheel) and drives the camera via `useFrame` refs with damping. Drag-vs-click suppression via a tiny `pan.ts` module flag. Help panel state in the existing zustand store.

**Tech Stack:** Bun, React 19, R3F 9, drei 10, three 0.185, zustand, react-spring, Tailwind 4, bun:test.

## Global Constraints

- Never use `any`. Avoid `as` unless necessary.
- No `setState` inside `useFrame` — mutate refs directly, use `delta`.
- Hooks (`useThree`, `useFrame`, `useEffect`) only inside `<Canvas>`.
- `frameloop="always"` stays on the Canvas — do not change.
- All UI copy in English; title "Promptville"; fonts Fredoka (display) + Nunito (body) only.
- Every handled key MUST call `event.preventDefault()` (Tab must not steal browser focus).
- Do NOT `git commit` — the user's AGENTS.md forbids committing unless explicitly asked. Verify with tests instead.
- Run `bun run typecheck` and `bun test` after completing all tasks.

---

### Task 1: Pure camera math module (`app/src/camera.ts`) + tests

**Files:**
- Create: `app/src/camera.ts`
- Test: `tests/camera.test.ts`

**Interfaces:**
- Produces (consumed by Task 3):
  - `export interface CameraState { x: number; z: number; yaw: number; pitch: number; distance: number }`
  - `export interface Vec2 { x: number; z: number }`
  - Constants: `PITCH` (~55° rad), `YAW_STEP` (π/4), `MIN_DISTANCE` (8), `MAX_DISTANCE` (80), `MIN_CAM_HEIGHT` (3), `DEFAULT_YAW` (0), `DEFAULT_DISTANCE` (32), `DEFAULT_EXTENT` (40), `EDGE_MARGIN` (24), `DRAG_THRESHOLD` (5)
  - `export const DEFAULT_CAMERA: CameraState`
  - `export function computePosition(s: CameraState): { x: number; y: number; z: number }`
  - `export function clampState(s: CameraState, extent: number): CameraState`
  - `export function panDelta(s: CameraState, sx: number, sz: number): Vec2`
  - `export function nudgeYaw(yaw: number, dir: 1 | -1): number`
  - `export function zoomBy(distance: number, factor: number): number`
  - `export function focusTargetFor(blocks: PlacedBlock[], projects: ProjectData[], selected: SessionData | null): Vec2`
- Consumes: type-only imports `PlacedBlock` from `./layout`, `ProjectData`/`SessionData` from `./types`.

- [ ] **Step 1: Write the failing tests**

Create `tests/camera.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CAMERA,
  DEFAULT_EXTENT,
  MAX_DISTANCE,
  MIN_CAM_HEIGHT,
  MIN_DISTANCE,
  PITCH,
  YAW_STEP,
  clampState,
  computePosition,
  focusTargetFor,
  nudgeYaw,
  panDelta,
  zoomBy,
} from "../app/src/camera";
import type { PlacedBlock } from "../app/src/layout";
import type { ProjectData, SessionData } from "../app/src/types";

const sessionA: SessionData = {
  id: "sa", title: "t", model: null, agent: null,
  cost: 0, tokensIn: 0, tokensOut: 0, timeCreated: 0,
};
const sessionB: SessionData = {
  id: "sb", title: "t", model: null, agent: null,
  cost: 0, tokensIn: 0, tokensOut: 0, timeCreated: 0,
};
const projects: ProjectData[] = [
  { id: "p1", name: "p1", path: "/", iconColor: null, sessions: [sessionA, sessionB] },
];
const blocks: PlacedBlock[] = [
  {
    projectId: "p1", name: "p1", x: 10, z: 20, width: 5, depth: 5,
    houses: [
      { x: 8, z: 18, index: 0 },
      { x: 12, z: 22, index: 1 },
    ],
  },
];

describe("computePosition", () => {
  test("never drops below MIN_CAM_HEIGHT at any distance/pitch", () => {
    for (const d of [MIN_DISTANCE, 20, MAX_DISTANCE]) {
      for (const p of [0.3, PITCH, 1.4]) {
        const pos = computePosition({ ...DEFAULT_CAMERA, distance: d, pitch: p });
        expect(pos.y).toBeGreaterThanOrEqual(MIN_CAM_HEIGHT);
      }
    }
  });

  test("keeps the camera at the configured distance from the target", () => {
    const s = { ...DEFAULT_CAMERA, distance: 30 };
    const pos = computePosition(s);
    const dx = pos.x - s.x;
    const dz = pos.z - s.z;
    expect(Math.hypot(dx, pos.y, dz)).toBeCloseTo(30, 5);
  });
});

describe("clampState", () => {
  test("clamps the target to the given extent radius", () => {
    const c = clampState({ ...DEFAULT_CAMERA, x: 200, z: 0 }, 40);
    expect(Math.hypot(c.x, c.z)).toBeLessThanOrEqual(40);
  });

  test("clamps distance to [MIN_DISTANCE, MAX_DISTANCE]", () => {
    const far = clampState({ ...DEFAULT_CAMERA, distance: 1000 }, 40);
    expect(far.distance).toBe(MAX_DISTANCE);
    const near = clampState({ ...DEFAULT_CAMERA, distance: 1 }, 40);
    expect(near.distance).toBe(MIN_DISTANCE);
  });

  test("falls back to DEFAULT_EXTENT when the city is smaller", () => {
    const c = clampState({ ...DEFAULT_CAMERA, x: 50, z: 0 }, 10);
    expect(Math.hypot(c.x, c.z)).toBeCloseTo(DEFAULT_EXTENT, 5);
  });
});

describe("panDelta", () => {
  test("screen-space pan converted to world space at yaw 0", () => {
    const s = { ...DEFAULT_CAMERA, yaw: 0 };
    expect(panDelta(s, 1, 0)).toEqual({ x: 1, z: 0 });
    expect(panDelta(s, 0, 1)).toEqual({ x: 0, z: -1 });
    expect(panDelta(s, 0, -1)).toEqual({ x: 0, z: 1 });
  });

  test("rotates the pan vector with yaw", () => {
    const r = { ...DEFAULT_CAMERA, yaw: Math.PI / 2 };
    const up = panDelta(r, 0, 1);
    expect(up.x).toBeCloseTo(-1, 10);
    expect(up.z).toBeCloseTo(0, 10);
    const right = panDelta(r, 1, 0);
    expect(right.x).toBeCloseTo(0, 10);
    expect(right.z).toBeCloseTo(-1, 10);
  });
});

describe("nudgeYaw", () => {
  test("steps by exactly YAW_STEP and normalizes to [0, 2π)", () => {
    expect(nudgeYaw(0, 1)).toBeCloseTo(YAW_STEP, 10);
    expect(nudgeYaw(0, -1)).toBeCloseTo(2 * Math.PI - YAW_STEP, 10);
    expect(nudgeYaw(YAW_STEP, 1)).toBeCloseTo(2 * YAW_STEP, 10);
  });
});

describe("zoomBy", () => {
  test("clamps zoom to [MIN_DISTANCE, MAX_DISTANCE]", () => {
    expect(zoomBy(30, 100)).toBe(MAX_DISTANCE);
    expect(zoomBy(30, 0.001)).toBe(MIN_DISTANCE);
    expect(zoomBy(30, 2)).toBe(60);
  });
});

describe("focusTargetFor", () => {
  test("resolves a selected session to its house position", () => {
    expect(focusTargetFor(blocks, projects, sessionB)).toEqual({ x: 12, z: 22 });
  });

  test("falls back to the city center", () => {
    expect(focusTargetFor(blocks, projects, null)).toEqual({ x: 0, z: 0 });
    expect(focusTargetFor([], [], sessionA)).toEqual({ x: 0, z: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/camera.test.ts`
Expected: FAIL — module `../app/src/camera` cannot be found.

- [ ] **Step 3: Write `app/src/camera.ts`**

```ts
import type { PlacedBlock } from "./layout";
import type { ProjectData, SessionData } from "./types";

export const PITCH = (55 * Math.PI) / 180;
export const YAW_STEP = Math.PI / 4;
export const MIN_DISTANCE = 8;
export const MAX_DISTANCE = 80;
export const MIN_CAM_HEIGHT = 3;
export const DEFAULT_YAW = 0;
export const DEFAULT_DISTANCE = 32;
export const DEFAULT_EXTENT = 40;
export const EDGE_MARGIN = 24;
export const DRAG_THRESHOLD = 5;

export interface CameraState {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  distance: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

export const DEFAULT_CAMERA: CameraState = {
  x: 0,
  z: 0,
  yaw: DEFAULT_YAW,
  pitch: PITCH,
  distance: DEFAULT_DISTANCE,
};

export function computePosition(s: CameraState): { x: number; y: number; z: number } {
  const sinP = Math.sin(s.pitch);
  return {
    x: s.x + s.distance * sinP * Math.sin(s.yaw),
    y: Math.max(s.distance * Math.cos(s.pitch), MIN_CAM_HEIGHT),
    z: s.z + s.distance * sinP * Math.cos(s.yaw),
  };
}

export function clampState(s: CameraState, extent: number): CameraState {
  const maxR = Math.max(DEFAULT_EXTENT, extent);
  const r = Math.hypot(s.x, s.z);
  const scale = r > maxR ? maxR / r : 1;
  return {
    ...s,
    x: s.x * scale,
    z: s.z * scale,
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, s.distance)),
  };
}

export function panDelta(s: CameraState, sx: number, sz: number): Vec2 {
  const c = Math.cos(s.yaw);
  const si = Math.sin(s.yaw);
  return {
    x: sx * c - sz * si,
    z: -sx * si - sz * c,
  };
}

export function nudgeYaw(yaw: number, dir: 1 | -1): number {
  const next = yaw + dir * YAW_STEP;
  return ((next % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

export function zoomBy(distance: number, factor: number): number {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance * factor));
}

export function focusTargetFor(
  blocks: PlacedBlock[],
  projects: ProjectData[],
  selected: SessionData | null,
): Vec2 {
  if (!selected) return { x: 0, z: 0 };
  for (const block of blocks) {
    const project = projects.find((p) => p.id === block.projectId);
    if (!project) continue;
    const index = project.sessions.findIndex((s) => s.id === selected.id);
    if (index >= 0 && block.houses[index]) {
      return { x: block.houses[index].x, z: block.houses[index].z };
    }
  }
  return { x: 0, z: 0 };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/camera.test.ts`
Expected: all pass.

- [ ] **Step 5: Verify app typecheck still passes**

Run: `bun run --cwd app typecheck`
Expected: no errors.

---

### Task 2: Help panel state + overlay component

**Files:**
- Modify: `app/src/store.ts`
- Create: `app/src/components/hud/HelpPanel.tsx`
- Modify: `app/src/App.tsx` (mount `<HelpPanel />`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `useApp` gains `helpOpen: boolean` and `toggleHelp: () => void` (consumed by Task 3's key handler and this panel).
  - `HelpPanel` component (mounted in `App.tsx`; also mounted by Task 4's final wiring — see note).
  - `CivCamera` export for `App.tsx` (imported in Task 3, wired in Task 4).

- [ ] **Step 1: Extend the store**

Modify `app/src/store.ts` to:

```ts
import { create } from "zustand";
import type { SessionData } from "./types";

interface AppState {
  selected: SessionData | null;
  select: (session: SessionData | null) => void;
  clearSelection: () => void;
  helpOpen: boolean;
  toggleHelp: () => void;
}

export const useApp = create<AppState>((set) => ({
  selected: null,
  select: (session) => set({ selected: session }),
  clearSelection: () => set({ selected: null }),
  helpOpen: false,
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
}));
```

- [ ] **Step 2: Create the HelpPanel component**

Create `app/src/components/hud/HelpPanel.tsx`:

```tsx
import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";

interface Row {
  keys: string[];
  label: string;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Move",
    rows: [
      { keys: ["W", "A", "S", "D"], label: "Pan" },
      { keys: ["↑", "↓", "←", "→"], label: "Pan" },
      { keys: ["Drag"], label: "Pan the map" },
      { keys: ["M"], label: "Toggle edge scroll" },
    ],
  },
  {
    title: "Rotate",
    rows: [
      { keys: ["Q", "E"], label: "Rotate 45°" },
      { keys: ["R"], label: "Reset view" },
    ],
  },
  {
    title: "Zoom",
    rows: [
      { keys: ["Scroll"], label: "Zoom" },
      { keys: ["+", "−"], label: "Zoom in / out" },
    ],
  },
  {
    title: "Select",
    rows: [
      { keys: ["Click"], label: "Select a house" },
      { keys: ["F"], label: "Focus selection" },
      { keys: ["Esc"], label: "Clear selection" },
    ],
  },
  {
    title: "General",
    rows: [{ keys: ["Tab"], label: "Toggle help" }],
  },
];

export function HelpPanel() {
  const open = useApp((s) => s.helpOpen);
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: -6 },
    opacity: open ? 1 : 0,
    y: open ? 0 : -6,
    config: { tension: 220, friction: 24 },
  });
  if (!open) return null;

  return (
    <animated.div
      className="pointer-events-none absolute left-1/2 top-1/2 w-[26rem] -translate-x-1/2 -translate-y-1/2"
      style={{ opacity, transform: y.to((v) => `translate(-50%, calc(-50% + ${v}px))`) }}
    >
      <div className="paper-card p-4 font-body text-ink">
        <h2 className="font-display text-xl font-semibold">Controls</h2>
        <div className="mt-2 space-y-3">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="font-display text-sm font-semibold opacity-70">{g.title}</h3>
              <ul className="mt-1 space-y-1">
                {g.rows.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex gap-1">
                      {r.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded-md border-2 border-ink/60 bg-ink/10 px-1.5 py-0.5 text-xs font-bold"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                    <span className="opacity-70">{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </animated.div>
  );
}
```

- [ ] **Step 3: Mount the panel in App.tsx**

Modify `app/src/App.tsx`:

```tsx
import { Header } from "./components/hud/Header";
import { StatsPanel } from "./components/hud/StatsPanel";
import { DetailCard } from "./components/hud/DetailCard";
import { HintBar } from "./components/hud/HintBar";
import { HelpPanel } from "./components/hud/HelpPanel";
import { LoadingState } from "./components/hud/LoadingState";
import { MissingState } from "./components/hud/MissingState";
```

and inside the wrapper `<div>` (after `<HintBar />`):

```tsx
      <HintBar />
      <HelpPanel />
```

- [ ] **Step 4: Verify typecheck**

Run: `bun run --cwd app typecheck`
Expected: no errors.

---

### Task 3: Drag-suppression flag, `CivCamera` controller, and click guards

**Files:**
- Create: `app/src/pan.ts`
- Create: `app/src/components/three/CivCamera.tsx`
- Modify: `app/src/components/three/House.tsx` (guard `onClick`)
- Modify: `app/src/components/three/Ground.tsx` (guard `clear`)

**Interfaces:**
- Consumes: `camera.ts` (all exported constants/functions from Task 1), `useApp` (helpOpen/toggleHelp/clearSelection/selected), `layoutCity` from `./layout`, `mountainOuterRadius` from `./Mountains`, `useNeighborhood` from `../../query`.
- Produces:
  - `export function isPanActive(): boolean` and `export function setPanActive(v: boolean): void` from `./pan`.
  - `export function CivCamera()` — renders `null`, drives the camera. Wired into `App.tsx` in Task 4.

- [ ] **Step 1: Create the pan flag module**

Create `app/src/pan.ts`:

```ts
let panActive = false;

export function isPanActive(): boolean {
  return panActive;
}

export function setPanActive(v: boolean): void {
  panActive = v;
}
```

- [ ] **Step 2: Create the CivCamera component**

Create `app/src/components/three/CivCamera.tsx`:

```tsx
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils } from "three";
import { layoutCity } from "../../layout";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";
import {
  DEFAULT_CAMERA,
  DEFAULT_DISTANCE,
  DEFAULT_EXTENT,
  DEFAULT_YAW,
  DRAG_THRESHOLD,
  EDGE_MARGIN,
  clampState,
  computePosition,
  focusTargetFor,
  nudgeYaw,
  panDelta,
  zoomBy,
  type CameraState,
} from "../../camera";
import { mountainOuterRadius } from "./Mountains";
import { isPanActive, setPanActive } from "../../pan";

const LAMBDA_PAN = 6;
const LAMBDA_ROTATE = 8;
const LAMBDA_ZOOM = 5;
const KEY_PAN_SPEED = 1.6;
const PIXEL_PAN_SCALE = 0.003;

const HANDLED_KEYS = new Set([
  "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright",
  "q", "e", "r", "+", "-", "f", "home", "escape", "tab", "m",
]);

export function CivCamera() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const selected = useApp((s) => s.selected);
  const toggleHelp = useApp((s) => s.toggleHelp);
  const clearSelection = useApp((s) => s.clearSelection);

  const { data } = useNeighborhood();
  const blocks = useMemo(() => (data ? layoutCity(data.projects) : []), [data]);
  const projects = data?.projects ?? [];
  const extent = useMemo(
    () => Math.max(DEFAULT_EXTENT, blocks.length ? mountainOuterRadius(blocks) + 6 : DEFAULT_EXTENT),
    [blocks],
  );

  const state = useRef<CameraState>({ ...DEFAULT_CAMERA });
  const goal = useRef<CameraState>({ ...DEFAULT_CAMERA });
  const keys = useRef<Set<string>>(new Set());
  const pointer = useRef({ down: false, x: 0, y: 0, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  const edgeScroll = useRef(true);
  const helpOpenRef = useRef(helpOpen);
  useEffect(() => {
    helpOpenRef.current = helpOpen;
  }, [helpOpen]);
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const t = focusTargetFor(blocks, projects, selected);
    goal.current.x = t.x;
    goal.current.z = t.z;
  }, [selected, blocks, projects]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!HANDLED_KEYS.has(k)) return;
      e.preventDefault();
      keys.current.add(k);

      if (k === "q" || k === "e") {
        goal.current.yaw = nudgeYaw(goal.current.yaw, k === "q" ? -1 : 1);
      } else if (k === "r") {
        goal.current.x = 0;
        goal.current.z = 0;
        goal.current.yaw = DEFAULT_YAW;
        goal.current.distance = DEFAULT_DISTANCE;
      } else if (k === "f" || k === "home") {
        const t = focusTargetFor(blocks, projects, selectedRef.current);
        goal.current.x = t.x;
        goal.current.z = t.z;
      } else if (k === "+") {
        goal.current.distance = zoomBy(goal.current.distance, 1 / 1.15);
      } else if (k === "-") {
        goal.current.distance = zoomBy(goal.current.distance, 1.15);
      } else if (k === "tab") {
        toggleHelp();
      } else if (k === "escape") {
        if (helpOpenRef.current) toggleHelp();
        else clearSelection();
      } else if (k === "m") {
        edgeScroll.current = !edgeScroll.current;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gl, blocks, projects, toggleHelp, clearSelection]);

  useEffect(() => {
    const el = gl.domElement;
    const onPointerDown = (e: PointerEvent) => {
      setPanActive(false);
      pointer.current = {
        down: true,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
      };
    };
    const onPointerMove = (e: PointerEvent) => {
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
      if (
        pointer.current.down &&
        Math.hypot(e.clientX - pointer.current.startX, e.clientY - pointer.current.startY) > DRAG_THRESHOLD
      ) {
        setPanActive(true);
      }
    };
    const onPointerUp = () => {
      pointer.current.down = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      goal.current.distance = zoomBy(goal.current.distance, e.deltaY > 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const st = state.current;
    const g = goal.current;
    const k = keys.current;

    let sx = 0;
    let sz = 0;
    if (k.has("w") || k.has("arrowup")) sz += 1;
    if (k.has("s") || k.has("arrowdown")) sz -= 1;
    if (k.has("d") || k.has("arrowright")) sx += 1;
    if (k.has("a") || k.has("arrowleft")) sx -= 1;

    const pt = pointer.current;
    if (edgeScroll.current && !pt.down) {
      if (pt.x <= EDGE_MARGIN) sx -= 1;
      else if (pt.x >= size.width - EDGE_MARGIN) sx += 1;
      if (pt.y <= EDGE_MARGIN) sz += 1;
      else if (pt.y >= size.height - EDGE_MARGIN) sz -= 1;
    }

    if (sx !== 0 || sz !== 0) {
      const mag = Math.hypot(sx, sz);
      const p = panDelta(st, sx / mag, sz / mag);
      const speed = g.distance * KEY_PAN_SPEED * d;
      g.x += p.x * speed;
      g.z += p.z * speed;
    }

    if (pt.down && isPanActive()) {
      const dx = pt.x - pt.lastX;
      const dy = pt.y - pt.lastY;
      pt.lastX = pt.x;
      pt.lastY = pt.y;
      const p = panDelta(st, -dx, dy);
      const scale = g.distance * PIXEL_PAN_SCALE;
      g.x += p.x * scale;
      g.z += p.z * scale;
    } else {
      pt.lastX = pt.x;
      pt.lastY = pt.y;
    }

    st.x = MathUtils.damp(st.x, g.x, LAMBDA_PAN, d);
    st.z = MathUtils.damp(st.z, g.z, LAMBDA_PAN, d);
    st.yaw = MathUtils.damp(st.yaw, g.yaw, LAMBDA_ROTATE, d);
    st.distance = MathUtils.damp(st.distance, g.distance, LAMBDA_ZOOM, d);
    st.pitch = g.pitch;

    const clamped = clampState(st, extent);
    const pos = computePosition(clamped);
    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(clamped.x, 0, clamped.z);
  });

  return null;
}
```

- [ ] **Step 3: Guard house selection against drags**

In `app/src/components/three/House.tsx`:
- Add import: `import { isPanActive } from "../../pan";`
- Change the `onClick` handler to:

```tsx
      onClick={(e) => {
        if (isPanActive()) return;
        e.stopPropagation();
        select(session);
      }}
```

- [ ] **Step 4: Guard ground click-to-clear against drags**

In `app/src/components/three/Ground.tsx`:
- Add import: `import { isPanActive } from "../../pan";`
- Change the `clear` helper to:

```tsx
  const clear = (e: { stopPropagation: () => void }) => {
    if (isPanActive()) return;
    e.stopPropagation();
    clearSelection();
  };
```

- [ ] **Step 5: Verify typecheck**

Run: `bun run --cwd app typecheck`
Expected: no errors.

---

### Task 4: Wire CivCamera into App, update HintBar, full verification

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/hud/HintBar.tsx`

**Interfaces:**
- Consumes: `CivCamera` from `./components/three/CivCamera`.

- [ ] **Step 1: Replace OrbitControls with CivCamera in App.tsx**

Modify `app/src/App.tsx` to the following full file:

```tsx
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/three/Scene";
import { CivCamera } from "./components/three/CivCamera";
import { Header } from "./components/hud/Header";
import { StatsPanel } from "./components/hud/StatsPanel";
import { DetailCard } from "./components/hud/DetailCard";
import { HintBar } from "./components/hud/HintBar";
import { HelpPanel } from "./components/hud/HelpPanel";
import { LoadingState } from "./components/hud/LoadingState";
import { MissingState } from "./components/hud/MissingState";

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        frameloop="always"
        shadows
        camera={{ position: [0, 18, 26], fov: 50 }}
        className="h-full w-full"
      >
        <Scene />
        <CivCamera />
      </Canvas>
      <Header />
      <StatsPanel />
      <DetailCard />
      <HintBar />
      <HelpPanel />
      <LoadingState />
      <MissingState />
    </div>
  );
}
```

- [ ] **Step 2: Update the hint bar copy**

Modify `app/src/components/hud/HintBar.tsx` line 16:

```tsx
      Drag to pan · Scroll to zoom · Tab for help
```

- [ ] **Step 3: Run the full test suite**

Run: `bun test`
Expected: all existing API/DB/camera tests pass (no regression).

- [ ] **Step 4: Run typecheck in both workspaces**

Run: `bun run typecheck`
Expected: no errors in either workspace.

- [ ] **Step 5: Manual smoke check**

Run: `bun run dev`, open the app, and verify:
1. Left-drag pans (no orbit/rotate).
2. WASD + arrow keys pan; Q/E rotate in 45° steps; R resets.
3. Scroll wheel and `+`/`-` zoom; camera can never go below the ground.
4. Cursor near an edge pans (M toggles it off/on).
5. Tab opens/closes the help panel; browser focus is NOT moved by Tab.
6. Esc closes help first, then clears selection.
7. Clicking a house still selects it; a drag that starts on a house does not select it.
8. F focuses the selected house; with no selection it returns to the city center.