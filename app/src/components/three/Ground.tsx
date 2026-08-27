import type { PlacedBlock, Street } from "../../layout";
import { useApp } from "../../store";
import { COLORS } from "../../theme";

function pickParkSpot(
  blocks: PlacedBlock[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): { x: number; z: number } | null {
  const r = 7;
  const candidates = [
    { x: minX + 15, z: minZ + 15 },
    { x: maxX - 15, z: minZ + 15 },
    { x: minX + 15, z: maxZ - 15 },
    { x: maxX - 15, z: maxZ - 15 },
  ];
  for (const c of candidates) {
    const overlaps = blocks.some(
      (b) =>
        c.x + r > b.x - b.width / 2 &&
        c.x - r < b.x + b.width / 2 &&
        c.z + r > b.z - b.depth / 2 &&
        c.z - r < b.z + b.depth / 2,
    );
    if (!overlaps) return c;
  }
  return null;
}

export function Ground({
  blocks,
  streets,
}: {
  blocks: PlacedBlock[];
  streets: Street[];
}) {
  const clearSelection = useApp((s) => s.clearSelection);
  const clear = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    clearSelection();
  };

  if (blocks.length === 0) return null;
  const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2)) + 8;
  const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2)) + 8;
  const minX = Math.min(...blocks.map((b) => b.x - b.width / 2)) - 8;
  const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2)) - 8;
  const sizeX = maxX - minX;
  const sizeZ = maxZ - minZ;
  const cx = (maxX + minX) / 2;
  const cz = (maxZ + minZ) / 2;
  const park = pickParkSpot(blocks, minX, maxX, minZ, maxZ);

  return (
    <group>
      {/* Grass base */}
      <mesh position={[cx, -0.05, cz]} rotation-x={-Math.PI / 2} onClick={clear}>
        <planeGeometry args={[sizeX, sizeZ]} />
        <meshStandardMaterial color={COLORS.grass} />
      </mesh>

      {/* Streets: connected graph filling the gaps between blocks */}
      {streets.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, -0.045, s.z]}
          rotation-x={-Math.PI / 2}
          receiveShadow
          onClick={clear}
        >
          <planeGeometry args={[s.width, s.depth]} />
          <meshStandardMaterial color={COLORS.road} />
        </mesh>
      ))}

      {/* Grass lot under each block */}
      {blocks.map((b) => (
        <mesh
          key={b.projectId}
          position={[b.x, -0.04, b.z]}
          rotation-x={-Math.PI / 2}
          receiveShadow
          onClick={clear}
        >
          <planeGeometry args={[b.width + 0.4, b.depth + 0.4]} />
          <meshStandardMaterial color={COLORS.grassLot} />
        </mesh>
      ))}

      {/* Park in a free corner */}
      {park && (
        <mesh position={[park.x, -0.04, park.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear}>
          <circleGeometry args={[7, 24]} />
          <meshStandardMaterial color={COLORS.grassDark} />
        </mesh>
      )}
    </group>
  );
}