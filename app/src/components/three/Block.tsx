import type { PlacedBlock } from "../../layout";
import { useNeighborhood } from "../../query";
import { House } from "./House";

export function Block({ block, paletteIndex }: { block: PlacedBlock; paletteIndex: number }) {
  const { data } = useNeighborhood();
  const project = data?.projects.find((p) => p.id === block.projectId);
  if (!project) return null;

  return (
    <group position={[block.x, 0, block.z]}>
      {block.houses.map((slot) => {
        const session = project.sessions[slot.index];
        return (
          <House
            key={session.id}
            session={session}
            x={slot.x - block.x}
            z={slot.z - block.z}
            paletteIndex={paletteIndex}
          />
        );
      })}
    </group>
  );
}