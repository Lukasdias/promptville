import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, type Mesh, type PointLight } from "three";
import type { Street } from "../../layout";
import type { Intersection, TrafficController } from "../../traffic";
import { trafficLightVoxels, TRAFFIC_GREEN, TRAFFIC_YELLOW, TRAFFIC_RED } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";

const LIGHT_SIZE = 0.22;
// World heights of the lens voxel centers in the blueprint (y 3/4/5).
const LAMP_Y = {
  green: 3.5 * LIGHT_SIZE,
  yellow: 4.5 * LIGHT_SIZE,
  red: 5.5 * LIGHT_SIZE,
};
// Half the sidewalk width: the light stands on the sidewalk at the corner.
const SIDEWALK_CENTER = 0.35;
const ROAD_HALF = 1.75;

// Radial additive glow, billboarded toward the camera. This is the "shader" part
// of the signal — a soft light bloom on the active lens.
function GlowPlane({
  y,
  color,
  activeRef,
}: {
  y: number;
  color: string;
  activeRef: { current: boolean };
}) {
  const mesh = useRef<Mesh>(null);

  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    m.quaternion.copy(camera.quaternion);
    m.visible = activeRef.current;
  });

  return (
    <mesh ref={mesh} position={[0, y, 0]} scale={[0.8, 0.8, 0.8]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={{ uColor: { value: new Color(color) } }}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float a = smoothstep(1.0, 0.0, d);
            a *= a;
            gl_FragColor = vec4(uColor, a * 0.9);
          }
        `}
      />
    </mesh>
  );
}

function TrafficLight({
  controller,
  intersection,
  streets,
}: {
  controller: TrafficController;
  intersection: Intersection;
  streets: Street[];
}) {
  const lightRef = useRef<PointLight>(null);

  const greenActive = useRef(false);
  const yellowActive = useRef(false);
  const redActive = useRef(false);

  // Stand on the sidewalk at the corner: offset from the crossing centerlines.
  const avenue = streets.find((s) => s.width >= s.depth && Math.abs(s.z - intersection.z) < 0.01);
  const vertical = streets.find((s) => s.width < s.depth && Math.abs(s.x - intersection.x) < 0.01);
  const offsetX = (vertical?.width ?? ROAD_HALF * 2) / 2 + SIDEWALK_CENTER;
  const offsetZ = (avenue?.depth ?? ROAD_HALF * 2) / 2 + SIDEWALK_CENTER;

  useFrame(() => {
    const color = controller.signalColorFor(intersection.id);
    const green = color === "green";
    const yellow = color === "yellow";
    const red = color === "red";

    greenActive.current = green;
    yellowActive.current = yellow;
    redActive.current = red;

    if (lightRef.current) {
      const glow = green ? TRAFFIC_GREEN : yellow ? TRAFFIC_YELLOW : TRAFFIC_RED;
      lightRef.current.color.set(glow);
      lightRef.current.intensity = green ? 1.4 : 0.4;
      lightRef.current.position.y = green ? LAMP_Y.green : yellow ? LAMP_Y.yellow : LAMP_Y.red;
    }
  });

  return (
    <group position={[intersection.x + offsetX, 0, intersection.z + offsetZ]}>
      <InstancedVoxels voxels={trafficLightVoxels()} voxelSize={LIGHT_SIZE} />
      <GlowPlane y={LAMP_Y.green} color={TRAFFIC_GREEN} activeRef={greenActive} />
      <GlowPlane y={LAMP_Y.yellow} color={TRAFFIC_YELLOW} activeRef={yellowActive} />
      <GlowPlane y={LAMP_Y.red} color={TRAFFIC_RED} activeRef={redActive} />
      <pointLight ref={lightRef} distance={6} decay={2} />
    </group>
  );
}

export function TrafficLights({
  controller,
  intersections,
  streets,
}: {
  controller: TrafficController;
  intersections: Intersection[];
  streets: Street[];
}) {
  useFrame((_, delta) => controller.tick(delta));
  return (
    <group>
      {intersections.map((it) => (
        <TrafficLight key={it.id} controller={controller} intersection={it} streets={streets} />
      ))}
    </group>
  );
}