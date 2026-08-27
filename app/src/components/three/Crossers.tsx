import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Street } from "../../layout";
import type { Intersection, TrafficController } from "../../traffic";
import { personVoxels } from "../../voxel";
import { useApp } from "../../store";
import { InstancedVoxels } from "./InstancedVoxels";

const CROSS_SIZE = 0.15;
const CROSS_SPEED = 1.3;

interface CrosserSpec {
  intersection: Intersection;
  halfDepth: number;
  axisOffset: number;
  shirt: string;
}

function useCrosserSpecs(
  intersections: Intersection[],
  streets: Street[],
): CrosserSpec[] {
  return useMemo(() => {
    const out: CrosserSpec[] = [];
    const shirts = ["#ffb3ba", "#bae1ff", "#baffc9", "#d4baff"];
    // Only cross at intersections that sit on a main avenue (not ring corners).
    for (const it of intersections.slice(0, 12)) {
      const avenue = streets.find((s) => s.width >= s.depth && Math.abs(s.z - it.z) < 0.01);
      if (!avenue) continue;
      if (out.length >= 4) break;
      out.push({
        intersection: it,
        halfDepth: avenue.depth / 2,
        axisOffset: -0.55 + (out.length % 3) * 0.5,
        shirt: shirts[out.length % shirts.length],
      });
    }
    return out;
  }, [intersections, streets]);
}

function Crosser({ spec, controller }: { spec: CrosserSpec; controller: TrafficController }) {
  const ref = useRef<Group>(null);
  // z position relative to the avenue center; north curb = -halfDepth, south = +halfDepth
  const pos = useRef(-spec.halfDepth);
  const dir = useRef<1 | -1>(1);
  const crossing = useRef(false);

  const voxels = useMemo(() => personVoxels(spec.shirt), [spec.shirt]);

  useFrame(({ clock }, delta) => {
    const g = ref.current;
    if (!g) return;
    // Cross when the avenue is red (side-street green).
    const canCross = controller.greenFor(spec.intersection.id, "z");
    let p = pos.current;

    if (crossing.current) {
      // Light went green mid-cross: clear the road if past the middle, else retreat.
      if (!canCross) {
        const pastMiddle = dir.current === 1 ? p > 0 : p < 0;
        if (!pastMiddle) {
          crossing.current = false;
          dir.current = p <= 0 ? 1 : -1;
        }
      }
      if (crossing.current) {
        p += dir.current * CROSS_SPEED * delta;
        if (dir.current === 1 && p >= spec.halfDepth) {
          p = spec.halfDepth;
          crossing.current = false;
          dir.current = -1;
        }
        if (dir.current === -1 && p <= -spec.halfDepth) {
          p = -spec.halfDepth;
          crossing.current = false;
          dir.current = 1;
        }
      }
    } else if (canCross) {
      crossing.current = true;
      dir.current = p <= 0 ? 1 : -1;
    }

    pos.current = p;
    // Idle bob while waiting at the curb.
    const bob = crossing.current ? 0 : Math.sin(clock.elapsedTime * 2.2) * 0.025;
    g.position.set(spec.intersection.x + spec.axisOffset, bob, spec.intersection.z + p);
    g.rotation.y = dir.current === 1 ? Math.PI / 2 : -Math.PI / 2;
  });

  return (
    <group ref={ref}>
      <InstancedVoxels voxels={voxels} voxelSize={CROSS_SIZE} />
    </group>
  );
}

export function Crossers({
  intersections,
  streets,
  controller,
}: {
  intersections: Intersection[];
  streets: Street[];
  controller: TrafficController;
}) {
  const specs = useCrosserSpecs(intersections, streets);
  const showTraffic = useApp((s) => s.tweaks.showTraffic);
  if (!showTraffic) return null;
  return (
    <group>
      {specs.map((spec, i) => (
        <Crosser key={i} spec={spec} controller={controller} />
      ))}
    </group>
  );
}