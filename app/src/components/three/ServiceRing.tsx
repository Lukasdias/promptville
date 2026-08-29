import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import { useCity } from "../../city";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";
import { landmarkHeight } from "../../layered";
import { landmarkVoxels } from "../../voxel";
import { MODEL_ROOF, UNKNOWN_ROOF } from "../../theme";
import { GLOW_MAX } from "../../theme";
import { nightRef } from "../../night";
import { InstancedVoxels } from "./InstancedVoxels";
import { isPanActive } from "../../pan";

const SIZE = 0.12;

export function ServiceRing() {
  const { blocks } = useCity();
  const { data } = useNeighborhood();
  const showSignals = useApp((s) => s.tweaks.showSignals);
  const select = useApp((s) => s.select);

  const landmarkMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#d8d4c8",
        emissive: "#ffd98a",
        emissiveIntensity: 0,
        flatShading: true,
      }),
    [],
  );
  useFrame(() => {
    landmarkMaterial.emissiveIntensity = nightRef.current * GLOW_MAX;
  });

  const lots = useMemo(() => {
    if (!data) return [];
    const out: {
      id: string;
      x: number;
      z: number;
      voxels: ReturnType<typeof landmarkVoxels>;
    }[] = [];
    for (const block of blocks) {
      if (block.kind === "plaza") continue;
      const project = data.projects.find((p) => p.id === block.projectId);
      if (!project) continue;

      const model = project.sessions[0]?.model ?? null;
      const body = model ? MODEL_ROOF[model] ?? UNKNOWN_ROOF : UNKNOWN_ROOF;
      const h = landmarkHeight(project.totalCost);
      const voxels = landmarkVoxels(h, body, body).map((v) => ({
        ...v,
        x: v.x + block.x,
        z: v.z + block.z,
      }));
      out.push({ id: block.projectId, x: block.x, z: block.z, voxels });
    }
    return out;
  }, [blocks, data]);

  if (!showSignals || lots.length === 0) return null;

  return (
    <group>
      {lots.map((lot) => (
        <InstancedVoxels
          key={lot.id}
          voxels={lot.voxels}
          voxelSize={SIZE}
          material={landmarkMaterial}
          onClick={(e) => {
            if (isPanActive()) return;
            e.stopPropagation();
            const project = data?.projects.find((p) => p.id === lot.id);
            if (project?.sessions[0]) select(project.sessions[0]);
          }}
        />
      ))}
    </group>
  );
}
