import { BUILDING_COLORS } from "../../theme";
import { BUILDING_LAYOUT, BUILDING_SIZE, type CivicDistrict as CivicData } from "../../civic";
import { placeVoxels, publicBuildingVoxels } from "../../voxel";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";
import { InstancedVoxels } from "./InstancedVoxels";
import { BuildingSign } from "./BuildingSign";

export function CivicDistrict({ civic }: { civic: CivicData | null }) {
  const selectBuilding = useApp((s) => s.selectBuilding);
  const selectedBuilding = useApp((s) => s.selectedBuilding);
  const showBuildings = useApp((s) => s.tweaks.showBuildings);
  if (!civic || !showBuildings) return null;

  return (
    <group>
      {civic.lots.map((lot) => {
        const layout = BUILDING_LAYOUT[lot.kind];
        const c = BUILDING_COLORS[lot.kind];
        const voxels = publicBuildingVoxels({
          kind: lot.kind,
          body: c.body,
          accent: c.accent,
          roof: c.roof,
          walls: layout.walls,
          width: layout.footprint,
          depth: layout.footprint,
        });
        const placed = placeVoxels(voxels, 0, 0, BUILDING_SIZE);
        const isSelected = selectedBuilding === lot.kind;
        return (
          <group
            key={lot.kind}
            position={[lot.x, 0, lot.z]}
            rotation-y={(lot.rotation * Math.PI) / 2}
            onClick={(e) => {
              if (isPanActive()) return;
              e.stopPropagation();
              selectBuilding(lot.kind);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
          >
            <InstancedVoxels voxels={placed} voxelSize={BUILDING_SIZE} />
            <BuildingSign kind={lot.kind} x={0} z={0} />
            {isSelected && (
              <mesh position={[0, layout.walls * BUILDING_SIZE + 0.35, 0]}>
                <boxGeometry args={[layout.footprint * BUILDING_SIZE + 0.4, 0.12, layout.footprint * BUILDING_SIZE + 0.4]} />
                <meshStandardMaterial color="#ffd24a" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}