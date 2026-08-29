import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PointLight } from "three";
import { useNeighborhood } from "../../query";
import { useCity } from "../../city";
import { houseParams } from "../../house";
import { nightRef } from "../../night";

// Budget: real point lights are expensive, so we keep a small fixed pool and
// let the camera win the "which houses are lit at night" decision. The pool is
// reassigned every frame to the nearest lit houses, so the area you are looking
// at always has warm pools of light without a light per house (hundreds).
const POOL = 14;
const DISTANCE = 7.5;
const DECAY = 2;
const COLOR = "#ffb36b";
const MAX_INTENSITY = 1.6;

interface Candidate {
  x: number;
  z: number;
  y: number;
  value: number;
}

export function HouseNightLights() {
  const { data } = useNeighborhood();
  const { blocks } = useCity();
  const camera = useThree((s) => s.camera);
  const lightRefs = useRef<PointLight[]>([]);

  // Lit house candidates: world centers (slot.x/slot.z are world coords). Bigger
  // houses (higher scale) win ties; only houses with a session are lit.
  const candidates = useMemo<Candidate[]>(() => {
    const out: Candidate[] = [];
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b];
      if (block.kind === "plaza") continue;
      const project = data?.projects.find((p) => p.id === block.projectId);
      if (!project) continue;
      block.houses.forEach((slot) => {
        const session = project.sessions[slot.index];
        if (!session) return;
        const hp = houseParams(session, b);
        out.push({ x: slot.x, z: slot.z, y: hp.voxelScale * hp.walls, value: hp.scale });
      });
    }
    return out;
  }, [blocks, data]);

  useFrame(() => {
    const floor = nightRef.current;
    if (floor <= 0) {
      for (const ref of lightRefs.current) ref.intensity = 0;
      return;
    }
    // Nearest-N lit houses to the camera win the pool each frame.
    const cx = camera.position.x;
    const cz = camera.position.z;
    const sorted = candidates
      .map((c) => ({ c, d: (c.x - cx) ** 2 + (c.z - cz) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, POOL);

    for (let i = 0; i < lightRefs.current.length; i++) {
      const ref = lightRefs.current[i];
      const target = sorted[i];
      if (!target) {
        ref.intensity = 0;
        continue;
      }
      const { c } = target;
      ref.position.set(c.x, c.y * 0.6, c.z);
      // Brightness biases toward the bigger/richer houses in view.
      ref.intensity = floor * MAX_INTENSITY * (0.6 + (c.value - 1) * 0.06);
    }
  });

  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            if (el) lightRefs.current[i] = el as PointLight;
          }}
          color={COLOR}
          distance={DISTANCE}
          decay={DECAY}
          intensity={0}
        />
      ))}
    </group>
  );
}
