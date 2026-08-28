import type { PlacedBlock } from "../../layout";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";
import { pickParkSpot, PARK_RADIUS } from "../../placement";
import { grassLotMaterial, parkMaterial, plazaMaterial } from "../../textures";

export function Ground({ blocks }: { blocks: PlacedBlock[] }) {
  const clearSelection = useApp((s) => s.clearSelection);
  const clear = (e: { stopPropagation: () => void }) => {
    if (isPanActive()) return;
    e.stopPropagation();
    clearSelection();
  };

  if (blocks.length === 0) return null;
  const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2)) + 8;
  const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2)) + 8;
  const minX = Math.min(...blocks.map((b) => b.x - b.width / 2)) - 8;
  const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2)) - 8;
  const park = pickParkSpot(blocks, minX, maxX, minZ, maxZ);

  return (
    <group>
      {/* Grass lot under each block; the plaza cell renders as a cream pad with a water center */}
      {blocks.map((b) => {
        if (b.kind === "plaza") {
          return (
            <group key={b.projectId}>
              <mesh position={[b.x, 0.06, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear} material={plazaMaterial}>
                <planeGeometry args={[b.width + 0.4, b.depth + 0.4]} />
              </mesh>
              <mesh position={[b.x, 0.065, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear}>
                <circleGeometry args={[3, 24]} />
                <meshStandardMaterial color="#7fc9ff" />
              </mesh>
            </group>
          );
        }
        return (
          <mesh
            key={b.projectId}
            position={[b.x, 0.06, b.z]}
            rotation-x={-Math.PI / 2}
            receiveShadow
            onClick={clear}
            material={grassLotMaterial}
          >
            <planeGeometry args={[b.width + 0.4, b.depth + 0.4]} />
          </mesh>
        );
      })}

      {/* Park in a free corner */}
      {park && (
        <mesh position={[park.x, 0.06, park.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear} material={parkMaterial}>
          <circleGeometry args={[PARK_RADIUS, 24]} />
        </mesh>
      )}
    </group>
  );
}
