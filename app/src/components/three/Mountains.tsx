import { useMemo } from "react";
import type { PlacedBlock } from "../../layout";
import { mountainVoxels } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MountainSpec {
  x: number;
  z: number;
  h: number;
  s: number;
  rot: number;
}

export function Mountains({ blocks }: { blocks: PlacedBlock[] }) {
  const ring = useMemo(() => {
    if (blocks.length === 0) return [];
    const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
    const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
    const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2));
    const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2));
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const radius = Math.max(maxX - minX, maxZ - minZ) / 2 + 26;
    const rand = mulberry32(99);
    return Array.from({ length: 22 }, (_, i): MountainSpec => {
      const a = (i / 22) * Math.PI * 2 + rand() * 0.18;
      const rr = radius + rand() * 9;
      return {
        x: cx + Math.cos(a) * rr,
        z: cz + Math.sin(a) * rr,
        h: Math.round(9 + rand() * 16),
        s: 0.8 + rand() * 0.9,
        rot: rand() * Math.PI * 2,
      };
    });
  }, [blocks]);

  if (ring.length === 0) return null;

  return (
    <group>
      {ring.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]} rotation={[0, m.rot, 0]} scale={m.s}>
          <InstancedVoxels voxels={mountainVoxels(m.h)} />
        </group>
      ))}
    </group>
  );
}