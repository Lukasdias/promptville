import { useMemo } from "react";
import { Float, Html } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";
import { useNeighborhood } from "../../query";
import {
  buildPerimeterRing,
  buildStreets,
  cityBounds,
  CIVIC_PLAZA,
  extendRoadsToRing,
  layoutCity,
} from "../../layout";
import type { PlacedBlock } from "../../layout";
import { findIntersections } from "../../traffic";
import { buildRoadGraph } from "../../roadgraph";
import { layoutCivicDistrict } from "../../civic";
import { BUILDING_META } from "../../civic";

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

  const blocks = useMemo<PlacedBlock[]>(
    () => (data ? layoutCity(data.projects, { plaza: CIVIC_PLAZA }) : []),
    [data],
  );

  const plazaBlock = useMemo(() => blocks.find((b) => b.kind === "plaza") ?? null, [blocks]);
  const mainStreets = useMemo(() => buildStreets(blocks), [blocks]);
  const bounds = useMemo(() => cityBounds(blocks), [blocks]);
  const ring = useMemo(() => (bounds ? buildPerimeterRing(bounds) : []), [bounds]);
  const graphStreets = useMemo(
    () => (bounds ? [...extendRoadsToRing(mainStreets, bounds), ...ring] : []),
    [mainStreets, bounds, ring],
  );
  const graph = useMemo(() => buildRoadGraph(graphStreets, findIntersections(graphStreets)), [graphStreets]);
  const civic = useMemo(
    () => (plazaBlock && graph.nodes.length > 0 ? layoutCivicDistrict(plazaBlock, graphStreets, graph) : null),
    [plazaBlock, graphStreets, graph],
  );

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
    <group position={[position.x, 1.4, position.z]}>
      <Float speed={2.2} rotationIntensity={0.15} floatIntensity={0.35}>
        <Html center distanceFactor={14} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <TitleChip key={selectedBuilding ?? selected?.id} title={title} />
        </Html>
      </Float>
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.4, 6]} />
        <meshStandardMaterial color="#4a4453" />
      </mesh>
    </group>
  );
}