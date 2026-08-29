import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import type { InstancedMesh } from "three";
import { useNeighborhood } from "../../query";
import { useCity } from "../../city";
import { houseParams, houseWindowGlows, type WindowGlow } from "../../house";
import { GLOW_MAX } from "../../theme";
import { nightRef } from "../../night";

const GLOW_SCALE = 2.2;
const GLOW_COLOR = "#ffb36b";
const Z_AXIS = new Vector3(0, 0, 1);

const glowVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const glowFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    a *= a;
    gl_FragColor = vec4(uColor, a * uIntensity);
  }
`;

export function LitWindows() {
  const { data } = useNeighborhood();
  const { blocks } = useCity();
  const glowRef = useRef<InstancedMesh>(null);

  const glows = useMemo<WindowGlow[]>(() => {
    const out: WindowGlow[] = [];
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b];
      if (block.kind === "plaza") continue;
      const project = data?.projects.find((p) => p.id === block.projectId);
      if (!project) continue;
      block.houses.forEach((slot) => {
        const session = project.sessions[slot.index];
        if (!session) return;
        const hp = houseParams(session, b);
        out.push(...houseWindowGlows(hp, slot.x, slot.z));
      });
    }
    return out;
  }, [blocks, data]);

  const glowGeometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const glowMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color(GLOW_COLOR) }, uIntensity: { value: 0 } },
        vertexShader: glowVert,
        fragmentShader: glowFrag,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = glowRef.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scl = new Vector3();
    glows.forEach((g, i) => {
      pos.set(g.px, g.py, g.pz);
      q.setFromUnitVectors(Z_AXIS, new Vector3(g.nx, g.ny, g.nz));
      scl.set(g.scale * GLOW_SCALE, g.scale * GLOW_SCALE, 1);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [glows]);

  useFrame(() => {
    glowMaterial.uniforms.uIntensity.value = nightRef.current * GLOW_MAX;
  });

  if (glows.length === 0) return null;

  return (
    <instancedMesh ref={glowRef} args={[glowGeometry, glowMaterial, glows.length]} frustumCulled={false} />
  );
}
