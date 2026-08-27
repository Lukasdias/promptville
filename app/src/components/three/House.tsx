import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, ConeGeometry, type Group } from "three";
import { houseScale } from "../../layout";
import { MODEL_ROOF, PROJECT_PALETTE, UNKNOWN_ROOF } from "../../theme";
import { useApp } from "../../store";
import type { SessionData } from "../../types";

// Shared geometries — created once, reused by every house (see docs/r3f-reference.md §9/§10).
const BODY_GEO = new BoxGeometry(1, 1, 1);
const ROOF_GEO = new ConeGeometry(0.82, 0.55, 4);
const DOOR_GEO = new BoxGeometry(0.18, 0.42, 0.04);
const WINDOW_GEO = new BoxGeometry(0.16, 0.16, 0.04);
const CHIMNEY_GEO = new BoxGeometry(0.12, 0.5, 0.12);

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
    g.scale.setScalar(base * hover);
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
      {/* Body */}
      <mesh castShadow receiveShadow geometry={BODY_GEO} scale={[0.72, height, 0.72]} position={[0, height / 2, 0]}>
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {/* Roof */}
      <mesh castShadow geometry={ROOF_GEO} position={[0, height + 0.28, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.15, 1, 1.15]}>
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Door */}
      <mesh geometry={DOOR_GEO} position={[0, 0.28, 0.361]}>
        <meshStandardMaterial color="#7a5230" />
      </mesh>
      {/* Windows */}
      <mesh geometry={WINDOW_GEO} position={[0.26, 0.78, 0.361]}>
        <meshStandardMaterial color="#aee6ff" />
      </mesh>
      <mesh geometry={WINDOW_GEO} position={[-0.26, 0.78, 0.361]}>
        <meshStandardMaterial color="#aee6ff" />
      </mesh>
      {/* Chimney on some houses */}
      {session.id.charCodeAt(0) % 3 === 0 && (
        <mesh geometry={CHIMNEY_GEO} position={[0.2, height + 0.28, 0.1]}>
          <meshStandardMaterial color="#c96f6f" />
        </mesh>
      )}
    </group>
  );
}