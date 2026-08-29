import { useMemo } from "react";
import { useCity } from "../../city";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";
import { PROJECT_PALETTE } from "../../theme";
import { activeCitizen } from "../../layered";
import { personVoxels, placeVoxels, type Voxel } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";

const PERSON_SIZE = 0.15;

export function People() {
  const { blocks } = useCity();
  const { data } = useNeighborhood();
  const selected = useApp((s) => s.selected);
  const showPeople = useApp((s) => s.tweaks.showPeople);

  const voxels = useMemo(() => {
    if (!data) return [];
    const out: Voxel[] = [];
    const now = Date.now();
    blocks.forEach((block, bi) => {
      if (block.kind === "plaza") return;
      const project = data.projects.find((p) => p.id === block.projectId);
      if (!project) return;
      block.houses.forEach((slot, i) => {
        const session = project.sessions[slot.index];
        if (!session) return;
        const isActive = activeCitizen(session.timeUpdated, now);
        const isSelected = selected?.id === session.id;
        if (!isActive && !isSelected) return;
        const shirt =
          isSelected ? "#ffd24a"
          : PROJECT_PALETTE[(bi * 5 + i * 3) % PROJECT_PALETTE.length];
        const side = i % 2 === 0 ? -1 : 1;
        const bx = slot.x + side * 0.85;
        const bz = slot.z;
        for (const v of placeVoxels(personVoxels(shirt), bx, bz, PERSON_SIZE)) out.push(v);
      });
    });
    return out;
  }, [blocks, data, selected]);

  if (voxels.length === 0 || !showPeople) return null;
  return <InstancedVoxels voxels={voxels} voxelSize={PERSON_SIZE} />;
}