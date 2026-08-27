import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { houseScale } from "../../layout";
import { MODEL_ROOF, PROJECT_PALETTE, UNKNOWN_ROOF } from "../../theme";
import { houseVoxels } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { useApp } from "../../store";
import type { SessionData } from "../../types";

const FOOTPRINT = 7; // house footprint in voxels

export function House({
  session,
  x,
  z,
  paletteIndex,
}: {
  session: SessionData;
  x: number;
  z: number;
  paletteIndex: number;
}) {
  const groupRef = useRef<Group>(null);
  const select = useApp((s) => s.select);
  const selected = useApp((s) => s.selected);
  const hoverRef = useRef(0);

  const bodyColor = useMemo(() => PROJECT_PALETTE[paletteIndex % PROJECT_PALETTE.length], [paletteIndex]);
  const roofColor = useMemo(() => (session.model ? MODEL_ROOF[session.model] ?? UNKNOWN_ROOF : UNKNOWN_ROOF), [session.model]);
  const height = useMemo(() => houseScale(session.tokensIn, session.tokensOut), [session.tokensIn, session.tokensOut]);
  const walls = useMemo(() => Math.min(9, 3 + Math.round(height)), [height]);
  const pitched = useMemo(() => session.id.charCodeAt(0) % 2 === 0, [session.id]);
  const chimney = useMemo(() => session.id.charCodeAt(0) % 3 === 0, [session.id]);

  const voxels = useMemo(
    () => houseVoxels({ body: bodyColor, roof: roofColor, walls, pitched, chimney }),
    [bodyColor, roofColor, walls, pitched, chimney],
  );

  const scale = useMemo(() => 0.72 / (FOOTPRINT * 0.96), []);
  const delay = useMemo(() => (session.id.charCodeAt(session.id.length - 1) % 30) / 60, [session.id]);
  const start = useRef<number | null>(null);
  const isSelected = selected?.id === session.id;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    start.current ??= clock.elapsedTime;
    const t = (clock.elapsedTime - start.current - delay) / 0.35;
    const eased = Math.max(0, Math.min(1, t));
    const smooth = eased * eased * (3 - 2 * eased);
    const base = smooth === 1 ? 1 : Math.max(0.001, smooth);
    const hover = hoverRef.current ? 1.08 : 1;
    g.scale.setScalar(base * hover * scale);
    const bob = isSelected ? Math.sin(clock.elapsedTime * 2.2) * 0.06 : 0;
    g.position.y = bob;
  });

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      scale={0.001}
      onClick={(e) => {
        e.stopPropagation();
        select(session);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        hoverRef.current = 1;
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        hoverRef.current = 0;
        document.body.style.cursor = "auto";
      }}
    >
      <InstancedVoxels voxels={voxels} />
    </group>
  );
}