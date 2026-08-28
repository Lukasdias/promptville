import { useMemo } from "react";
import type { Street } from "../../layout";
import { asphaltMaterialFor } from "../../textures";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";

const SLAB_H = 0.05;

export function Streets({ streets }: { streets: Street[] }) {
  const clearSelection = useApp((s) => s.clearSelection);
  const clear = (e: { stopPropagation: () => void }) => {
    if (isPanActive()) return;
    e.stopPropagation();
    clearSelection();
  };
  const materials = useMemo(
    () => streets.map((s) => asphaltMaterialFor(s.width, s.depth)),
    [streets],
  );

  return (
    <group>
      {streets.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, SLAB_H / 2, s.z]}
          receiveShadow
          material={materials[i]}
          onClick={clear}
        >
          <boxGeometry args={[s.width, SLAB_H, s.depth]} />
        </mesh>
      ))}
    </group>
  );
}
