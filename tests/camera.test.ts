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
    const right = panDelta(s, 1, 0);
    expect(right.x).toBe(1);
    expect(right.z).toBeCloseTo(0, 10);
    const up = panDelta(s, 0, 1);
    expect(up.x).toBeCloseTo(0, 10);
    expect(up.z).toBe(-1);
    const down = panDelta(s, 0, -1);
    expect(down.x).toBeCloseTo(0, 10);
    expect(down.z).toBe(1);
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