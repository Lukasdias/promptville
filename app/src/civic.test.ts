import { describe, expect, test } from "bun:test";
import {
  buildPerimeterRing,
  buildStreets,
  cityBounds,
  CIVIC_PLAZA,
  extendRoadsToRing,
  layoutCity,
} from "./layout";
import { findIntersections } from "./traffic";
import { buildRoadGraph, attachCurbs } from "./roadgraph";
import {
  BUILDING_LAYOUT,
  BUILDING_META,
  BUILDING_SIZE,
  layoutCivicDistrict,
} from "./civic";
import type { BuildingLot } from "./civic";

const sessions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, tokensIn: 10, tokensOut: 5, timeCreated: i }));

const projects = Array.from({ length: 9 }, (_, i) => ({
  id: `p${i}`,
  name: `P${i}`,
  sessions: sessions(8),
}));

function makeCivic() {
  const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
  const plazaBlock = blocks.find((b) => b.kind === "plaza")!;
  const mainStreets = buildStreets(blocks);
  const bounds = cityBounds(blocks)!;
  const ring = buildPerimeterRing(bounds);
  const graphStreets = [...extendRoadsToRing(mainStreets, bounds), ...ring];
  const graph = buildRoadGraph(graphStreets, findIntersections(graphStreets));
  const civic = layoutCivicDistrict(plazaBlock, graphStreets, graph);
  return { blocks, plazaBlock, civic, graph, graphStreets };
}

function halfExtent(lot: BuildingLot): number {
  return (lot.footprint * BUILDING_SIZE) / 2;
}

describe("layoutCivicDistrict", () => {
  const { plazaBlock, civic, graphStreets } = makeCivic();

  test("places exactly one lot per building kind", () => {
    const kinds = civic.lots.map((l) => l.kind).sort();
    expect(kinds).toEqual(["bakery", "fire", "hospital", "mall", "petshop", "police"]);
  });

  test("every lot sits inside the plaza pad", () => {
    for (const lot of civic.lots) {
      const h = halfExtent(lot);
      expect(Math.abs(lot.x - plazaBlock.x) + h).toBeLessThanOrEqual(plazaBlock.width / 2 + 0.01);
      expect(Math.abs(lot.z - plazaBlock.z) + h).toBeLessThanOrEqual(plazaBlock.depth / 2 + 0.01);
    }
  });

  test("lots do not overlap", () => {
    for (let i = 0; i < civic.lots.length; i++) {
      for (let j = i + 1; j < civic.lots.length; j++) {
        const a = civic.lots[i]!;
        const b = civic.lots[j]!;
        const overlap =
          Math.abs(a.x - b.x) < halfExtent(a) + halfExtent(b) &&
          Math.abs(a.z - b.z) < halfExtent(a) + halfExtent(b);
        expect(overlap).toBe(false);
      }
    }
  });

  test("lot fronts face the plaza center", () => {
    const frontDir = (r: number): { x: number; z: number } =>
      r === 0 ? { x: 0, z: 1 } : r === 1 ? { x: 1, z: 0 } : r === 2 ? { x: 0, z: -1 } : { x: -1, z: 0 };
    for (const lot of civic.lots) {
      const f = frontDir(lot.rotation);
      const toPlaza = { x: plazaBlock.x - lot.x, z: plazaBlock.z - lot.z };
      expect(f.x * toPlaza.x + f.z * toPlaza.z).toBeGreaterThan(0);
    }
  });

  test("curbs lie on a street within city bounds", () => {
    for (const lot of civic.lots) {
      const onStreet = graphStreets.some(
        (s) =>
          Math.abs(lot.curb.x - s.x) <= s.width / 2 + 0.01 &&
          Math.abs(lot.curb.z - s.z) <= s.depth / 2 + 0.01,
      );
      expect(onStreet).toBe(true);
    }
  });

  test("visitor paths start on a sidewalk lane and end at the entrance", () => {
    for (let i = 0; i < civic.visitorPaths.length; i++) {
      const p = civic.visitorPaths[i]!;
      const lot = civic.lots[i]!;
      expect(p.waypoints.length).toBe(2);
      const b = p.waypoints[0]!;
      const c = p.waypoints[1]!;
      expect(Math.hypot(c.x - lot.entrance.x, c.z - lot.entrance.z)).toBeCloseTo(0);
      const nearStreet = graphStreets.some((s) => {
        const horizontal = s.width >= s.depth;
        if (horizontal) {
          return Math.abs(b.x - s.x) <= s.width / 2 + 0.01 && Math.abs(b.z - s.z) <= s.depth / 2 + 0.6;
        }
        return Math.abs(b.z - s.z) <= s.depth / 2 + 0.01 && Math.abs(b.x - s.x) <= s.width / 2 + 0.6;
      });
      expect(nearStreet).toBe(true);
    }
  });

  test("metadata covers every kind", () => {
    for (const kind of civic.lots.map((l) => l.kind)) {
      expect(BUILDING_META[kind].name.length).toBeGreaterThan(0);
      expect(BUILDING_META[kind].emoji).toBeTruthy();
      expect(BUILDING_LAYOUT[kind].walls).toBeGreaterThan(1);
    }
  });
});

describe("attachCurbs", () => {
  test("adds a curb node with a spur edge per point", () => {
    const { graph, civic, graphStreets } = makeCivic();
    const points = civic.lots.map((l) => ({ buildingId: l.kind, x: l.curb.x, z: l.curb.z }));
    const { graph: g2, curbs } = attachCurbs(graph, points);

    expect(g2.nodes.length).toBe(graph.nodes.length + points.length);
    expect(curbs.map((c) => c.buildingId).sort()).toEqual(
      ["bakery", "fire", "hospital", "mall", "petshop", "police"],
    );
    for (const c of curbs) {
      const node = g2.nodes[c.nodeId];
      expect(node).toBeDefined();
      const p = points.find((pt) => pt.buildingId === c.buildingId)!;
      expect(Math.hypot(node!.x - p.x, node!.z - p.z)).toBeLessThan(0.001);
      expect(g2.adjacency[c.nodeId].length).toBeGreaterThan(0);
    }
    expect(graphStreets.length).toBeGreaterThan(0);
  });

  test("every curb is reachable from a road node", () => {
    const { graph, civic } = makeCivic();
    const { graph: g2, curbs } = attachCurbs(
      graph,
      civic.lots.map((l) => ({ buildingId: l.kind, x: l.curb.x, z: l.curb.z })),
    );
    for (const c of curbs) {
      const reachable = g2.adjacency.some((row) => row.some((eid) => g2.edges[eid].to === c.nodeId));
      expect(reachable).toBe(true);
    }
  });
});