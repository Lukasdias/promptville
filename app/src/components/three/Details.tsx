import { useMemo } from "react";
import type { PlacedBlock, Street } from "../../layout";
import { environment } from "../../config";
import { useApp } from "../../store";
import { findIntersections } from "../../traffic";
import {
  benchVoxels,
  bushVoxels,
  coneVoxels,
  flowersVoxels,
  fountainVoxels,
  hydrantVoxels,
  mailboxVoxels,
  placeVoxels,
  signVoxels,
  type Voxel,
} from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { isClearSpot, mulberry32, pickParkSpot } from "../../placement";

const BUSH_SIZE = 0.22;
const FLOWER_SIZE = 0.18;
const MAILBOX_SIZE = 0.18;
const SIGN_SIZE = 0.2;
const BENCH_SIZE = 0.2;
const FOUNTAIN_SIZE = 0.2;
const HYDRANT_SIZE = 0.16;
const CONE_SIZE = 0.16;

function cityBounds(blocks: PlacedBlock[]) {
  const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
  const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
  const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2));
  const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2));
  return { minX, maxX, minZ, maxZ };
}

interface DetailSets {
  bushes: Voxel[];
  flowers: Voxel[];
  mailboxes: Voxel[];
  signs: Voxel[];
  benches: Voxel[];
  fountain: Voxel[];
  hydrants: Voxel[];
  cones: Voxel[];
}

export function Details({ blocks, streets }: { blocks: PlacedBlock[]; streets: Street[] }) {
  const showScenery = useApp((s) => s.tweaks.showScenery);
  const sets = useMemo<DetailSets>(() => {
    if (blocks.length === 0) {
      return { bushes: [], flowers: [], mailboxes: [], signs: [], benches: [], fountain: [], hydrants: [], cones: [] };
    }
    const rand = mulberry32(2024);
    const { minX, maxX, minZ, maxZ } = cityBounds(blocks);
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const spread = Math.max(maxX - minX, maxZ - minZ) / 2 + 8;
    const park = pickParkSpot(blocks, minX, maxX, minZ, maxZ);

    const placeScattered = (count: number, pad: number): { x: number; z: number }[] => {
      const out: { x: number; z: number }[] = [];
      for (let i = 0; out.length < count && i < 400; i++) {
        const x = cx + (rand() - 0.5) * 2 * spread;
        const z = cz + (rand() - 0.5) * 2 * spread;
        if (!isClearSpot(x, z, blocks, streets, pad)) continue;
        out.push({ x, z });
      }
      return out;
    };

    const bushes: Voxel[] = [];
    for (const p of placeScattered(environment.bushes, 0.7)) {
      for (const v of placeVoxels(bushVoxels(), p.x, p.z, BUSH_SIZE)) bushes.push(v);
    }

    const flowers: Voxel[] = [];
    const flowerSpots = placeScattered(environment.flowers, 0.8);
    if (park) flowerSpots.push({ x: park.x + 4.5, z: park.z - 4 }, { x: park.x - 4, z: park.z + 3.5 });
    for (const p of flowerSpots) {
      for (const v of placeVoxels(flowersVoxels(), p.x, p.z, FLOWER_SIZE)) flowers.push(v);
    }

    const mailboxes: Voxel[] = [];
    for (const p of placeScattered(environment.mailboxes, 0.8)) {
      for (const v of placeVoxels(mailboxVoxels(), p.x, p.z, MAILBOX_SIZE)) mailboxes.push(v);
    }

    // Street-name signs at intersection corners, not in the middle of the road.
    const signs: Voxel[] = [];
    for (const it of findIntersections(streets)) {
      const corner = { x: it.x + 0.9, z: it.z + 0.9 };
      for (const v of placeVoxels(signVoxels(), corner.x, corner.z, SIGN_SIZE)) signs.push(v);
    }

    const benches: Voxel[] = [];
    if (park) {
      const angles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
      for (const a of angles) {
        const bx = park.x + Math.cos(a) * 4.2;
        const bz = park.z + Math.sin(a) * 4.2;
        for (const v of placeVoxels(benchVoxels(), bx, bz, BENCH_SIZE)) benches.push(v);
      }
    }

    const fountain: Voxel[] = park
      ? placeVoxels(fountainVoxels(), park.x, park.z, FOUNTAIN_SIZE)
      : [];

    const hydrants: Voxel[] = [];
    for (const p of placeScattered(environment.hydrants, 0.6)) {
      for (const v of placeVoxels(hydrantVoxels(), p.x, p.z, HYDRANT_SIZE)) hydrants.push(v);
    }

    const cones: Voxel[] = [];
    for (let i = 0; i < environment.cones && streets.length > 0; i++) {
      const s = streets[(i * 3) % streets.length]!;
      const horizontal = s.width >= s.depth;
      const offset = 0.55;
      const x = horizontal ? s.x + (rand() - 0.5) * (s.width - 2) : s.x + offset;
      const z = horizontal ? s.z + offset : s.z + (rand() - 0.5) * (s.depth - 2);
      for (const v of placeVoxels(coneVoxels(), x, z, CONE_SIZE)) cones.push(v);
    }

    return { bushes, flowers, mailboxes, signs, benches, fountain, hydrants, cones };
  }, [blocks, streets]);

  if (!showScenery) return null;

  return (
    <group>
      <InstancedVoxels voxels={sets.bushes} voxelSize={BUSH_SIZE} />
      <InstancedVoxels voxels={sets.flowers} voxelSize={FLOWER_SIZE} />
      <InstancedVoxels voxels={sets.mailboxes} voxelSize={MAILBOX_SIZE} />
      <InstancedVoxels voxels={sets.signs} voxelSize={SIGN_SIZE} />
      <InstancedVoxels voxels={sets.benches} voxelSize={BENCH_SIZE} />
      <InstancedVoxels voxels={sets.fountain} voxelSize={FOUNTAIN_SIZE} />
      <InstancedVoxels voxels={sets.hydrants} voxelSize={HYDRANT_SIZE} />
      <InstancedVoxels voxels={sets.cones} voxelSize={CONE_SIZE} />
    </group>
  );
}