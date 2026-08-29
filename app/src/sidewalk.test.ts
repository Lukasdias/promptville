import { describe, expect, test } from "bun:test";
import { sidewalkSegments, CURB_WIDTH, SIDEWALK_WIDTH } from "./sidewalk";
import type { Street } from "./layout";

const avenue: Street = { x: 0, z: 0, width: 8, depth: 3.5 };
const vertical: Street = { x: 0, z: 0, width: 3.5, depth: 8 };

describe("sidewalkSegments", () => {
  test("lays walk + curb segments along both flanks of a horizontal street", () => {
    const segs = sidewalkSegments([avenue]);
    expect(segs.length).toBeGreaterThan(0);
    const kinds = new Set(segs.map((s) => s.kind));
    expect(kinds).toEqual(new Set(["walk", "curb"]));
    for (const s of segs) {
      expect(Math.abs(s.z) > avenue.depth / 2).toBe(true);
    }
  });

  test("vertical street flanks on the x axis", () => {
    const segs = sidewalkSegments([vertical]);
    for (const s of segs) {
      expect(Math.abs(s.x) > vertical.width / 2).toBe(true);
    }
  });

  test("curb is nearest the street, walk is outside it", () => {
    const segs = sidewalkSegments([avenue]);
    const curbMin = Math.min(...segs.filter((s) => s.kind === "curb").map((s) => Math.abs(s.z)));
    const walkMin = Math.min(...segs.filter((s) => s.kind === "walk").map((s) => Math.abs(s.z)));
    expect(curbMin).toBeCloseTo(avenue.depth / 2 + CURB_WIDTH / 2, 1);
    expect(walkMin).toBeGreaterThan(curbMin);
  });

  test("segments never span a crossing street's road", () => {
    const horizontal: Street = { x: 0, z: 0, width: 24, depth: 3.5 };
    const crossing: Street = { x: 6, z: 0, width: 3.5, depth: 24 };
    const segs = sidewalkSegments([horizontal, crossing]);
    for (const s of segs) {
      expect(Math.abs(s.x - crossing.x) < crossing.width / 2).toBe(false);
    }
  });

  test("walkway is low and wide (not a wall)", () => {
    for (const s of sidewalkSegments([avenue])) {
      if (s.kind === "walk") {
        expect(s.d).toBe(SIDEWALK_WIDTH);
        expect(s.d).toBeGreaterThan(CURB_WIDTH);
      } else {
        expect(s.d).toBe(CURB_WIDTH);
      }
    }
  });

  test("same-kind segments never overlap (prevents corner z-fighting)", () => {
    // Two perpendicular streets meeting at a junction: their flank strips must
    // not pile up in the corner square. Coplanar overlapping boxes z-fight,
    // worst when zoomed out (depth precision), which reads as flicker.
    const horizontal: Street = { x: 0, z: 0, width: 24, depth: 3.5 };
    const vertical: Street = { x: 0, z: 0, width: 3.5, depth: 24 };
    const segs = sidewalkSegments([horizontal, vertical]);
    for (const kind of ["walk", "curb"] as const) {
      const same = segs.filter((s) => s.kind === kind);
      for (let i = 0; i < same.length; i++) {
        for (let j = i + 1; j < same.length; j++) {
          const a = same[i];
          const b = same[j];
          const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
          const oz = Math.min(a.z + a.d / 2, b.z + b.d / 2) - Math.max(a.z - a.d / 2, b.z - b.d / 2);
          expect(ox <= 0.001 || oz <= 0.001).toBe(true);
        }
      }
    }
  });
});
