import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial, type Mesh } from "three";
import type { Intersection, TrafficController } from "../../traffic";
import { trafficLightVoxels, TRAFFIC_GREEN, TRAFFIC_RED } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";

const LIGHT_SIZE = 0.22;

function TrafficLight({
  controller,
  intersection,
}: {
  controller: TrafficController;
  intersection: Intersection;
}) {
  const lampMat = useRef<MeshStandardMaterial>(null);

  useFrame(() => {
    const mat = lampMat.current;
    if (!mat) return;
    const color = controller.greenFor(intersection.id, "x") ? TRAFFIC_GREEN : TRAFFIC_RED;
    mat.color.set(color);
    mat.emissive.set(color);
  });

  return (
    <group position={[intersection.x, 0, intersection.z]}>
      <InstancedVoxels voxels={trafficLightVoxels()} voxelSize={LIGHT_SIZE} />
      <mesh position={[0, LIGHT_SIZE * 4.5, 0]}>
        <boxGeometry args={[LIGHT_SIZE * 0.72, LIGHT_SIZE * 0.72, LIGHT_SIZE * 0.72]} />
        <meshStandardMaterial ref={lampMat} emissiveIntensity={0.7} color={TRAFFIC_GREEN} />
      </mesh>
    </group>
  );
}

export function TrafficLights({
  controller,
  intersections,
}: {
  controller: TrafficController;
  intersections: Intersection[];
}) {
  useFrame((_, delta) => controller.tick(delta));
  return (
    <group>
      {intersections.map((it) => (
        <TrafficLight key={it.id} controller={controller} intersection={it} />
      ))}
    </group>
  );
}