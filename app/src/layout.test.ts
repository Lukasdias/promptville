import { describe, expect, test } from "bun:test";
import {
  layoutCity,
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

describe("houseScale", () => {
  test("maps token counts logarithmically with clamp", () => {
    expect(houseScale(0, 0)).toBeCloseTo(1);
    expect(houseScale(100, 100)).toBeGreaterThan(1);
    expect(houseScale(1_000_000, 1_000_000)).toBeLessThanOrEqual(6);
  });
});