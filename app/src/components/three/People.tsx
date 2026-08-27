import { useMemo } from "react";
import { useCity } from "../../city";
import { PROJECT_PALETTE } from "../../theme";
import { useApp } from "../../store";
import { personVoxels, placeVoxels, type Voxel } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";

const PERSON_SIZE = 0.15;

export function People() {
  const { blocks } = useCity();
  const showPeople = useApp((s) => s.tweaks.showPeople);

  const voxels = useMemo(() => {
    const out: Voxel[] = [];
    blocks.forEach((block, bi) => {
      block.houses.forEach((slot, i) => {
        const shirt = PROJECT_PALETTE[(bi * 5 + i * 3) % PROJECT_PALETTE.length];
        const side = i % 2 === 0 ? -1 : 1;
        const bx = slot.x + side * 0.85;
        const bz = slot.z;
        for (const v of placeVoxels(personVoxels(shirt), bx, bz, PERSON_SIZE)) out.push(v);
      });
    });
    return out;
  }, [blocks]);

  if (voxels.length === 0 || !showPeople) return null;
  return <InstancedVoxels voxels={voxels} voxelSize={PERSON_SIZE} />;
}