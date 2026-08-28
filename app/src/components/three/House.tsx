import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Html } from "@react-three/drei";
import type { Group } from "three";
import { houseScale } from "../../layout";
import { MODEL_ROOF, PROJECT_PALETTE, UNKNOWN_ROOF } from "../../theme";
import { houseVoxels } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";
import type { SessionData } from "../../types";

type HouseKind = "cottage" | "house" | "mansion" | "skyscraper";

const KIND_GEOMETRY: Record<HouseKind, { footprint: number; width: number }> = {
  cottage: { footprint: 5, width: 0.6 },
  house: { footprint: 7, width: 0.72 },
  mansion: { footprint: 9, width: 1.15 },
  skyscraper: { footprint: 5, width: 0.65 },
};

function kindFor(scale: number): HouseKind {
  if (scale < 1.5) return "cottage";
  if (scale < 3.2) return "house";
  if (scale < 5) return "mansion";
  return "skyscraper";
}

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
  const [hovered, setHovered] = useState(false);

  const bodyColor = useMemo(() => PROJECT_PALETTE[paletteIndex % PROJECT_PALETTE.length], [paletteIndex]);
  const roofColor = useMemo(() => (session.model ? MODEL_ROOF[session.model] ?? UNKNOWN_ROOF : UNKNOWN_ROOF), [session.model]);
  const scale = useMemo(() => houseScale(session.tokensIn, session.tokensOut), [session.tokensIn, session.tokensOut]);
  const kind = useMemo(() => kindFor(scale), [scale]);
  const { footprint, width } = KIND_GEOMETRY[kind];
  const idCode = useMemo(() => session.id.charCodeAt(0), [session.id]);

  const voxels = useMemo(() => {
    const walls = (() => {
      switch (kind) {
        case "cottage":
          return 3;
        case "house":
          return Math.min(6, 3 + Math.round((scale - 1.5) * 1.2));
        case "mansion":
          return Math.min(8, 5 + Math.round((scale - 3.2) * 1.5));
        case "skyscraper":
          return Math.min(16, 10 + Math.round((scale - 5) * 4));
      }
    })();
    return houseVoxels({
      body: bodyColor,
      roof: roofColor,
      width: footprint,
      depth: footprint,
      walls,
      pitched: kind !== "skyscraper",
      chimney: kind === "mansion" ? idCode % 3 === 0 : idCode % 4 === 0,
      windows: kind !== "cottage",
      sideWindows: kind === "mansion" || kind === "skyscraper",
      antenna: kind === "skyscraper",
    });
  }, [kind, scale, bodyColor, roofColor, footprint, idCode]);

  const voxelScale = useMemo(() => width / (footprint * 0.96), [width, footprint]);
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
    g.scale.setScalar(base * hover * voxelScale);
    const bob = isSelected ? Math.sin(clock.elapsedTime * 2.2) * 0.06 : 0;
    g.position.y = bob;
  });

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      scale={0.001}
      onClick={(e) => {
        if (isPanActive()) return;
        e.stopPropagation();
        select(session);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        hoverRef.current = 1;
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        hoverRef.current = 0;
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <InstancedVoxels voxels={voxels} />
      {(hovered || isSelected) && (
        <Float speed={2} rotationIntensity={0} floatIntensity={0.6}>
          <Html center distanceFactor={12} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: "#fff6e5",
                border: "3px solid #4a4453",
                borderRadius: 10,
                boxShadow: "3px 3px 0 rgba(74,68,83,0.35)",
                padding: "3px 8px",
                fontFamily: '"Nunito", sans-serif',
                fontWeight: 700,
                fontSize: 12,
                color: "#4a4453",
                whiteSpace: "nowrap",
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {session.title}
            </div>
          </Html>
        </Float>
      )}
    </group>
  );
}