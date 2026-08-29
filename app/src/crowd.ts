import type { PlacedBlock, Street } from "./layout";
import { PROJECT_PALETTE } from "./theme";
import { mulberry32 } from "./rand";
import { crowd } from "./config";

export interface CrowdMember { x: number; z: number; shirt: string }
export interface CrowdCluster { anchor: { x: number; z: number }; heading: number; members: CrowdMember[]; talking: boolean }
export interface CrowdLayout { clusters: CrowdCluster[] }

// Deterministic gather spots: plaza edges, the park circle, and a couple of
// main-avenue corners. Never in a road or a building lot.
function anchors(blocks: PlacedBlock[], streets: Street[]): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const plaza = blocks.find((b) => b.kind === "plaza");
  if (plaza) {
    const hw = plaza.width / 2;
    const hd = plaza.depth / 2;
    out.push({ x: plaza.x, z: plaza.z - hd - 1.2 });
    out.push({ x: plaza.x + hw + 1.2, z: plaza.z });
  }
  // Main avenue corners (streets with the largest length on their axis).
  const sorted = [...streets].sort((a, b) => Math.max(b.width, b.depth) - Math.max(a.width, a.depth));
  for (const s of sorted.slice(0, 4)) {
    const horizontal = s.width >= s.depth;
    // stand just off the road edge, on the sidewalk/grass side
    const off = (horizontal ? s.depth : s.width) / 2 + 1.0;
    out.push(horizontal
      ? { x: s.x - s.width / 4, z: s.z + off }
      : { x: s.x + off, z: s.z - s.depth / 4 });
  }
  return out;
}

function clearOfEverything(x: number, z: number, blocks: PlacedBlock[], streets: Street[]): boolean {
  // The plaza is a walkable gather spot; other block lots and the road surface
  // are off-limits, with a small pad so members never hug a wall or road edge.
  const plaza = blocks.find((b) => b.kind === "plaza");
  const inPlaza = plaza
    ? x > plaza.x - plaza.width / 2 && x < plaza.x + plaza.width / 2 && z > plaza.z - plaza.depth / 2 && z < plaza.z + plaza.depth / 2
    : false;
  const inLot = blocks.some((b) =>
    b.kind !== "plaza" &&
    x > b.x - b.width / 2 - 0.15 && x < b.x + b.width / 2 + 0.15 &&
    z > b.z - b.depth / 2 - 0.15 && z < b.z + b.depth / 2 + 0.15);
  if (inLot) return false;
  const onRoad = streets.some((s) =>
    x > s.x - s.width / 2 - 0.15 && x < s.x + s.width / 2 + 0.15 &&
    z > s.z - s.depth / 2 - 0.15 && z < s.z + s.depth / 2 + 0.15);
  return inPlaza || !onRoad;
}

export function crowdLayout(blocks: PlacedBlock[], streets: Street[], seed = crowd.seed): CrowdLayout {
  const rand = mulberry32(seed);
  const candid = anchors(blocks, streets).filter((a) => clearOfEverything(a.x, a.z, blocks, streets));
  const clusters: CrowdCluster[] = [];
  // talking flags assigned to a deterministic subset, capped.
  const talkingSet = new Set<number>();
  for (let i = 0; i < Math.min(crowd.talkingCount, candid.length); i++) talkingSet.add(i);

  for (const anchor of candid.slice(0, crowd.clusters)) {
    const talking = talkingSet.has(clusters.length);
    const members: CrowdMember[] = [];
    const n = crowd.membersPerCluster;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rand() * 0.3;
      const r = crowd.clusterRadius * (0.55 + rand() * 0.4);
      const x = anchor.x + Math.cos(ang) * r;
      const z = anchor.z + Math.sin(ang) * r;
      if (!clearOfEverything(x, z, blocks, streets)) continue;
      if (members.length >= 6) break;
      members.push({ x, z, shirt: PROJECT_PALETTE[(i + clusters.length * 3) % PROJECT_PALETTE.length] });
    }
    if (members.length === 0) continue;
    clusters.push({ anchor, heading: Math.PI / 2, members, talking });
  }

  return { clusters };
}
