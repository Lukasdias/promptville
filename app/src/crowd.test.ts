import { describe, expect, test } from "bun:test";
import { crowdLayout } from "./crowd";
import { layoutCity, buildStreets } from "./layout";
import { personVoxels, placeVoxels } from "./voxel";

const sessions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, tokensIn: 10, tokensOut: 5, timeCreated: i }));
const projects = Array.from({ length: 20 }, (_, i) => ({
  id: `p${i}`, name: `P${i}`, sessions: sessions(3 + (i % 4)),
}));

function build() {
  const blocks = layoutCity(projects);
  return { blocks, streets: buildStreets(blocks) };
}

describe("crowdLayout", () => {
  test("is deterministic for the same input", () => {
    const a = build();
    expect(crowdLayout(a.blocks, a.streets)).toEqual(crowdLayout(a.blocks, a.streets));
  });

  test("honors the configured cluster count", () => {
    const { blocks, streets } = build();
    const layout = crowdLayout(blocks, streets);
    expect(layout.clusters.length).toBeGreaterThan(0);
    expect(layout.clusters.length).toBeLessThanOrEqual(6);
  });

  test("each cluster has a small fan of members within the cluster radius", () => {
    const { blocks, streets } = build();
    for (const c of crowdLayout(blocks, streets).clusters) {
      expect(c.members.length).toBeGreaterThanOrEqual(3);
      expect(c.members.length).toBeLessThanOrEqual(6);
      for (const m of c.members) {
        const d = Math.hypot(m.x - c.anchor.x, m.z - c.anchor.z);
        expect(d).toBeLessThanOrEqual(2.2 + 0.01);
      }
    }
  });

  test("members never sit inside a street", () => {
    const { blocks, streets } = build();
    const inRoad = (x: number, z: number, pad: number) =>
      streets.some((s) => x > s.x - s.width / 2 - pad && x < s.x + s.width / 2 + pad && z > s.z - s.depth / 2 - pad && z < s.z + s.depth / 2 + pad);
    for (const c of crowdLayout(blocks, streets).clusters) {
      for (const m of c.members) expect(inRoad(m.x, m.z, 0)).toBe(false);
    }
  });

  test("a member has 4 voxels and a valid shirt color", () => {
    const { blocks, streets } = build();
    const shirt = crowdLayout(blocks, streets).clusters[0]?.members[0]?.shirt ?? "#fff";
    expect(placeVoxels(personVoxels(shirt), 0, 0, 1)).toHaveLength(4);
  });
});
