import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from "three";
import { mulberry32 } from "../../rand";
import { useApp } from "../../store";
import { nightRef } from "../../night";

const AREA = 30; // half-extent of the rain volume
const HEIGHT = 18; // vertical span particles respawn into
const WIND_X = 1.6; // world units / second lateral drift
const WIND_Z = 0.4;
const STREAK_LEN = 1.0; // each drop is a thin 1-unit-tall streak
const _obj = new Object3D();
// Shared thin streak — one geometry for all drops.
const RAIN_GEO = new BoxGeometry(0.009, STREAK_LEN, 0.009);

interface Drop {
  x: number;
  y: number;
  z: number;
  speed: number;
}

export function Rain({
  count = 900,
  opacity = 0.28,
  area = AREA,
  height = HEIGHT,
}: {
  count?: number;
  opacity?: number;
  area?: number;
  height?: number;
}) {
  const showRain = useApp((s) => s.tweaks.showRain);
  const ref = useRef<InstancedMesh>(null);

  // Deterministic drop placement + per-drop fall speed. Never Math.random().
  const drops = useMemo<Drop[]>(() => {
    const rand = mulberry32(777);
    const out: Drop[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        x: (rand() - 0.5) * 2 * area,
        y: rand() * height,
        z: (rand() - 0.5) * 2 * area,
        speed: 9 + rand() * 6,
      });
    }
    return out;
  }, [count, area, height]);

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#9fc9e8",
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
      }),
    [opacity],
  );

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dropsArr = drops;
    for (let i = 0; i < dropsArr.length; i++) {
      const d = dropsArr[i];
      d.y -= d.speed * delta;
      d.x += WIND_X * delta;
      d.z += WIND_Z * delta;
      // Toroidal wrap around the volume so the field never thins out.
      if (d.y < 0) d.y += height;
      if (d.x > area) d.x -= area * 2;
      else if (d.x < -area) d.x += area * 2;
      if (d.z > area) d.z -= area * 2;
      else if (d.z < -area) d.z += area * 2;
      _obj.position.set(d.x, d.y, d.z);
      // Tilt the streak with the wind so it reads as falling, not frozen.
      _obj.rotation.set(WIND_Z * 0.02, 0, -WIND_X * 0.02);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    material.opacity = opacity * (1 - nightRef.current * 0.2);
  });

  if (!showRain) return null;

  return <instancedMesh ref={ref} args={[RAIN_GEO, material, count]} frustumCulled={false} />;
}
