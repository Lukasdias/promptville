import type { PlacedBlock } from "../../layout";
import { useApp } from "../../store";
import { COLORS } from "../../theme";

export function Ground({ blocks }: { blocks: PlacedBlock[] }) {
  const clearSelection = useApp((s) => s.clearSelection);
  const clear = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    clearSelection();
  };

  if (blocks.length === 0) return null;
  const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2)) + 6;
  const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2)) + 6;
  const minX = Math.min(...blocks.map((b) => b.x - b.width / 2)) - 6;
  const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2)) - 6;
  const sizeX = maxX - minX;
  const sizeZ = maxZ - minZ;
  const cx = (maxX + minX) / 2;
  const cz = (maxZ + minZ) / 2;

  return (
    <group>
      {/* City plaza (cream roads) under everything */}
      <mesh position={[cx, -0.05, cz]} receiveShadow onClick={clear}>
        <planeGeometry args={[sizeX, sizeZ]} />
        <meshStandardMaterial color={COLORS.road} />
      </mesh>

      {/* Grass pad per block */}
      {blocks.map((b) => (
        <mesh
          key={b.projectId}
          position={[b.x, -0.02, b.z]}
          receiveShadow
          onClick={clear}
        >
          <planeGeometry args={[b.width + 1, b.depth + 1]} />
          <meshStandardMaterial color={COLORS.grass} />
        </mesh>
      ))}

      {/* Center park */}
      <mesh position={[0, -0.02, 0]} receiveShadow onClick={clear}>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color={COLORS.grassDark} />
      </mesh>
    </group>
  );
}