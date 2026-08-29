import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Float, Html } from "@react-three/drei";
import { useCity } from "../../city";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";
import { heavyChange, landmarkHeight } from "../../layered";
import { markerVoxels, todoSignVoxels } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";

const CARD_STYLE: CSSProperties = {
  background: "#fff6e5",
  border: "3px solid #4a4453",
  borderRadius: 10,
  boxShadow: "3px 3px 0 rgba(74,68,83,0.35)",
  padding: "4px 10px",
  fontFamily: '"Nunito", sans-serif',
  fontWeight: 700,
  fontSize: 12,
  color: "#4a4453",
  whiteSpace: "nowrap",
  maxWidth: 200,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

interface BlockSignal {
  id: string;
  x: number;
  z: number;
  height: number;
  name: string;
  sessionCount: number;
  totalCost: number;
  hasTodos: boolean;
  markers: { x: number; z: number }[];
  todoX: number;
  todoZ: number;
}

export function Signals() {
  const { blocks } = useCity();
  const { data } = useNeighborhood();
  const showSignals = useApp((s) => s.tweaks.showSignals);

  const signals = useMemo<BlockSignal[]>(() => {
    if (!data) return [];
    const out: BlockSignal[] = [];
    for (const block of blocks) {
      if (block.kind === "plaza") continue;
      const project = data.projects.find((p) => p.id === block.projectId);
      if (!project || project.sessions.length === 0) continue;
      const markers = project.sessions
        .map((s, i) => ({ s, slot: block.houses[i] }))
        .filter(({ s, slot }) => slot && heavyChange(s.patchCount, s.diffAdditions))
        .map(({ slot }) => ({ x: slot!.x, z: slot!.z }));
      out.push({
        id: block.projectId,
        x: block.x,
        z: block.z,
        height: landmarkHeight(project.totalCost),
        name: project.name,
        sessionCount: project.sessions.length,
        totalCost: project.totalCost,
        hasTodos: project.todoCount > 0,
        markers,
        todoX: block.x + 3,
        todoZ: block.z - 3,
      });
    }
    return out;
  }, [blocks, data]);

  if (!showSignals || signals.length === 0) return null;

  return (
    <group>
      {signals.map((s) => (
        <Float key={s.id} speed={2} rotationIntensity={0} floatIntensity={0.6}>
          <Html
            center
            distanceFactor={12}
            zIndexRange={[20, 0]}
            position={[s.x, s.height * 0.4 + 1.2, s.z]}
            style={{ pointerEvents: "none" }}
          >
            <div style={CARD_STYLE}>
              {s.name} · {s.sessionCount} · ${s.totalCost.toFixed(2)}
            </div>
          </Html>
        </Float>
      ))}
      {signals.map((s) =>
        s.markers.length > 0 ? (
          <InstancedVoxels
            key={`markers-${s.id}`}
            voxels={s.markers.flatMap((m) =>
              markerVoxels("#ff5252").map((v) => ({ ...v, x: v.x + m.x, z: v.z + m.z })),
            )}
          />
        ) : null,
      )}
      {signals
        .filter((s) => s.hasTodos)
        .map((s) => (
          <InstancedVoxels
            key={`todo-${s.id}`}
            voxels={todoSignVoxels().map((v) => ({ ...v, x: v.x + s.todoX, z: v.z + s.todoZ }))}
          />
        ))}
    </group>
  );
}
