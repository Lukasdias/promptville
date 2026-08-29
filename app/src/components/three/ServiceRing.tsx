import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import { useCity } from "../../city";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";
import { landmarkHeight, parkSize, workshopSpots, workshopColor } from "../../layered";
import { landmarkVoxels, parkVoxels, workshopVoxels } from "../../voxel";
import { placeVoxels } from "../../voxel";
import { GLOW_MAX } from "../../theme";
import { nightRef } from "../../night";
import { InstancedVoxels } from "./InstancedVoxels";
import { isPanActive } from "../../pan";

const SIZE = 0.4;

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
      landmark: ReturnType<typeof landmarkVoxels>;
      scenery: ReturnType<typeof landmarkVoxels>;
    }[] = [];
    for (const block of blocks) {
      if (block.kind === "plaza") continue;
      const project = data.projects.find((p) => p.id === block.projectId);
      if (!project) continue;

      const h = landmarkHeight(project.totalCost);
      const landmark = landmarkVoxels(h, "#d8d4c8", "#ffd98a").map((v) => ({
        ...v,
        x: v.x + block.x,
        z: v.z + block.z,
      }));
      const park = project.todoCount > 0 ? parkVoxels(parkSize(project.todoCount)) : [];
      const topTools = [...new Set(project.sessions.flatMap((s) => s.toolNames ?? []))].slice(0, 4);
      const workshops = workshopSpots(topTools, block);
      const scenery = [
        ...placeVoxels(park, block.x + 3, block.z - 3, SIZE),
        ...workshops.flatMap((w) =>
          placeVoxels(workshopVoxels(workshopColor(w.tool)), w.x, w.z, SIZE),
        ),
      ];

      out.push({ id: block.projectId, x: block.x, z: block.z, landmark, scenery });
    }
    return out;
  }, [blocks, data]);

  if (!showSignals || lots.length === 0) return null;

  return (
    <group>
      {lots.map((lot) => (
        <InstancedVoxels key={lot.id} voxels={lot.landmark} voxelSize={SIZE} material={landmarkMaterial} />
      ))}
      {lots.map((lot) => (
        <InstancedVoxels
          key={`scenery-${lot.id}`}
          voxels={lot.scenery}
          voxelSize={SIZE}
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
