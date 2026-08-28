import { useMemo } from "react";
import { MeshStandardMaterial } from "three";
import type { Street } from "../../layout";
import type { Intersection } from "../../traffic";
import { streetSidewalkVoxels, SIDEWALK_SIZE } from "../../voxel";
import { buildCrosswalks } from "../../crosswalk";
import { CROSSWALK_BRICK } from "../../theme";
import { InstancedVoxels } from "./InstancedVoxels";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";

const CROSSWALK_MATERIAL = new MeshStandardMaterial({ color: CROSSWALK_BRICK, roughness: 1 });

export function Sidewalks({
  streets,
  intersections,
}: {
  streets: Street[];
  intersections: Intersection[];
}) {
  const clearSelection = useApp((s) => s.clearSelection);
  const voxels = useMemo(() => streetSidewalkVoxels(streets), [streets]);
  const crosswalks = useMemo(
    () => buildCrosswalks(intersections, streets),
    [intersections, streets],
  );

  const clear = (e: { stopPropagation: () => void }) => {
    if (isPanActive()) return;
    e.stopPropagation();
    clearSelection();
  };

  return (
    <group>
      <InstancedVoxels voxels={voxels} voxelSize={SIDEWALK_SIZE} onClick={clear} />
      {crosswalks.map((c, i) => (
        <mesh
          key={`cs${i}`}
          position={[c.x, 0.075, c.z]}
          rotation-x={-Math.PI / 2}
          material={CROSSWALK_MATERIAL}
          onClick={clear}
        >
          <planeGeometry args={[c.w, c.d]} />
        </mesh>
      ))}
    </group>
  );
}
