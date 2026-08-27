import { useMemo } from "react";
import { MeshStandardMaterial } from "three";
import type { Street } from "../../layout";
import type { Intersection } from "../../traffic";
import { sidewalkMaterialFor } from "../../textures";
import { CROSSWALK_BRICK, CROSSWALK_SHADOW } from "../../theme";

const SIDEWALK_WIDTH = 0.7;
const CROSS_SPACING = 0.5;
const CROSS_WIDTH = 0.4;
const SHADOW_OFFSET = 0.08;

const CROSSWALK_MATERIAL = new MeshStandardMaterial({ color: CROSSWALK_BRICK, roughness: 1 });
const CROSSWALK_SHADOW_MATERIAL = new MeshStandardMaterial({ color: CROSSWALK_SHADOW, roughness: 1 });

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

  // Crosswalks cross both the avenue and the side street at each intersection;
  // each crossing has a shadow band offset behind its stripes ("paper shadow").
  const crosswalks = useMemo(() => {
    const stripes: SidewalkRect[] = [];
    const bands: SidewalkRect[] = [];
    for (const it of intersections) {
      const avenue = streets.find((s) => s.width >= s.depth && Math.abs(s.z - it.z) < 0.01);
      if (avenue) {
        bands.push({ x: it.x - 0.85, z: it.z - avenue.depth / 2 - 0.15, w: 1.9, d: avenue.depth + 0.3 });
        for (let i = -1; i <= 2; i++) {
          stripes.push({ x: it.x + i * CROSS_SPACING - 0.15, z: it.z, w: CROSS_WIDTH, d: avenue.depth });
        }
      }
      const side = streets.find((s) => s.width < s.depth && Math.abs(s.x - it.x) < 0.01);
      if (side) {
        bands.push({ x: it.x - side.width / 2 - 0.15, z: it.z - 0.85, w: side.width + 0.3, d: 1.9 });
        for (let i = -1; i <= 2; i++) {
          stripes.push({ x: it.x, z: it.z + i * CROSS_SPACING - 0.15, w: side.width, d: CROSS_WIDTH });
        }
      }
    }
    return { stripes, bands };
  }, [intersections, streets]);

  return (
    <group>
      {sidewalks.map((sw, i) => (
        <mesh key={i} position={[sw.x, -0.035, sw.z]} rotation-x={-Math.PI / 2} receiveShadow material={sidewalkMaterials[i]}>
          <planeGeometry args={[sw.w, sw.d]} />
        </mesh>
      ))}
      {crosswalks.bands.map((c, i) => (
        <mesh
          key={`sb${i}`}
          position={[c.x + SHADOW_OFFSET, -0.042, c.z + SHADOW_OFFSET]}
          rotation-x={-Math.PI / 2}
          material={CROSSWALK_SHADOW_MATERIAL}
        >
          <planeGeometry args={[c.w, c.d]} />
        </mesh>
      ))}
      {crosswalks.stripes.map((c, i) => (
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