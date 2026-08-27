import { useMemo } from "react";
import { createNoise3D } from "simplex-noise";
import type { PlacedBlock } from "../../layout";
import { InstancedVoxels } from "./InstancedVoxels";
import { MOUNTAIN_COLOR, SNOW_COLOR } from "../../voxel";

const NOISE_SCALE = 0.035;
const MAX_HEIGHT = 22;
const INNER_GAP = 14;
const BAND_WIDTH = 30;
const SURFACE_LAYERS = 3;

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
    const innerR = cityR + INNER_GAP;
    const outerR = innerR + BAND_WIDTH;

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
        const ramp = Math.min(1, (d - innerR) / BAND_WIDTH);
        const raw = (fbm(x, z) + 1) / 2;
        const h = Math.round(raw * MAX_HEIGHT * (0.35 + 0.65 * ramp));
        if (h < SURFACE_LAYERS) continue;

        for (let layer = 0; layer < SURFACE_LAYERS; layer++) {
          const y = h - layer;
          if (y < 0) continue;
          const snow = layer === 0 && h >= 9;
          const color =
            snow ? SNOW_COLOR
            : layer === 0 ? MOUNTAIN_COLOR
            : "#6f7368";
          voxels.push({ x, y, z, color });
        }
      }
    }

    return voxels;
  }, [blocks]);

  if (voxels.length === 0) return null;
  return <InstancedVoxels voxels={voxels} />;
}