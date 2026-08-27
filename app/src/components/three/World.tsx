import { useMemo } from "react";
import { Cloud, Float } from "@react-three/drei";
import { COLORS } from "../../theme";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function World() {
  const rand = useMemo(() => mulberry32(1337), []);
  const trees = useMemo(
    () =>
      Array.from({ length: 60 }, () => ({
        x: (rand() - 0.5) * 60,
        z: (rand() - 0.5) * 60,
        s: 0.6 + rand() * 0.7,
        skip: rand() < 0.18, // leave some open lawn
      })).filter((t) => !t.skip),
    [rand],
  );

  const lamps = useMemo(
    () =>
      Array.from({ length: 10 }, () => ({
        x: (rand() - 0.5) * 56,
        z: (rand() - 0.5) * 56,
      })),
    [rand],
  );

  return (
    <group>
      <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.4}>
        <Cloud position={[-14, 12, -18]} speed={0.4} opacity={0.9} />
        <Cloud position={[10, 15, -6]} speed={0.3} opacity={0.85} />
        <Cloud position={[22, 11, 8]} speed={0.5} opacity={0.8} />
      </Float>

      {/* Trees */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh castShadow position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.09, 0.12, 0.7, 6]} />
            <meshStandardMaterial color="#8b5a2b" />
          </mesh>
          <mesh castShadow position={[0, 1.15, 0]}>
            <coneGeometry args={[0.55, 1.1, 7]} />
            <meshStandardMaterial color={COLORS.grassDark} />
          </mesh>
        </group>
      ))}

      {/* Street lamps */}
      {lamps.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]}>
          <mesh castShadow position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 1.5, 6]} />
            <meshStandardMaterial color="#5a5a5a" />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial emissive="#ffd98a" color="#ffe9b3" />
          </mesh>
        </group>
      ))}
    </group>
  );
}