import { useMemo } from "react";
import { MeshStandardMaterial } from "three";
import type { Street } from "../../layout";
import type { Intersection } from "../../traffic";
import { sidewalkMaterialFor } from "../../textures";
import { buildCrosswalks } from "../../crosswalk";
import { CROSSWALK_BRICK } from "../../theme";

const SIDEWALK_WIDTH = 0.7;

const CROSSWALK_MATERIAL = new MeshStandardMaterial({ color: CROSSWALK_BRICK, roughness: 1 });

interface SidewalkRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export function Sidewalks({
  streets,
  intersections,
}: {
  streets: Street[];
  intersections: Intersection[];
}) {
  const sidewalks = useMemo<SidewalkRect[]>(() => {
    const out: SidewalkRect[] = [];
    for (const s of streets) {
      if (s.width >= s.depth) {
        out.push({ x: s.x, z: s.z - s.depth / 2 - SIDEWALK_WIDTH / 2, w: s.width, d: SIDEWALK_WIDTH });
        out.push({ x: s.x, z: s.z + s.depth / 2 + SIDEWALK_WIDTH / 2, w: s.width, d: SIDEWALK_WIDTH });
      } else {
        out.push({ x: s.x - s.width / 2 - SIDEWALK_WIDTH / 2, z: s.z, w: SIDEWALK_WIDTH, d: s.depth });
        out.push({ x: s.x + s.width / 2 + SIDEWALK_WIDTH / 2, z: s.z, w: SIDEWALK_WIDTH, d: s.depth });
      }
    }
    return out;
  }, [streets]);

  const sidewalkMaterials = useMemo(
    () => sidewalks.map((sw) => sidewalkMaterialFor(sw.w, sw.d)),
    [sidewalks],
  );

  const crosswalks = useMemo(
    () => buildCrosswalks(intersections, streets),
    [intersections, streets],
  );

  return (
    <group>
      {sidewalks.map((sw, i) => (
        <mesh key={i} position={[sw.x, -0.035, sw.z]} rotation-x={-Math.PI / 2} receiveShadow material={sidewalkMaterials[i]}>
          <planeGeometry args={[sw.w, sw.d]} />
        </mesh>
      ))}
      {crosswalks.map((c, i) => (
        <mesh
          key={`cs${i}`}
          position={[c.x, -0.041, c.z]}
          rotation-x={-Math.PI / 2}
          material={CROSSWALK_MATERIAL}
        >
          <planeGeometry args={[c.w, c.d]} />
        </mesh>
      ))}
    </group>
  );
}