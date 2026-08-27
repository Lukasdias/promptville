import type { Street } from "./layout";
import type { Intersection } from "./traffic";

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