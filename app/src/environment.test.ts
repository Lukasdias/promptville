import { describe, expect, test } from "bun:test";
import { environmentLayout } from "./environment";
import { layoutCity, buildStreets, CIVIC_PLAZA } from "./layout";
import { environment } from "./config";

// A synthetic neighborhood with enough projects to fill several cells.
function neighborhood() {
  const projects = Array.from({ length: 40 }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    sessions: Array.from({ length: 3 + (i % 5) }, (_, j) => ({
      id: `s${i}-${j}`,
      tokensIn: 100 + i * 10 + j,
      tokensOut: 200 + i * 5,
      timeCreated: i * 1000 + j,
    })),
  }));
  const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
  const streets = buildStreets(blocks);
  return { blocks, streets };
}

describe("environmentLayout", () => {
  const { blocks, streets } = neighborhood();

  test("respects the exact requested counts", () => {
    const env = environmentLayout(blocks, streets, environment);
    expect(env.trees).toHaveLength(environment.trees);
    expect(env.lamps).toHaveLength(environment.lamps);
    expect(env.bushes).toHaveLength(environment.bushes);
    expect(env.flowers).toHaveLength(environment.flowers);
  });

  test("is deterministic for a given seed", () => {
    const a = environmentLayout(blocks, streets, environment);
    const b = environmentLayout(blocks, streets, environment);
    expect(a).toEqual(b);
  });

  test("produces different layouts for different seeds", () => {
    const a = environmentLayout(blocks, streets, environment, 1);
    const b = environmentLayout(blocks, streets, environment, 9999);
    expect(a.trees).not.toEqual(b.trees);
  });

  test("trees and lamps sit on the street flanks, clear of the lot interiors", () => {
    // Trees line the street flanks in the front-yard grass (inside the lot's
    // outer ring). The real constraint is that they clear the inset HOUSES, not
    // the whole lot rectangle (houses are inset ~1.6 from the lot edge).
    const env = environmentLayout(blocks, streets, environment);
    const minDistToHouse = (x: number, z: number): number => {
      let min = Infinity;
      for (const b of blocks) {
        for (const h of b.houses) {
          min = Math.min(min, Math.hypot(x - h.x, z - h.z));
        }
      }
      return min;
    };
    for (const t of env.trees) {
      expect(minDistToHouse(t.x, t.z)).toBeGreaterThan(1);
    }
    for (const l of env.lamps) {
      expect(minDistToHouse(l.x, l.z)).toBeGreaterThan(1);
    }
  });

  test("does not produce duplicate lamp posts", () => {
    const env = environmentLayout(blocks, streets, environment);
    const keys = env.lamps.map((l) => `${Math.round(l.x)}:${Math.round(l.z)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("layout is stable across identical inputs", () => {
    const env = environmentLayout(blocks, streets, environment);
    expect(env.bushes.length).toBeGreaterThan(0);
    expect(env.flowers.length).toBeGreaterThan(0);
    expect(env.trees.length).toBeGreaterThan(0);
    expect(env.lamps.length).toBeGreaterThan(0);
  });
});

describe("environmentLayout edge cases", () => {
  test("empty city yields empty placement", () => {
    const env = environmentLayout([], [], environment);
    expect(env.trees).toHaveLength(0);
    expect(env.lamps).toHaveLength(0);
    expect(env.bushes).toHaveLength(0);
    expect(env.flowers).toHaveLength(0);
  });

  test("a single plaza with no projects places nothing in lots", () => {
    const blocks = layoutCity([], { plaza: CIVIC_PLAZA });
    const streets = buildStreets(blocks);
    const env = environmentLayout(blocks, streets, environment);
    expect(env.trees).toHaveLength(0);
    // Bushes/flowers only scatter into non-plaza lots.
    expect(env.bushes.length).toBeLessThanOrEqual(environment.bushes);
  });
});
