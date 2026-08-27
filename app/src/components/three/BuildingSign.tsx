import { Html } from "@react-three/drei";
import { BUILDING_LAYOUT, BUILDING_META, BUILDING_SIZE } from "../../civic";
import type { BuildingKind } from "../../types";

const SIGN_CSS = {
  background: "#fff6e5",
  border: "3px solid #4a4453",
  borderRadius: 12,
  boxShadow: "4px 4px 0 rgba(74, 68, 83, 0.35)",
  padding: "4px 10px",
  fontFamily: '"Nunito", sans-serif',
  fontWeight: 700,
  color: "#4a4453",
  whiteSpace: "nowrap" as const,
};

export function BuildingSign({ kind, x, z }: { kind: BuildingKind; x: number; z: number }) {
  const walls = BUILDING_LAYOUT[kind].walls;
  const y = walls * BUILDING_SIZE + 1.4;
  return (
    <Html position={[x, y, z]} center distanceFactor={16} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div style={SIGN_CSS}>
        {BUILDING_META[kind].emoji} {BUILDING_META[kind].name}
      </div>
    </Html>
  );
}