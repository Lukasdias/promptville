import { useMemo } from "react";
import { Float, Html } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";
import { useNeighborhood } from "../../query";
import { layoutCity } from "../../layout";
import type { PlacedBlock } from "../../layout";

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
  const { data } = useNeighborhood();

  const blocks = useMemo<PlacedBlock[]>(
    () => (data ? layoutCity(data.projects) : []),
    [data],
  );

  const position = useMemo(() => {
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
  }, [selected, data, blocks]);

  if (!selected || !position) return null;

  return (
    <group position={[position.x, 1.4, position.z]}>
      <Float speed={2.2} rotationIntensity={0.15} floatIntensity={0.35}>
        <Html center distanceFactor={14} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <TitleChip key={selected.id} title={selected.title} />
        </Html>
      </Float>
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.4, 6]} />
        <meshStandardMaterial color="#4a4453" />
      </mesh>
    </group>
  );
}