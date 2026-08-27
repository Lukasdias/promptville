import type { Street } from "./layout";
import type { Intersection } from "./traffic";
import type { BuildingKind } from "./types";

export interface GraphNode {
  id: number;
  x: number;
  z: number;
  intersectionId: number | null;
}

export interface RoadEdge {
  id: number;
  from: number;
  to: number;
  length: number;
  axis: "x" | "z";
}

export interface RoadGraph {
  nodes: GraphNode[];
  edges: RoadEdge[];
  adjacency: number[][];
}

const EPS = 0.01;

function nodeKey(x: number, z: number): string {
  return `${Math.round(x * 100)}:${Math.round(z * 100)}`;
}

export function hasNode(graph: RoadGraph, x: number, z: number): boolean {
  return graph.nodes.some((n) => Math.abs(n.x - x) < EPS && Math.abs(n.z - z) < EPS);
}

// Builds a directed road graph from streets + intersections. Nodes are every
// junction (and road endpoint); directed edges run both ways along each street,
// so every node has ≥2 outgoing edges and continuous loops exist.
export function buildRoadGraph(streets: Street[], intersections: Intersection[]): RoadGraph {
  const nodeMap = new Map<string, GraphNode>();
  const nodes: GraphNode[] = [];

  const addNode = (x: number, z: number, intersectionId: number | null) => {
    const k = nodeKey(x, z);
    let node = nodeMap.get(k);
    if (!node) {
      node = { id: nodes.length, x, z, intersectionId: null };
      nodeMap.set(k, node);
      nodes.push(node);
    }
    if (intersectionId !== null) node.intersectionId = intersectionId;
  };

  for (const it of intersections) addNode(it.x, it.z, it.id);
  // Road endpoints become nodes too; after ring/extension they coincide with
  // junctions, but merged intersections may leave some ends without one.
  for (const s of streets) {
    if (s.width >= s.depth) {
      addNode(s.x - s.width / 2, s.z, null);
      addNode(s.x + s.width / 2, s.z, null);
    } else {
      addNode(s.x, s.z - s.depth / 2, null);
      addNode(s.x, s.z + s.depth / 2, null);
    }
  }

  const edges: RoadEdge[] = [];
  const adjacency: number[][] = nodes.map(() => []);

  const addEdge = (a: GraphNode, b: GraphNode, axis: "x" | "z") => {
    const length = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    if (length < EPS) return;
    const id = edges.length;
    edges.push({ id, from: a.id, to: b.id, length, axis });
    adjacency[a.id].push(id);
  };

  for (const s of streets) {
    const axis: "x" | "z" = s.width >= s.depth ? "x" : "z";
    const onAxis: GraphNode[] = [];
    for (const n of nodes) {
      if (axis === "x") {
        if (Math.abs(n.z - s.z) < EPS && n.x >= s.x - s.width / 2 - EPS && n.x <= s.x + s.width / 2 + EPS) {
          onAxis.push(n);
        }
      } else {
        if (Math.abs(n.x - s.x) < EPS && n.z >= s.z - s.depth / 2 - EPS && n.z <= s.z + s.depth / 2 + EPS) {
          onAxis.push(n);
        }
      }
    }
    onAxis.sort((a, b) => (axis === "x" ? a.x - b.x : a.z - b.z));
    for (let i = 0; i < onAxis.length - 1; i++) {
      addEdge(onAxis[i], onAxis[i + 1], axis);
      addEdge(onAxis[i + 1], onAxis[i], axis);
    }
  }

  return { nodes, edges, adjacency };
}

// Shortest path (by road length) from start node to goal node, following directed
// edges. Returns a list of node ids; [start] if no route exists.
export function planRoute(graph: RoadGraph, start: number, goal: number): number[] {
  if (start === goal) return [start];
  const n = graph.nodes.length;
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const visited = new Array<boolean>(n).fill(false);
  dist[start] = 0;

  for (let i = 0; i < n; i++) {
    let u = -1;
    for (let k = 0; k < n; k++) {
      if (!visited[k] && (u === -1 || dist[k] < dist[u])) u = k;
    }
    if (u === -1 || dist[u] === Infinity) break;
    visited[u] = true;
    for (const eid of graph.adjacency[u]) {
      const e = graph.edges[eid];
      const nd = dist[u] + e.length;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        prev[e.to] = u;
      }
    }
  }

  if (dist[goal] === Infinity) return [start];
  const path = [goal];
  let cur = goal;
  while (cur !== start) {
    cur = prev[cur];
    path.unshift(cur);
  }
  return path;
}

export interface Curb {
  buildingId: BuildingKind;
  nodeId: number;
  x: number;
  z: number;
}

// Adds one destination node per point with a bidirectional spur edge to the
// nearest existing road node, so cars can route to the building's curb.
export function attachCurbs(
  graph: RoadGraph,
  points: { buildingId: BuildingKind; x: number; z: number }[],
): { graph: RoadGraph; curbs: Curb[] } {
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const adjacency = graph.adjacency.map((row) => [...row]);
  const curbs: Curb[] = [];

  for (const p of points) {
    let nearest = -1;
    let best = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = (nodes[i].x - p.x) ** 2 + (nodes[i].z - p.z) ** 2;
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    const len = Math.sqrt(best);
    if (len < 0.01) {
      curbs.push({ buildingId: p.buildingId, nodeId: nearest, x: p.x, z: p.z });
      continue;
    }
    const id = nodes.length;
    nodes.push({ id, x: p.x, z: p.z, intersectionId: null });
    adjacency.push([]);
    const axis: "x" | "z" = Math.abs(nodes[nearest].x - p.x) >= Math.abs(nodes[nearest].z - p.z) ? "x" : "z";
    const eidA = edges.length;
    edges.push({ id: eidA, from: nearest, to: id, length: len, axis });
    adjacency[nearest].push(eidA);
    const eidB = edges.length;
    edges.push({ id: eidB, from: id, to: nearest, length: len, axis });
    adjacency[id].push(eidB);
    curbs.push({ buildingId: p.buildingId, nodeId: id, x: p.x, z: p.z });
  }

  return { graph: { nodes, edges, adjacency }, curbs };
}