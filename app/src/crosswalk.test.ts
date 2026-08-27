import { describe, expect, test } from "bun:test";
import { buildCrosswalks } from "./crosswalk";
import { buildStreets, CIVIC_PLAZA, layoutCity } from "./layout";
import { findIntersections } from "./traffic";

const sessions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, tokensIn: 10, tokensOut: 5, timeCreated: i }));

function makeCrosswalks() {
  const projects = Array.from({ length: 9 }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    sessions: sessions(8),
  }));
  const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
  const streets = buildStreets(blocks);
  const intersections = findIntersections(streets);
  return { streets, stripes: buildCrosswalks(intersections, streets), intersections };
}

describe("buildCrosswalks", () => {
  test("places four stripes per junction with an avenue", () => {
    const { stripes, intersections } = makeCrosswalks();
    expect(intersections.length).toBeGreaterThan(0);
    expect(stripes.length).toBe(intersections.length * 4);
  });

  test("no two stripes overlap", () => {
    const { stripes } = makeCrosswalks();
    for (let i = 0; i < stripes.length; i++) {
      for (let j = i + 1; j < stripes.length; j++) {
        const a = stripes[i]!;
        const b = stripes[j]!;
        const overlap =
          Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
        expect(overlap).toBe(false);
      }
    }
  });

  test("every stripe lies on a street", () => {
    const { stripes, streets } = makeCrosswalks();
    for (const s of stripes) {
      const onStreet = streets.some(
        (st) =>
          Math.abs(s.z - st.z) <= st.depth / 2 + 0.01 &&
          Math.abs(s.x - st.x) <= st.width / 2 + 0.01,
      );
      expect(onStreet).toBe(true);
    }
  });

  test("stripes span the full width of the avenue they cross", () => {
    const { stripes, streets } = makeCrosswalks();
    for (const s of stripes) {
      const avenue = streets.find(
        (st) => st.width >= st.depth && Math.abs(st.z - s.z) < 0.01 && Math.abs(st.x - s.x) <= st.width / 2 + 0.01,
      );
      expect(avenue).toBeDefined();
      expect(s.d).toBeCloseTo(avenue!.depth);
    }
  });
});