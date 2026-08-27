import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { BoxGeometry, Color, InstancedMesh, Object3D } from "three";
import type { Voxel } from "../../voxel";

// Shared unit cube — created once, reused by every instanced voxel mesh.
const VOXEL_GEO = new BoxGeometry(0.96, 0.96, 0.96);
const _obj = new Object3D();
const _color = new Color();

interface InstancedVoxelsProps {
  voxels: Voxel[];
  voxelSize?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}

export function InstancedVoxels({
  voxels,
  voxelSize = 1,
  onClick,
  onPointerOver,
  onPointerOut,
}: InstancedVoxelsProps) {
  const ref = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => {
    if (voxelSize === 1) return VOXEL_GEO;
    const s = 0.96 * voxelSize;
    return new BoxGeometry(s, s, s);
  }, [voxelSize]);

  const data = useMemo(() => {
    const positions: [number, number, number][] = [];
    const colors: string[] = [];
    for (const v of voxels) {
      positions.push([(v.x + 0.5) * voxelSize, (v.y + 0.5) * voxelSize, (v.z + 0.5) * voxelSize]);
      colors.push(v.color);
    }
    return { positions, colors };
  }, [voxels, voxelSize]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < data.positions.length; i++) {
      _obj.position.set(data.positions[i][0], data.positions[i][1], data.positions[i][2]);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
      _color.set(data.colors[i]);
      mesh.setColorAt(i, _color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [data, voxelSize]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, voxels.length]}
      castShadow
      receiveShadow
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <meshStandardMaterial flatShading />
    </instancedMesh>
  );
}