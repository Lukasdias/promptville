import { useMemo } from "react";
import { createNoise3D } from "simplex-noise";
import { ROAD_WIDTH, type PlacedBlock, type Street } from "../../layout";
import { InstancedVoxels } from "./InstancedVoxels";
import { MOUNTAIN_COLOR, SNOW_COLOR } from "../../voxel";

const NOISE_SCALE = 0.035;
const MAX_HEIGHT = 22;
// Clearance from the furthest street corner to the mountain's inner edge, so the
// terrain never buries a road.
const INNER_MARGIN = 4;
export const MOUNTAIN_BAND_WIDTH = 30;

interface MountainRing {
  cx: number;
  cz: number;
  innerR: number;
  outerR: number;
}

// The mountain band must start past every street (including ring corners), which
// sit on the city's diagonal. Computes the inner radius from the actual streets,
// or from the block-bounds diagonal when no street list is available.
export function mountainRing(blocks: PlacedBlock[], streets?: Street[]): MountainRing | null {
  if (blocks.length === 0) return null;
  const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
  const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
  const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2));
  const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2));
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const cityHalfX = (maxX - minX) / 2;
  const cityHalfZ = (maxZ - minZ) / 2;

  let maxStreetDist = 0;
  if (streets && streets.length > 0) {
    for (const s of streets) {
      if (s.width >= s.depth) {
        const d = Math.hypot(Math.max(Math.abs(s.x - cx) + s.width / 2, 0), Math.abs(s.z - cz));
        maxStreetDist = Math.max(maxStreetDist, d);
      } else {
        const d = Math.hypot(Math.abs(s.x - cx), Math.max(Math.abs(s.z - cz) + s.depth / 2, 0));
        maxStreetDist = Math.max(maxStreetDist, d);
      }
    }
  } else {
    // Fallback: block-bounds diagonal + the ring road width covers the corners.
    maxStreetDist = Math.hypot(cityHalfX + ROAD_WIDTH, cityHalfZ + ROAD_WIDTH);
  }

  const innerR = maxStreetDist + INNER_MARGIN;
  return { cx, cz, innerR, outerR: innerR + MOUNTAIN_BAND_WIDTH };
}

export function mountainOuterRadius(blocks: PlacedBlock[], streets?: Street[]): number {
  return mountainRing(blocks, streets)?.outerR ?? 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Mountains({ blocks, streets }: { blocks: PlacedBlock[]; streets: Street[] }) {
  const voxels = useMemo(() => {
    const ring = mountainRing(blocks, streets);
    if (!ring) return [];
    const { cx, cz, innerR, outerR } = ring;

    const noise = createNoise3D(mulberry32(4242));
    const fbm = (x: number, z: number): number => {
      let sum = 0;
      let amp = 1;
      let norm = 0;
      let freq = 1;
      for (let i = 0; i < 4; i++) {
        sum += noise(x * freq * NOISE_SCALE, 0, z * freq * NOISE_SCALE) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
      }
      return sum / norm; // ~[-1, 1]
    };

    const voxels: { x: number; y: number; z: number; color: string }[] = [];
    const start = Math.floor(cx - outerR);
    const end = Math.ceil(cx + outerR);

    for (let x = start; x <= end; x++) {
      for (let z = start; z <= end; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d <= innerR) continue;
        const ramp = Math.min(1, (d - innerR) / MOUNTAIN_BAND_WIDTH);
        const raw = (fbm(x, z) + 1) / 2;
        const h = Math.round(raw * MAX_HEIGHT * (0.35 + 0.65 * ramp));
        if (h < 1) continue;

        // Solid columns from the ground (y=0) up — no hollow crust, no floating base.
        for (let y = 0; y <= h; y++) {
          const snow = y >= h - 1 && h >= 9;
          const rock = y >= h - 3;
          const color =
            snow ? SNOW_COLOR
            : rock ? MOUNTAIN_COLOR
            : "#6f7368";
          voxels.push({ x, y, z, color });
        }
      }
    }

    return voxels;
  }, [blocks]);

  if (voxels.length === 0) return null;
  // Sink slightly into the ground so the base sits flush with the grass plane.
  return (
    <group position={[0, -0.1, 0]}>
      <InstancedVoxels voxels={voxels} />
    </group>
  );
}