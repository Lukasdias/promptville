import { describe, expect, test } from "bun:test";
import {
  houseVoxels,
  treeVoxels,
  lampVoxels,
  personVoxels,
  carVoxels,
  placeVoxels,
  mountainRingVoxels,
  DOOR_COLOR,
  WINDOW_COLOR,
  CHIMNEY_COLOR,
  TRUNK_COLOR,
  GLOW_COLOR,
  SKIN_COLOR,
  SNOW_COLOR,
} from "./voxel";

describe("houseVoxels", () => {
  const voxels = houseVoxels({ body: "#ffb3ba", roof: "#ff7f50", walls: 4, chimney: true });
  const has = (x: number, y: number, z: number, color?: string) =>
    voxels.some((v) => v.x === x && v.y === y && v.z === z && (!color || v.color === color));

  test("builds hollow walls of thickness 1", () => {
    expect(has(3, 0, 0, "#ffb3ba")).toBe(true); // boundary wall
    expect(has(0, 1, 0)).toBe(false); // interior is empty
  });

  test("stays within footprint and wall bounds", () => {
    for (const v of voxels) {
      expect(Math.abs(v.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(v.z)).toBeLessThanOrEqual(3);
      expect(v.y).toBeGreaterThanOrEqual(0);
    }
    expect(voxels.some((v) => v.y >= 4)).toBe(true); // roof exists above walls
  });

  test("places door, windows, and chimney", () => {
    expect(has(0, 0, 3, DOOR_COLOR)).toBe(true);
    expect(has(2, 2, 3, WINDOW_COLOR)).toBe(true);
    expect(has(-2, 2, 3, WINDOW_COLOR)).toBe(true);
    expect(has(2, 4 + 3 + 1, 0, CHIMNEY_COLOR)).toBe(true);
  });

  test("flat variant has no voxels above the wall slab (except chimney)", () => {
    const flat = houseVoxels({ body: "#fff", roof: "#333", walls: 3, pitched: false });
    expect(flat.some((v) => v.y === 3 && v.color === "#333")).toBe(true);
    for (const v of flat) {
      expect(v.y).toBeLessThanOrEqual(3);
    }
  });
});

describe("treeVoxels", () => {
  const voxels = treeVoxels("#86c255");

  test("has trunk and foliage, stays in bounds", () => {
    expect(voxels.some((v) => v.color === TRUNK_COLOR)).toBe(true);
    expect(voxels.some((v) => v.color === "#86c255")).toBe(true);
    for (const v of voxels) {
      expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(v.z)).toBeLessThanOrEqual(1);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeLessThanOrEqual(5);
    }
  });
});

describe("lampVoxels", () => {
  test("is a pole with a glow orb on top", () => {
    const voxels = lampVoxels();
    expect(voxels).toHaveLength(4);
    expect(voxels[3]).toEqual({ x: 0, y: 3, z: 0, color: GLOW_COLOR });
  });
});

describe("mountainRingVoxels", () => {
  test("forms a continuous closed ring with no angular gaps", () => {
    const cx = 0;
    const cz = 0;
    const radius = 24;
    const halfWidth = 6;
    const voxels = mountainRingVoxels(cx, cz, radius, halfWidth);
    expect(voxels.length).toBeGreaterThan(5000);

    const hasVoxelNear = (angle: number) =>
      voxels.some((v) => {
        const a = Math.atan2(v.z - cz, v.x - cx);
        let diff = Math.abs(a - angle);
        diff = Math.min(diff, Math.PI * 2 - diff);
        const d = Math.sqrt((v.x - cx) ** 2 + (v.z - cz) ** 2);
        return diff < 0.06 && d > radius - halfWidth && d < radius + halfWidth;
      });

    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * Math.PI * 2;
      expect(hasVoxelNear(angle)).toBe(true);
    }
  });

  test("stays inside the ring bounds and caps tall peaks with snow", () => {
    const voxels = mountainRingVoxels(0, 0, 20, 5);
    for (const v of voxels) {
      const d = Math.sqrt(v.x ** 2 + v.z ** 2);
      expect(d).toBeGreaterThanOrEqual(15);
      expect(d).toBeLessThanOrEqual(25);
    }
    expect(voxels.some((v) => v.color === SNOW_COLOR)).toBe(true);
  });
});

describe("personVoxels / carVoxels / placeVoxels", () => {
  test("person is a small stack with shirt and head", () => {
    const voxels = personVoxels("#ffb3ba");
    expect(voxels).toHaveLength(4);
    expect(voxels.filter((v) => v.color === "#ffb3ba")).toHaveLength(2);
    expect(voxels[voxels.length - 1].color).toBe(SKIN_COLOR);
  });

  test("car is a low body with a cabin", () => {
    const voxels = carVoxels("#ff8fa3");
    expect(voxels).toHaveLength(6);
    expect(voxels.filter((v) => v.color === "#ff8fa3")).toHaveLength(4);
  });

  test("placeVoxels offsets a pattern onto an absolute base at a given size", () => {
    const placed = placeVoxels(personVoxels("#fff"), 3.5, -2, 0.15);
    expect(placed[0].x).toBeCloseTo(3.5 / 0.15 - 0.5);
    expect(placed[0].z).toBeCloseTo(-2 / 0.15 - 0.5);
    expect(placed[0].y).toBe(0);
  });
});