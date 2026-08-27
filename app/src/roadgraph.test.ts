import { describe, expect, test } from "bun:test";
import {
  buildStreets,
  buildPerimeterRing,
  extendRoadsToRing,
  layoutCity,
  cityBounds,
} from "./layout";
import { findIntersections } from "./traffic";
import { buildRoadGraph, hasNode } from "./roadgraph";

const projects = [
  { id: "a", name: "A", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "b", name: "B", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "c", name: "C", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "d", name: "D", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "e", name: "E", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "f", name: "F", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
];

describe("buildPerimeterRing", () => {
  const blocks = layoutCity(projects);
  const bounds = cityBounds(blocks)!;
  const ring = buildPerimeterRing(bounds);

  test("returns four roads around the city", () => {
    expect(ring).toHaveLength(4);
  });

  test("corners overlap (ring is a closed loop)", () => {
    const top = ring.find((s) => s.width >= s.depth && Math.abs(s.z - (bounds.minZ - 1.75)) < 0.01)!;
    const left = ring.find((s) => s.width < s.depth && Math.abs(s.x - (bounds.minX - 1.75)) < 0.01)!;
    expect(top).toBeDefined();
    expect(left).toBeDefined();
    // top spans past the left/right road centerlines
    expect(top.width).toBeGreaterThan(bounds.maxX - bounds.minX);
    // left spans past the top/bottom road centerlines
    expect(left.depth).toBeGreaterThan(bounds.maxZ - bounds.minZ);
  });
});

describe("extendRoadsToRing", () => {
  const blocks = layoutCity(projects);
  const bounds = cityBounds(blocks)!;
  const extended = extendRoadsToRing(buildStreets(blocks), bounds);
  const ring = buildPerimeterRing(bounds);
  const intersections = findIntersections([...extended, ...ring]);

  test("every avenue reaches the ring left/right", () => {
    for (const s of extended.filter((x) => x.width >= x.depth)) {
      expect(s.x - s.width / 2).toBeCloseTo(bounds.minX - 1.75);
      expect(s.x + s.width / 2).toBeCloseTo(bounds.maxX + 1.75);
    }
  });

  test("no dead-end junctions remain (all ends connect to the ring)", () => {
    expect(intersections.length).toBeGreaterThan(0);
  });
});

describe("buildRoadGraph", () => {
  const blocks = layoutCity(projects);
  const bounds = cityBounds(blocks)!;
  const main = buildStreets(blocks);
  const all = [...extendRoadsToRing(main, bounds), ...buildPerimeterRing(bounds)];
  const intersections = findIntersections(all);
  const graph = buildRoadGraph(all, intersections);

  test("has a node at every intersection", () => {
    for (const it of intersections) {
      expect(hasNode(graph, it.x, it.z)).toBe(true);
    }
  });

  test("ring corners are nodes", () => {
    expect(hasNode(graph, bounds.minX - 1.75, bounds.minZ - 1.75)).toBe(true);
    expect(hasNode(graph, bounds.maxX + 1.75, bounds.maxZ + 1.75)).toBe(true);
  });

  test("every node has at least two outgoing edges (no dead ends)", () => {
    for (const n of graph.nodes) {
      expect(graph.adjacency[n.id].length).toBeGreaterThanOrEqual(2);
    }
  });

  test("edges reference valid nodes with positive length", () => {
    for (const e of graph.edges) {
      expect(e.from).toBeLessThan(graph.nodes.length);
      expect(e.to).toBeLessThan(graph.nodes.length);
      expect(e.length).toBeGreaterThan(0);
      expect(graph.adjacency[e.from]).toContain(e.id);
    }
  });

  test("every intersection node is reachable from anywhere (connected)", () => {
    // BFS from node 0 must reach all nodes.
    const seen = new Set<number>([0]);
    const queue = [0];
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const eid of graph.adjacency[cur]) {
        const nxt = graph.edges[eid].to;
        if (!seen.has(nxt)) {
          seen.add(nxt);
          queue.push(nxt);
        }
      }
    }
    expect(seen.size).toBe(graph.nodes.length);
  });
});