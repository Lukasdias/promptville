import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import { useNeighborhood } from "../../query";
import { useCity } from "../../city";
import { houseParams, houseWindowCells } from "../../house";
import { WINDOW_COLOR, type Voxel } from "../../voxel";
import { WINDOW_GLOW, GLOW_MAX } from "../../theme";
import { InstancedVoxels } from "./InstancedVoxels";
import { nightRef } from "../../night";

export function LitWindows() {
  const { data } = useNeighborhood();
  const { blocks } = useCity();
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: WINDOW_COLOR,
        emissive: WINDOW_GLOW,
        emissiveIntensity: 0,
        flatShading: true,
      }),
    [],
  );

  const voxels = useMemo<Voxel[]>(() => {
    const out: Voxel[] = [];
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b];
      if (block.kind === "plaza") continue;
      const project = data?.projects.find((p) => p.id === block.projectId);
      if (!project) continue;
      block.houses.forEach((slot) => {
        const session = project.sessions[slot.index];
        if (!session) return;
        const hp = houseParams(session, b);
        for (const w of houseWindowCells(hp, slot.x, slot.z)) out.push(w);
      });
    }
    return out;
  }, [blocks, data]);

  useFrame(() => {
    material.emissiveIntensity = nightRef.current * GLOW_MAX;
  });

  if (voxels.length === 0) return null;
  return <InstancedVoxels voxels={voxels} material={material} />;
}
