import type { PlacedBlock, Street } from "../../layout";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";
import { COLORS } from "../../theme";
import { pickParkSpot } from "../../placement";

const DASH_PERIOD = 2.4;
const DASH_LENGTH = 1.1;

interface Dash {
  x: number;
  z: number;
  w: number;
  d: number;
}

function streetDashes(s: Street): Dash[] {
  const out: Dash[] = [];
  if (s.width >= s.depth) {
    const n = Math.floor(s.width / DASH_PERIOD);
    const d = Math.max(0.12, s.depth * 0.16);
    for (let i = 0; i < n; i++) {
      out.push({ x: s.x - s.width / 2 + (i + 0.5) * DASH_PERIOD, z: s.z, w: DASH_LENGTH, d });
    }
  } else {
    const n = Math.floor(s.depth / DASH_PERIOD);
    const w = Math.max(0.12, s.width * 0.16);
    for (let i = 0; i < n; i++) {
      out.push({ x: s.x, z: s.z - s.depth / 2 + (i + 0.5) * DASH_PERIOD, w, d: DASH_LENGTH });
    }
  }
  return out;
}

export function Ground({
  blocks,
  streets,
  extent,
}: {
  blocks: PlacedBlock[];
  streets: Street[];
  extent: number;
}) {
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
  const cx = (maxX + minX) / 2;
  const cz = (maxZ + minZ) / 2;
  const park = pickParkSpot(blocks, minX, maxX, minZ, maxZ);

  return (
    <group>
      {/* Grass base — extends past the mountain ring so no corner lacks ground */}
      <mesh position={[cx, -0.05, cz]} rotation-x={-Math.PI / 2} onClick={clear}>
        <planeGeometry args={[extent * 2, extent * 2]} />
        <meshStandardMaterial color={COLORS.grass} />
      </mesh>

      {/* Streets: dark asphalt with a white center stripe */}
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
      {streets.flatMap((s) => streetDashes(s)).map((dash, i) => (
        <mesh
          key={i}
          position={[dash.x, -0.042, dash.z]}
          rotation-x={-Math.PI / 2}
          onClick={clear}
        >
          <planeGeometry args={[dash.w, dash.d]} />
          <meshStandardMaterial color={COLORS.roadLine} />
        </mesh>
      ))}

      {/* Grass lot under each block; the plaza cell renders as a cream pad with a water center */}
      {blocks.map((b) => {
        if (b.kind === "plaza") {
          return (
            <group key={b.projectId}>
              <mesh position={[b.x, -0.039, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear}>
                <planeGeometry args={[b.width + 0.4, b.depth + 0.4]} />
                <meshStandardMaterial color="#f7efe0" />
              </mesh>
              <mesh position={[b.x, -0.038, b.z]} rotation-x={-Math.PI / 2} receiveShadow onClick={clear}>
                <circleGeometry args={[3, 24]} />
                <meshStandardMaterial color="#7fc9ff" />
              </mesh>
            </group>
          );
        }
        return (
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
        );
      })}

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