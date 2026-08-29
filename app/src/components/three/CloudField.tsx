import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Cloud } from "@react-three/drei";
import { type Group, type InstancedMesh, type MeshLambertMaterial } from "three";
import { mulberry32 } from "../../rand";
import { useApp } from "../../store";

const CLOUD_COUNT = 9;
// A cloud fades in, drifts across the whole town, fades out, then idles
// (hidden) before respawning at the far edge. This keeps the sky alive without
// clouds ever popping into view.
const FADE_IN = 0.18; // fraction of a cloud's active travel spent fading in
const FADE_OUT = 0.18; // fraction spent fading out

interface Cycle {
  life: number;
  travel: number; // seconds active (on-screen)
  idle: number; // seconds hidden before respawn
  y: number;
  z: number;
  scale: number;
  baseOpacity: number;
  speed: number;
}

// Smoothstep, C1-continuous: zero velocity at both ends, so a fade never snaps.
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// Read the cloud's material so we can drive its opacity every frame. drei's own
// `opacity` prop is only applied on re-render; mutating material.opacity here
// gives a smooth, render-loop-driven fade.
function readMaterial(el: Group | null): MeshLambertMaterial | null {
  if (!el) return null;
  let mat: MeshLambertMaterial | null = null;
  el.traverse((o) => {
    const m = o as InstancedMesh;
    if (m.isInstancedMesh) mat = m.material as MeshLambertMaterial;
  });
  return mat;
}

export function CloudField({ extent }: { extent: number }) {
  const showClouds = useApp((s) => s.tweaks.showClouds);
  const span = extent; // clouds travel from -span to +span, covering the village
  const group = useRef<Group>(null);
  const mats = useRef<(MeshLambertMaterial | null)[]>([]);

  const cycles = useMemo<Cycle[]>(() => {
    const rand = mulberry32(6001);
    const out: Cycle[] = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const travel = 26 + rand() * 28; // active seconds
      out.push({
        life: rand() * 200, // stagger the start so clouds aren't synchronized
        travel,
        idle: rand() * 16, // sometimes on screen, sometimes gone
        y: 11 + rand() * 6,
        z: (rand() - 0.5) * 2 * span,
        scale: 0.7 + rand() * 0.9,
        baseOpacity: 0.6 + rand() * 0.35,
        speed: (span * 2) / travel, // units/sec, derived from travel time
      });
    }
    return out;
  }, [span]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    for (let i = 0; i < cycles.length; i++) {
      const c = cycles[i];
      c.life += delta;
      const total = c.travel + c.idle;
      const cycle = c.life % total;

      let opacity = 0;
      let p = 0;
      if (cycle < c.travel) {
        // Active: slide across the full span with a fade-in/out envelope.
        p = cycle / c.travel;
        const x = -span + p * 2 * span;
        if (p < FADE_IN) {
          opacity = c.baseOpacity * smoothstep(p / FADE_IN);
        } else if (p > 1 - FADE_OUT) {
          opacity = c.baseOpacity * smoothstep((1 - p) / FADE_OUT);
        } else {
          opacity = c.baseOpacity;
        }
        const el = g.children[i];
        if (el) el.position.set(x, c.y, c.z);
      } else {
        // Idle: parked at the spawn edge but fully transparent, so the respawn
        // into the fade-in is seamless.
        opacity = 0;
        const el = g.children[i];
        if (el) el.position.set(-span, c.y, c.z);
      }

      const mat = mats.current[i] ?? (mats.current[i] = readMaterial(g.children[i] as Group));
      if (mat) mat.opacity = opacity;
    }
  });

  if (!showClouds) return null;

  return (
    <group ref={group}>
      {cycles.map((c, i) => (
        <Cloud
          key={i}
          position={[-span, c.y, c.z]}
          speed={Math.max(0.25, c.speed * 0.1)}
          opacity={0}
          scale={c.scale}
          fade={100}
        />
      ))}
    </group>
  );
}
