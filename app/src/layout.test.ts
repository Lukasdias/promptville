import { describe, expect, test } from "bun:test";
import {
  layoutCity,
  buildStreets,
  houseScale,
  HOUSE_SPACING,
  HOUSE_PAD,
  ROAD_WIDTH,
} from "./layout";

const projects = [
  { id: "a", name: "A", sessions: Array.from({ length: 5 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "b", name: "B", sessions: Array.from({ length: 20 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "c", name: "C", sessions: Array.from({ length: 3 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "d", name: "D", sessions: Array.from({ length: 9 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "e", name: "E", sessions: Array.from({ length: 7 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
];

describe("layoutCity", () => {
  const blocks = layoutCity(projects);

  test("places one block per project, in order", () => {
    expect(blocks.map((b) => b.projectId)).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("wraps to a new row after BLOCKS_PER_ROW", () => {
    const first = blocks[0];
    const fifth = blocks[4];
    expect(fifth.x).toBeCloseTo(first.x); // same left column
    expect(fifth.z).toBeGreaterThan(first.z); // moved down a row
  });

  test("adjacent blocks in a row are separated by ROAD_WIDTH", () => {
    expect(blocks[1].x - (blocks[0].x + blocks[0].width)).toBeCloseTo(ROAD_WIDTH);
  });

  test("every house lands inside its block bounds", () => {
    for (const b of blocks) {
      for (const h of b.houses) {
        expect(h.x).toBeGreaterThanOrEqual(b.x - b.width / 2);
        expect(h.x).toBeLessThanOrEqual(b.x + b.width / 2);
        expect(h.z).toBeGreaterThanOrEqual(b.z - b.depth / 2);
        expect(h.z).toBeLessThanOrEqual(b.z + b.depth / 2);
      }
    }
  });

  test("houses are spaced HOUSE_SPACING apart on a grid", () => {
    const b = blocks[1]; // 20 sessions
    const sorted = [...b.houses].sort((p, q) => p.index - q.index);
    for (let i = 1; i < sorted.length; i++) {
      const dx = Math.abs(sorted[i].x - sorted[i - 1].x);
      const dz = Math.abs(sorted[i].z - sorted[i - 1].z);
      const sameRow = Math.abs(dz) < 1e-9 && Math.abs(dx - HOUSE_SPACING) < 1e-9;
      const nextRow = Math.abs(dz - HOUSE_SPACING) < 1e-9;
      expect(sameRow || nextRow).toBe(true);
    }
    expect(HOUSE_PAD).toBeGreaterThan(0);
  });
});

describe("buildStreets", () => {
  const blocks = layoutCity(projects);

  test("produces horizontal avenues between rows and vertical streets between blocks", () => {
    const streets = buildStreets(blocks);
    // 5 blocks → 1 row boundary below the first 4; row 2 has 1 block (no gaps)
    const horizontals = streets.filter((s) => s.depth < s.width);
    const verticals = streets.filter((s) => s.width < s.depth);
    expect(horizontals).toHaveLength(1);
    expect(verticals).toHaveLength(3); // 3 gaps in the first row
  });

  test("horizontal avenues span the full city width", () => {
    const streets = buildStreets(blocks);
    const horizontal = streets.find((s) => s.depth < s.width)!;
    const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
    const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
    expect(horizontal.width).toBeCloseTo(maxX - minX);
  });

  test("every street fills the gap exactly and never overlaps a block", () => {
    const streets = buildStreets(blocks);
    const eps = 0.001;
    for (const s of streets) {
      for (const b of blocks) {
        const overlap =
          s.x + s.width / 2 > b.x - b.width / 2 + eps &&
          s.x - s.width / 2 < b.x + b.width / 2 - eps &&
          s.z + s.depth / 2 > b.z - b.depth / 2 + eps &&
          s.z - s.depth / 2 < b.z + b.depth / 2 - eps;
        expect(overlap).toBe(false);
      }
    }
  });

  test("all streets lie within the city bounds", () => {
    const streets = buildStreets(blocks);
    const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
    const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
    const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2));
    const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2));
    for (const s of streets) {
      expect(s.x - s.width / 2).toBeGreaterThanOrEqual(minX);
      expect(s.x + s.width / 2).toBeLessThanOrEqual(maxX);
      expect(s.z - s.depth / 2).toBeGreaterThanOrEqual(minZ);
      expect(s.z + s.depth / 2).toBeLessThanOrEqual(maxZ);
    }
  });
});

describe("houseScale", () => {
  test("maps token counts logarithmically with clamp", () => {
    expect(houseScale(0, 0)).toBeCloseTo(1);
    expect(houseScale(100, 100)).toBeGreaterThan(1);
    expect(houseScale(1_000_000, 1_000_000)).toBeLessThanOrEqual(6);
  });
});