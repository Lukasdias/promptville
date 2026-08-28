import { useMemo } from "react";
import type { PlacedBlock } from "../../layout";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";
import { pickParkSpot, PARK_RADIUS } from "../../placement";
import { grassLotMaterialFor, parkMaterialFor, plazaMaterialFor } from "../../textures";

const SURFACE_Y = 0.01;
const PLAZA_PAD = 0.4;
const PLAZA_WATER_RADIUS = 3;
const PLAZA_WATER_LIFT = 0.005;

export function Ground({ blocks }: { blocks: PlacedBlock[] }) {
  const clearSelection = useApp((s) => s.clearSelection);
  const clear = (e: { stopPropagation: () => void }) => {
    if (isPanActive()) return;
    e.stopPropagation();
    clearSelection();
  };

  const park = useMemo(() => {
    if (blocks.length === 0) return null;
    const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2)) + 8;
    const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2)) + 8;
    const minX = Math.min(...blocks.map((b) => b.x - b.width / 2)) - 8;
    const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2)) - 8;
    return pickParkSpot(blocks, minX, maxX, minZ, maxZ);
  }, [blocks]);

  if (blocks.length === 0) return null;

  return (
    <group>
      {blocks.map((b) => {
        if (b.kind === "plaza") {
          const mat = plazaMaterialFor(b.width + PLAZA_PAD, b.depth + PLAZA_PAD);
          return (
            <group key={b.projectId}>
              <mesh position={[b.x, SURFACE_Y, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear} material={mat}>
                <planeGeometry args={[b.width + PLAZA_PAD, b.depth + PLAZA_PAD]} />
              </mesh>
              <mesh position={[b.x, SURFACE_Y + PLAZA_WATER_LIFT, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear}>
                <circleGeometry args={[PLAZA_WATER_RADIUS, 24]} />
                <meshStandardMaterial color="#7fc9ff" />
              </mesh>
            </group>
          );
        }
        return (
          <mesh
            key={b.projectId}
            position={[b.x, SURFACE_Y, b.z]}
            rotation-x={-Math.PI / 2}
            receiveShadow
            onClick={clear}
            material={grassLotMaterialFor(b.width, b.depth)}
          >
            <planeGeometry args={[b.width, b.depth]} />
          </mesh>
        );
      })}

      {park && (
        <mesh position={[park.x, SURFACE_Y, park.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear} material={parkMaterialFor(PARK_RADIUS * 2)}>
          <circleGeometry args={[PARK_RADIUS, 24]} />
        </mesh>
      )}
    </group>
  );
}
