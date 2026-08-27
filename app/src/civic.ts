import type { PlacedBlock, Street } from "./layout";
import type { BuildingKind } from "./types";
import type { RoadGraph } from "./roadgraph";

export const BUILDING_SIZE = 0.4;

export const BUILDING_LAYOUT: Record<BuildingKind, { footprint: number; walls: number }> = {
  hospital: { footprint: 7, walls: 4 },
  police: { footprint: 7, walls: 4 },
  fire: { footprint: 7, walls: 4 },
  mall: { footprint: 9, walls: 3 },
  bakery: { footprint: 5, walls: 3 },
  petshop: { footprint: 5, walls: 3 },
};

export const BUILDING_META: Record<BuildingKind, { name: string; emoji: string; services: string[] }> = {
  hospital: { name: "Hospital", emoji: "🏥", services: ["24h emergency", "clinic", "pharmacy"] },
  police: { name: "Police Station", emoji: "👮", services: ["patrol", "records", "lost & found"] },
  fire: { name: "Fire Station", emoji: "🚒", services: ["rescue", "inspection", "first aid"] },
  mall: { name: "Shopping Mall", emoji: "🛍️", services: ["shops", "food court", "cinema"] },
  bakery: { name: "Bakery", emoji: "🥐", services: ["bread", "pastries", "coffee"] },
  petshop: { name: "Pet Shop", emoji: "🐾", services: ["pets", "grooming", "food"] },
};

export interface BuildingLot {
  kind: BuildingKind;
  x: number;
  z: number;
  rotation: 0 | 1 | 2 | 3;
  footprint: number;
  entrance: { x: number; z: number };
  curb: { x: number; z: number };
}

export interface VisitorPath {
  from: { x: number; z: number };
  waypoints: { x: number; z: number }[];
  to: { x: number; z: number };
}

export interface CivicDistrict {
  plaza: { x: number; z: number; width: number; depth: number };
  lots: BuildingLot[];
  visitorPaths: VisitorPath[];
}

const LOT_SETBACK = 3;
const SIDE_OFFSET = 4.5;
const SIDEWALK_CENTER = 0.35;
const WALK_BACK = 6;

interface RawLot {
  kind: BuildingKind;
  x: number;
  z: number;
  rotation: 0 | 1 | 2 | 3;
  footprint: number;
}

function frontDir(rotation: 0 | 1 | 2 | 3): { x: number; z: number } {
  switch (rotation) {
    case 0: return { x: 0, z: 1 };
    case 1: return { x: 1, z: 0 };
    case 2: return { x: 0, z: -1 };
    default: return { x: -1, z: 0 };
  }
}

function borderingStreet(
  lot: RawLot,
  plaza: { x: number; z: number; width: number; depth: number },
  streets: Street[],
): Street | null {
  const f = frontDir(lot.rotation);
  const d = { x: -f.x, z: -f.z };
  if (d.z !== 0) {
    const boundary = d.z === -1 ? plaza.z - plaza.depth / 2 : plaza.z + plaza.depth / 2;
    const h = streets.filter((s) => s.width >= s.depth);
    if (d.z === -1) return h.filter((s) => s.z < boundary).sort((a, b) => b.z - a.z)[0] ?? null;
    return h.filter((s) => s.z > boundary).sort((a, b) => a.z - b.z)[0] ?? null;
  }
  const boundary = d.x === -1 ? plaza.x - plaza.width / 2 : plaza.x + plaza.width / 2;
  const v = streets.filter((s) => s.width < s.depth);
  if (d.x === -1) return v.filter((s) => s.x < boundary).sort((a, b) => b.x - a.x)[0] ?? null;
  return v.filter((s) => s.x > boundary).sort((a, b) => a.x - b.x)[0] ?? null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function curbPoint(lot: RawLot, street: Street): { x: number; z: number } {
  if (street.width >= street.depth) {
    return { x: clamp(lot.x, street.x - street.width / 2, street.x + street.width / 2), z: street.z };
  }
  return { x: street.x, z: clamp(lot.z, street.z - street.depth / 2, street.z + street.depth / 2) };
}

function entrancePoint(lot: RawLot): { x: number; z: number } {
  const f = frontDir(lot.rotation);
  const reach = lot.footprint * BUILDING_SIZE * 0.5 + 0.3;
  return { x: lot.x + f.x * reach, z: lot.z + f.z * reach };
}

function visitorPath(lot: RawLot, street: Street): VisitorPath {
  const horizontal = street.width >= street.depth;
  const f = frontDir(lot.rotation);
  const b: { x: number; z: number } = horizontal
    ? {
        x: clamp(lot.x, street.x - street.width / 2, street.x + street.width / 2),
        z: street.z + f.z * (street.depth / 2 + SIDEWALK_CENTER),
      }
    : {
        x: street.x + f.x * (street.width / 2 + SIDEWALK_CENTER),
        z: clamp(lot.z, street.z - street.depth / 2, street.z + street.depth / 2),
      };
  const a = horizontal ? { x: b.x - WALK_BACK, z: b.z } : { x: b.x, z: b.z - WALK_BACK };
  const c = entrancePoint(lot);
  return { from: a, waypoints: [b, c], to: a };
}

export function layoutCivicDistrict(plazaBlock: PlacedBlock, streets: Street[], graph: RoadGraph): CivicDistrict {
  const plaza = { x: plazaBlock.x, z: plazaBlock.z, width: plazaBlock.width, depth: plazaBlock.depth };
  const { x: px, z: pz, width, depth } = plaza;
  const topZ = pz - depth / 2 + LOT_SETBACK;
  const bottomZ = pz + depth / 2 - LOT_SETBACK;
  const leftX = px - width / 2 + LOT_SETBACK;
  const rightX = px + width / 2 - LOT_SETBACK;

  const rawLots: RawLot[] = [
    { kind: "hospital", x: px - SIDE_OFFSET, z: topZ, rotation: 0, footprint: BUILDING_LAYOUT.hospital.footprint },
    { kind: "bakery", x: px + SIDE_OFFSET, z: topZ, rotation: 0, footprint: BUILDING_LAYOUT.bakery.footprint },
    { kind: "police", x: px - SIDE_OFFSET, z: bottomZ, rotation: 2, footprint: BUILDING_LAYOUT.police.footprint },
    { kind: "petshop", x: px + SIDE_OFFSET, z: bottomZ, rotation: 2, footprint: BUILDING_LAYOUT.petshop.footprint },
    { kind: "fire", x: leftX, z: pz, rotation: 1, footprint: BUILDING_LAYOUT.fire.footprint },
    { kind: "mall", x: rightX, z: pz, rotation: 3, footprint: BUILDING_LAYOUT.mall.footprint },
  ];

  const lots: BuildingLot[] = rawLots.map((r) => {
    const street = borderingStreet(r, plaza, streets);
    return {
      ...r,
      entrance: entrancePoint(r),
      curb: street ? curbPoint(r, street) : { x: r.x, z: r.z },
    };
  });

  const visitorPaths = lots.map((lot) => {
    const street = borderingStreet(lot, plaza, streets);
    return street ? visitorPath(lot, street) : { from: lot.entrance, waypoints: [lot.entrance], to: lot.entrance };
  });

  return { plaza, lots, visitorPaths };
}