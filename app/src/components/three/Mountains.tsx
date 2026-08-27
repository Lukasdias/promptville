import { useMemo } from "react";
import type { PlacedBlock } from "../../layout";
import { mountainRingVoxels } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";

export function Mountains({ blocks }: { blocks: PlacedBlock[] }) {
  const voxels = useMemo(() => {
    if (blocks.length === 0) return [];
    const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
    const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
    const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2));
    const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2));
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const radius = Math.max(maxX - minX, maxZ - minZ) / 2 + 24;
    return mountainRingVoxels(cx, cz, radius, 7);
  }, [blocks]);

  if (voxels.length === 0) return null;
  return <InstancedVoxels voxels={voxels} />;
}