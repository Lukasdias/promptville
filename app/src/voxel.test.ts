import { describe, expect, test } from "bun:test";
import {
  houseVoxels,
  treeVoxels,
  lampVoxels,
  personVoxels,
  carVoxels,
  placeVoxels,
  mountainRingVoxels,
  bushVoxels,
  flowersVoxels,
  mailboxVoxels,
  signVoxels,
  benchVoxels,
  fountainVoxels,
  hydrantVoxels,
  coneVoxels,
  trafficLightVoxels,
  DOOR_COLOR,
  WINDOW_COLOR,
  CHIMNEY_COLOR,
  TRUNK_COLOR,
  GLOW_COLOR,
  SKIN_COLOR,
  SNOW_COLOR,
  WHEEL_COLOR,
  BUSH_COLOR,
  FLOWER_COLORS,
  MAILBOX_COLOR,
  SIGN_BOARD,
  BENCH_WOOD,
  FOUNTAIN_WATER,
  HYDRANT_COLOR,
  CONE_COLOR,
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

  test("car is a wide chassis with visible wheels and a cabin", () => {
    const voxels = carVoxels("#ff8fa3");
    expect(voxels).toHaveLength(12);
    expect(voxels.filter((v) => v.color === WHEEL_COLOR)).toHaveLength(4);
    expect(voxels.filter((v) => v.color === "#ff8fa3")).toHaveLength(6);
    expect(voxels.filter((v) => v.color === WINDOW_COLOR)).toHaveLength(2);
  });

  test("placeVoxels offsets a pattern onto an absolute base at a given size", () => {
    const placed = placeVoxels(personVoxels("#fff"), 3.5, -2, 0.15);
    expect(placed[0].x).toBeCloseTo(3.5 / 0.15 - 0.5);
    expect(placed[0].z).toBeCloseTo(-2 / 0.15 - 0.5);
    expect(placed[0].y).toBe(0);
  });
});

describe("environmental blueprints", () => {
  test("bush is a rounded 3-layer blob", () => {
    const voxels = bushVoxels();
    expect(voxels).toHaveLength(15);
    expect(voxels.every((v) => v.color === BUSH_COLOR)).toBe(true);
  });

  test("flower bed has a ground base and colored blooms on top", () => {
    const voxels = flowersVoxels();
    expect(voxels).toHaveLength(13);
    expect(voxels.filter((v) => v.y === 1 && FLOWER_COLORS.includes(v.color))).toHaveLength(4);
  });

  test("mailbox is a post with a box and flag", () => {
    const voxels = mailboxVoxels();
    expect(voxels).toHaveLength(4);
    expect(voxels.filter((v) => v.color === MAILBOX_COLOR)).toHaveLength(2);
  });

  test("sign is a pole with a wide board on top", () => {
    const voxels = signVoxels();
    expect(voxels.filter((v) => v.y === 3 && v.color === SIGN_BOARD)).toHaveLength(3);
  });

  test("bench has legs, seat and back", () => {
    const voxels = benchVoxels();
    expect(voxels).toHaveLength(10);
    expect(voxels.every((v) => v.color === BENCH_WOOD)).toBe(true);
  });

  test("fountain holds water", () => {
    const voxels = fountainVoxels();
    expect(voxels.some((v) => v.color === FOUNTAIN_WATER)).toBe(true);
  });

  test("hydrant is red with side spouts", () => {
    const voxels = hydrantVoxels();
    expect(voxels).toHaveLength(5);
    expect(voxels.filter((v) => v.color === HYDRANT_COLOR)).toHaveLength(5);
  });

  test("cone is a small stack", () => {
    const voxels = coneVoxels();
    expect(voxels).toHaveLength(3);
    expect(voxels.every((v) => v.color === CONE_COLOR)).toBe(true);
  });

  test("traffic light is a thin pole with a neutral housing (lamp box rendered on top)", () => {
    const voxels = trafficLightVoxels();
    expect(voxels).toHaveLength(13);
    // No baked lens colors — the live lamp is the single signal.
    expect(voxels.some((v) => v.color === "#ff5252")).toBe(false);
    expect(voxels.some((v) => v.color === "#ffd24a")).toBe(false);
    expect(voxels.some((v) => v.color === "#3ddc64")).toBe(false);
    expect(voxels.every((v) => v.z === 0)).toBe(true);
  });
});