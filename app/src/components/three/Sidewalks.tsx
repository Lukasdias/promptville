import { useMemo } from "react";
import { CanvasTexture, MeshStandardMaterial, RepeatWrapping } from "three";
import type { Street } from "../../layout";
import type { Intersection } from "../../traffic";
import { COLORS } from "../../theme";

const SIDEWALK_WIDTH = 0.7;

// Tileable canvas-generated brick texture (no image assets).
function makeBrickTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  const w = 96;
  const h = 48;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = COLORS.mortar;
  ctx.fillRect(0, 0, w, h);
  const rows = 2;
  const cols = 3;
  const brickH = h / rows;
  const brickW = w / cols;
  const mortar = 3;
  ctx.fillStyle = COLORS.brick;
  for (let r = 0; r < rows; r++) {
    const y = r * brickH;
    const off = r % 2 === 0 ? 0 : brickW / 2;
    for (let c = 0; c < cols; c++) {
      const x = c * brickW + off;
      ctx.fillRect(x, y + mortar / 2, brickW - mortar, brickH - mortar);
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

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
    () =>
      sidewalks.map((sw) => {
        const tex = makeBrickTexture();
        tex.repeat.set(Math.max(1, sw.w / 1.6), Math.max(1, sw.d / 0.8));
        tex.needsUpdate = true;
        return new MeshStandardMaterial({ map: tex, roughness: 1 });
      }),
    [sidewalks],
  );

  const crosswalks = useMemo(() => {
    const out: SidewalkRect[] = [];
    for (const it of intersections) {
      const avenue = streets.find((s) => s.width >= s.depth && Math.abs(s.z - it.z) < 0.01);
      if (!avenue) continue;
      for (let i = -1; i <= 2; i++) {
        out.push({ x: it.x + i * 0.5 - 0.15, z: it.z, w: 0.4, d: avenue.depth });
      }
    }
    return out;
  }, [intersections, streets]);

  return (
    <group>
      {sidewalks.map((sw, i) => (
        <mesh key={i} position={[sw.x, -0.035, sw.z]} rotation-x={-Math.PI / 2} receiveShadow material={sidewalkMaterials[i]}>
          <planeGeometry args={[sw.w, sw.d]} />
        </mesh>
      ))}
      {crosswalks.map((c, i) => (
        <mesh key={i} position={[c.x, -0.041, c.z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[c.w, c.d]} />
          <meshStandardMaterial color={COLORS.crosswalk} />
        </mesh>
      ))}
    </group>
  );
}