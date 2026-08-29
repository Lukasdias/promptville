import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, ShaderMaterial } from "three";
import type { Material, Mesh, Points } from "three";
import { clockRef, nightRef } from "../../night";
import { moonDirection, sunDirection } from "../../daynight";
import { mulberry32 } from "../../rand";

const SKY_RADIUS_FACTOR = 1.5;
const STAR_COUNT = 600;
const STAR_OPACITY_MAX = 0.9;
const SUN_DISC_R = 6;
const MOON_DISC_R = 4;
const DISC_SEGMENTS = 24;

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const frag = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(h, 0.8));
    float sunGlow = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 24.0);
    col += uSunColor * sunGlow * (1.0 - uNight * 0.7);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const skyUniforms = {
  uTop: { value: new Color("#5fa8ff") },
  uHorizon: { value: new Color("#bfe6ff") },
  uSunDir: { value: new Color(0, 1, 0) },
  uSunColor: { value: new Color("#fff4d6") },
  uNight: { value: 0 },
};

export function Sky({ extent }: { extent: number }) {
  const sunRef = useRef<Mesh>(null);
  const moonRef = useRef<Mesh>(null);
  const starsRef = useRef<Points>(null);

  const radius = extent * SKY_RADIUS_FACTOR;
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: skyUniforms,
        side: BackSide,
        depthWrite: false,
      }),
    [],
  );

  const starPositions = useMemo(() => {
    const rand = mulberry32(9001);
    const pts = new Float32Array(STAR_COUNT * 3);
    const r = radius * 0.98;
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 0.85);
      pts[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
      pts[i * 3 + 1] = Math.cos(phi) * r;
      pts[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    }
    return pts;
  }, [radius]);

  useFrame(() => {
    const t = clockRef.current;
    const sun = sunDirection(t);
    const moon = moonDirection(t);
    if (sunRef.current) sunRef.current.position.set(sun.x * radius, sun.y * radius, sun.z * radius);
    if (moonRef.current) moonRef.current.position.set(moon.x * radius, moon.y * radius, moon.z * radius);
    const starsMat = starsRef.current?.material as Material & { opacity: number } | undefined;
    if (starsMat) starsMat.opacity = nightRef.current * STAR_OPACITY_MAX;
  });

  return (
    <group>
      <mesh material={material} frustumCulled={false}>
        <sphereGeometry args={[radius, 32, 32]} />
      </mesh>
      <mesh ref={sunRef} frustumCulled={false}>
        <circleGeometry args={[SUN_DISC_R, DISC_SEGMENTS]} />
        <meshBasicMaterial color="#fff4d6" toneMapped={false} />
      </mesh>
      <mesh ref={moonRef} frustumCulled={false}>
        <circleGeometry args={[MOON_DISC_R, DISC_SEGMENTS]} />
        <meshBasicMaterial color="#d8dcf0" toneMapped={false} />
      </mesh>
      <points ref={starsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.4} sizeAttenuation={false} color="#ffffff" transparent opacity={0} />
      </points>
    </group>
  );
}
