import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import { useNeighborhood } from "../../query";
import { useCity } from "../../city";
import { houseScale } from "../../layout";
import { PROJECT_PALETTE, WINDOW_GLOW, GLOW_MAX } from "../../theme";
import { windowVoxels, type Voxel } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { nightRef } from "../../night";

const HOUSE_SIZE = 7;
const HOUSE_WALLS = 4;

export function LitWindows() {
  const { data } = useNeighborhood();
  const { blocks } = useCity();
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#ffffff",
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
      const body = PROJECT_PALETTE[b % PROJECT_PALETTE.length];
      block.houses.forEach((slot) => {
        const session = project.sessions[slot.index];
        if (!session) return;
        const scale = houseScale(session.tokensIn, session.tokensOut);
        for (const w of windowVoxels({
          body,
          roof: "#ffffff",
          width: HOUSE_SIZE,
          depth: HOUSE_SIZE,
          walls: Math.max(HOUSE_WALLS, Math.round(scale)),
        })) {
          out.push({ x: slot.x + w.x, y: w.y, z: slot.z + w.z, color: w.color });
        }
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
