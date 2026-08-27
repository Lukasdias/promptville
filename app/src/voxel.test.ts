import { describe, expect, test } from "bun:test";
import {
  houseVoxels,
  treeVoxels,
  lampVoxels,
  mountainVoxels,
  DOOR_COLOR,
  WINDOW_COLOR,
  CHIMNEY_COLOR,
  TRUNK_COLOR,
  GLOW_COLOR,
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

describe("mountainVoxels", () => {
  test("is a solid centered pyramid with snow cap", () => {
    const h = 6;
    const voxels = mountainVoxels(h);
    const baseLayer = voxels.filter((v) => v.y === 0);
    expect(baseLayer).toHaveLength((2 * (h - 1) + 1) ** 2);
    expect(voxels.filter((v) => v.y === h - 1)).toHaveLength(1); // apex
    expect(voxels.filter((v) => v.y === h - 1)[0].color).toBe("#f4f1e6"); // snow apex
    for (const v of voxels) {
      expect(Math.abs(v.x)).toBeLessThanOrEqual(h - 1 - v.y);
      expect(Math.abs(v.z)).toBeLessThanOrEqual(h - 1 - v.y);
    }
  });
});