import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import type { PlacedBlock, Street } from "../../layout";
import { lampVoxels, treeVoxels, bushVoxels, flowersVoxels, LAMP_HEIGHT } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { COLORS } from "../../theme";
import { LAMP_GLOW, GLOW_MAX } from "../../theme";
import { nightRef } from "../../night";
import { useApp } from "../../store";
import { environmentLayout } from "../../environment";
import { environment } from "../../config";

const TREE_SIZE = 0.22;
const LAMP_SIZE = 0.25;
const BUSH_SIZE = 0.2;
const FLOWER_SIZE = 0.16;

// The lamp renders as TWO instanced meshes with separate materials: the pole
// stays opaque (never emissive), and only the glow head carries emissive.
// `emissive` is material-level (not per-instance like setColorAt), so a single
// shared material would make the whole column glow at night — the yellow
// vertical-rectangle artifact.
const lamp = lampVoxels();
const LAMP_POLE_VOX = lamp.filter((v) => v.y < LAMP_HEIGHT);
const LAMP_HEAD_VOX = lamp.filter((v) => v.y === LAMP_HEIGHT);

export function World({
  blocks,
  streets,
}: {
  blocks: PlacedBlock[];
  streets: Street[];
}) {
  const showScenery = useApp((s) => s.tweaks.showScenery);

  const layout = useMemo(
    () =>
      environmentLayout(blocks, streets, {
        trees: environment.trees,
        lamps: environment.lamps,
        bushes: environment.bushes,
        flowers: environment.flowers,
      }),
    [blocks, streets],
  );
  const trees = layout.trees;
  const lamps = layout.lamps;
  const bushes = layout.bushes;
  const flowers = layout.flowers;

  const lampPoleMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#ffffff", flatShading: true }),
    [],
  );
  const lampGlowMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#ffffff",
        emissive: LAMP_GLOW,
        emissiveIntensity: 0,
        flatShading: true,
      }),
    [],
  );
  const lampLightRefs = useRef<{ intensity: number }[]>([]);
  useFrame(() => {
    lampGlowMaterial.emissiveIntensity = nightRef.current * GLOW_MAX;
    const lampIntensity = nightRef.current * 1.1;
    for (const ref of lampLightRefs.current) ref.intensity = lampIntensity;
  });

  if (!showScenery) return null;

  return (
    <group>
      {/* Street trees: line the sidewalks in the front-yard grass */}
      {trees.map((t, i) => (
        <group key={`t${i}`} position={[t.x, 0, t.z]} scale={t.s}>
          <InstancedVoxels voxels={treeVoxels(COLORS.grassDark)} voxelSize={TREE_SIZE} />
        </group>
      ))}

      {/* Bushes + flowers scattered into the free lot lawn */}
      {bushes.map((b, i) => (
        <group key={`b${i}`} position={[b.x, 0, b.z]} scale={b.s}>
          <InstancedVoxels voxels={bushVoxels(COLORS.grassDark)} voxelSize={BUSH_SIZE} />
        </group>
      ))}
      {flowers.map((f, i) => (
        <group key={`f${i}`} position={[f.x, 0, f.z]}>
          <InstancedVoxels voxels={flowersVoxels()} voxelSize={FLOWER_SIZE} />
        </group>
      ))}

      {/* Street lamps: opaque pole + emissive glow head + real point light at the
          head's world height, all ramped up at night. */}
      {lamps.map((l, i) => (
        <group key={`l${i}`} position={[l.x, 0, l.z]}>
          <InstancedVoxels voxels={LAMP_POLE_VOX} voxelSize={LAMP_SIZE} material={lampPoleMaterial} />
          <InstancedVoxels voxels={LAMP_HEAD_VOX} voxelSize={LAMP_SIZE} material={lampGlowMaterial} />
          <pointLight
            ref={(el) => {
              if (el) lampLightRefs.current[i] = el as unknown as { intensity: number };
            }}
            position={[0, (LAMP_HEIGHT + 0.5) * LAMP_SIZE, 0]}
            color={LAMP_GLOW}
            distance={9}
            decay={2}
            intensity={0}
          />
        </group>
      ))}
    </group>
  );
}
