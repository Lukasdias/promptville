import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  DoubleSide,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
} from "three";
import { mulberry32 } from "../../rand";
import { useApp } from "../../store";
import { nightRef } from "../../night";

const AREA = 22; // half-extent of the fog field
const DRIFT = 0.35; // lateral wind, world units / second
const _obj = new Object3D();
// Large soft quad, laid flat by rotation-x=-PI/2 per instance.
const FOG_WIDTH = 14;
const FOG_HEIGHT = 9;

// Soft radial alpha so each patch feathers to transparent at its edges instead of
// rendering as a hard rectangle. Built lazily once (CanvasTexture can't be created
// at module load outside a browser context).
let fogTexture: CanvasTexture | null = null;
function getFogTexture(): CanvasTexture {
  if (fogTexture) return fogTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // White gradient — the material color tints it. Alpha falls off to 0 at the rim.
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.55, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  fogTexture = new CanvasTexture(canvas);
  return fogTexture;
}

interface Patch {
  x: number;
  z: number;
  phase: number;
}

export function GroundFog({
  count = 12,
  opacity = 0.16,
  area = AREA,
}: {
  count?: number;
  opacity?: number;
  area?: number;
}) {
  const showFog = useApp((s) => s.tweaks.showFog);
  const ref = useRef<InstancedMesh>(null);

  const patches = useMemo<Patch[]>(() => {
    const rand = mulberry32(999);
    const out: Patch[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        x: (rand() - 0.5) * 2 * area,
        z: (rand() - 0.5) * 2 * area,
        phase: rand() * Math.PI * 2,
      });
    }
    return out;
  }, [count, area]);

  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#daeaf6",
        map: getFogTexture(),
        transparent: true,
        opacity,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    [opacity],
  );

  // Geometry created once so the far side of the plane faces up when laid flat.
  const geo = useMemo(() => {
    const g = new PlaneGeometry(FOG_WIDTH, FOG_HEIGHT);
    return g;
  }, []);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = performance.now() * 0.001;
    for (let i = 0; i < patches.length; i++) {
      const p = patches[i];
      p.x += DRIFT * delta;
      // Gentle vertical bob, independent phase per patch.
      const bob = Math.sin(p.phase + t * 0.3) * 0.3;
      if (p.x > area) p.x -= area * 2;
      _obj.position.set(p.x, 0.2 + Math.max(bob, 0), p.z);
      _obj.rotation.set(-Math.PI / 2, 0, 0);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mat.opacity = opacity * (1 - nightRef.current * 0.3);
  });

  if (!showFog) return null;

  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />;
}
