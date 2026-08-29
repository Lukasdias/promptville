import { useMemo } from "react";
import { Float, Html } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";
import { useNeighborhood } from "../../query";
import { useCity } from "../../city";
import { BUILDING_META } from "../../civic";

const BANNER_Y = 1.4;
const TITLE_FLOAT_INTENSITY = 0.35;

function TitleChip({ title }: { title: string }) {
  const { scale, opacity } = useSpring({
    from: { scale: 0.55, opacity: 0 },
    to: { scale: 1, opacity: 1 },
    config: { tension: 320, friction: 18 },
  });
  return (
    <animated.div
      style={{
        ...{
          background: "#fff6e5",
          border: "3px solid #4a4453",
          borderRadius: 12,
          boxShadow: "4px 4px 0 rgba(74, 68, 83, 0.35)",
          padding: "6px 12px",
          fontFamily: '"Nunito", sans-serif',
          fontWeight: 700,
          color: "#4a4453",
          whiteSpace: "nowrap",
          maxWidth: 260,
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
        transform: scale.to((s) => `scale(${s})`),
        opacity,
      }}
    >
      {title}
    </animated.div>
  );
}

export function SelectedBanner() {
  const selected = useApp((s) => s.selected);
  const selectedBuilding = useApp((s) => s.selectedBuilding);
  const { data } = useNeighborhood();
  const { blocks, civic } = useCity();

  const position = useMemo(() => {
    if (selectedBuilding) {
      const lot = civic?.lots.find((l) => l.kind === selectedBuilding);
      return lot ? { x: lot.x, z: lot.z } : null;
    }
    if (!selected || blocks.length === 0) return null;
    for (const project of data?.projects ?? []) {
      const idx = project.sessions.findIndex((s) => s.id === selected.id);
      if (idx === -1) continue;
      const block = blocks.find((b) => b.projectId === project.id);
      const slot = block?.houses[idx];
      if (!block || !slot) return null;
      return { x: slot.x, z: slot.z };
    }
    return null;
  }, [selected, selectedBuilding, data, blocks, civic]);

  const title = selectedBuilding ? BUILDING_META[selectedBuilding].name : selected?.title;
  if (!title || !position) return null;

  return (
    <group position={[position.x, BANNER_Y, position.z]}>
      <Float speed={2.2} rotationIntensity={0.15} floatIntensity={TITLE_FLOAT_INTENSITY}>
        <Html center distanceFactor={14} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <TitleChip key={selectedBuilding ?? selected?.id} title={title} />
        </Html>
      </Float>
    </group>
  );
}