import { useMemo } from "react";
import { MeshStandardMaterial } from "three";
import type { Street } from "../../layout";
import type { Intersection } from "../../traffic";
import { sidewalkSegments, SIDEWALK_HEIGHT, CURB_HEIGHT } from "../../sidewalk";
import { sidewalkMaterialFor } from "../../textures";
import { shade } from "../../texturePatterns";
import { buildCrosswalks } from "../../crosswalk";
import { COLORS, CROSSWALK_BRICK } from "../../theme";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";

const CURB_MATERIAL = new MeshStandardMaterial({
  color: COLORS.curb,
  roughness: 1,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});
const CROSSWALK_MATERIAL = new MeshStandardMaterial({
  color: CROSSWALK_BRICK,
  roughness: 1,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});
// Cartoon outline drawn beneath each zebra stripe — a slightly larger darker
// slab so the stripe reads outlined, sticker-style.
const CROSSWALK_OUTLINE = new MeshStandardMaterial({
  color: shade(COLORS.road, -0.4),
  roughness: 1,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});
// Vertical layering is the fix for the corner flicker: the street slab top is
// y=0.05, so every overlay sits clearly ABOVE it with a real height gap (not
// coplanar). Coplanar surfaces z-fight — worst when zoomed out, where the depth
// buffer has far less precision than the ~0.005 gap these used to share.
const CROSSWALK_TOP = 0.075;           // stripe surface, well above the road
const CROSSWALK_OUTLINE_TOP = 0.062;   // outline slab, just beneath the stripe
const CROSSWALK_OUTLINE_PAD = 0.06;

export function Sidewalks({
  streets,
  intersections,
}: {
  streets: Street[];
  intersections: Intersection[];
}) {
  const clearSelection = useApp((s) => s.clearSelection);
  const segments = useMemo(() => sidewalkSegments(streets), [streets]);
  const crosswalks = useMemo(
    () => buildCrosswalks(intersections, streets),
    [intersections, streets],
  );
  const materials = useMemo(
    () =>
      segments.map((seg) =>
        seg.kind === "walk" ? sidewalkMaterialFor(seg.w, seg.d) : CURB_MATERIAL,
      ),
    [segments],
  );

  const clear = (e: { stopPropagation: () => void }) => {
    if (isPanActive()) return;
    e.stopPropagation();
    clearSelection();
  };

  return (
    <group>
      {segments.map((seg, i) => {
        const height = seg.kind === "walk" ? SIDEWALK_HEIGHT : CURB_HEIGHT;
        return (
          <mesh
            key={i}
            position={[seg.x, height / 2, seg.z]}
            receiveShadow
            material={materials[i]}
            onClick={clear}
          >
            <boxGeometry args={[seg.w, height, seg.d]} />
          </mesh>
        );
      })}
      {crosswalks.map((c, i) => (
        <group key={`cs${i}`}>
          {/* Cartoon outline: a slightly larger dark slab just beneath the stripe */}
          <mesh
            position={[c.x, CROSSWALK_OUTLINE_TOP, c.z]}
            rotation-x={-Math.PI / 2}
            material={CROSSWALK_OUTLINE}
            onClick={clear}
          >
            <planeGeometry args={[c.w + CROSSWALK_OUTLINE_PAD * 2, c.d + CROSSWALK_OUTLINE_PAD * 2]} />
          </mesh>
          <mesh position={[c.x, CROSSWALK_TOP, c.z]} rotation-x={-Math.PI / 2} material={CROSSWALK_MATERIAL} onClick={clear}>
            <planeGeometry args={[c.w, c.d]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
