import { useMemo } from "react";
import { createNoise3D } from "simplex-noise";
import type { PlacedBlock } from "../../layout";
import { InstancedVoxels } from "./InstancedVoxels";
import { MOUNTAIN_COLOR, SNOW_COLOR } from "../../voxel";

const NOISE_SCALE = 0.035;
const MAX_HEIGHT = 22;
export const MOUNTAIN_INNER_GAP = 14;
export const MOUNTAIN_BAND_WIDTH = 30;

export function mountainOuterRadius(blocks: PlacedBlock[]): number {
  if (blocks.length === 0) return 0;
  const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
  const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
  const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2));
  const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2));
  const cityR = Math.max(maxX - minX, maxZ - minZ) / 2;
  return cityR + MOUNTAIN_INNER_GAP + MOUNTAIN_BAND_WIDTH;
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

export function Mountains({ blocks }: { blocks: PlacedBlock[] }) {
  const voxels = useMemo(() => {
    if (blocks.length === 0) return [];
    const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
    const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
    const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2));
    const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2));
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const cityR = Math.max(maxX - minX, maxZ - minZ) / 2;
    const innerR = cityR + MOUNTAIN_INNER_GAP;
    const outerR = innerR + MOUNTAIN_BAND_WIDTH;

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