import { houseScale } from "./layout";
import { houseVoxels, windowVoxels, type Voxel, WINDOW_COLOR } from "./voxel";
import { MODEL_ROOF, PROJECT_PALETTE, UNKNOWN_ROOF } from "./theme";
import { houseWindowRows } from "./layered";
import type { SessionData } from "./types";

export type HouseKind = "cottage" | "house" | "mansion" | "skyscraper";

export const KIND_GEOMETRY: Record<HouseKind, { footprint: number; width: number }> = {
  cottage: { footprint: 5, width: 0.6 },
  house: { footprint: 7, width: 0.72 },
  mansion: { footprint: 9, width: 1.15 },
  skyscraper: { footprint: 5, width: 0.65 },
};

const SCALE_COTTAGE_MAX = 1.5;
const SCALE_HOUSE_MAX = 3.2;
const SCALE_MANSION_MAX = 5;

export function kindFor(scale: number): HouseKind {
  if (scale < SCALE_COTTAGE_MAX) return "cottage";
  if (scale < SCALE_HOUSE_MAX) return "house";
  if (scale < SCALE_MANSION_MAX) return "mansion";
  return "skyscraper";
}

function wallsFor(kind: HouseKind, scale: number): number {
  switch (kind) {
    case "cottage":
      return 3;
    case "house":
      return Math.min(6, 3 + Math.round((scale - SCALE_COTTAGE_MAX) * 1.2));
    case "mansion":
      return Math.min(8, 5 + Math.round((scale - SCALE_HOUSE_MAX) * 1.5));
    case "skyscraper":
      return Math.min(16, 10 + Math.round((scale - SCALE_MANSION_MAX) * 4));
  }
}

export interface HouseParams {
  scale: number;
  kind: HouseKind;
  footprint: number;
  width: number;
  walls: number;
  voxelScale: number;
  body: string;
  roof: string;
  idCode: number;
  windowRows: number;
}

export function houseParams(session: SessionData, paletteIndex: number): HouseParams {
  const scale = houseScale(session.tokensIn, session.tokensOut);
  const kind = kindFor(scale);
  const { footprint, width } = KIND_GEOMETRY[kind];
  return {
    scale,
    kind,
    footprint,
    width,
    walls: wallsFor(kind, scale),
    voxelScale: width / (footprint * 0.96),
    body: PROJECT_PALETTE[paletteIndex % PROJECT_PALETTE.length],
    roof: session.model ? (MODEL_ROOF[session.model] ?? UNKNOWN_ROOF) : UNKNOWN_ROOF,
    idCode: session.id.charCodeAt(0),
    windowRows: houseWindowRows(session.messageCount),
  };
}

function houseOptions(hp: HouseParams) {
  return {
    body: hp.body,
    roof: hp.roof,
    width: hp.footprint,
    depth: hp.footprint,
    walls: hp.walls,
    pitched: hp.kind !== "skyscraper",
    chimney: hp.kind === "mansion" ? hp.idCode % 3 === 0 : hp.idCode % 4 === 0,
    windows: hp.kind !== "cottage",
    sideWindows: hp.kind === "mansion" || hp.kind === "skyscraper",
    antenna: hp.kind === "skyscraper",
    windowRows: hp.windowRows,
  };
}

export function houseVoxelOptions(hp: HouseParams) {
  return houseOptions(hp);
}

// Full house voxels (non-window structure + window cells).
export function houseVoxelsFor(hp: HouseParams): Voxel[] {
  return houseVoxels(houseOptions(hp));
}

// Window cells only, in world space for a voxelSize-1 InstancedVoxels, so they
// land exactly on the house's facade cells (which the house scales by voxelScale).
export function houseWindowCells(hp: HouseParams, x: number, z: number): Voxel[] {
  return windowVoxels(houseOptions(hp)).map((w) => ({
    x: x + (w.x + 0.5) * hp.voxelScale - 0.5,
    y: (w.y + 0.5) * hp.voxelScale - 0.5,
    z: z + (w.z + 0.5) * hp.voxelScale - 0.5,
    color: WINDOW_COLOR,
  }));
}

// The window cells' world color key, used to strip them from the body mesh so
// the glow layer owns them.
export const WINDOW_CELL_COLOR = WINDOW_COLOR;

export interface WindowGlow {
  px: number;
  py: number;
  pz: number;
  nx: number;
  ny: number;
  nz: number;
  scale: number;
}

// Window cells with their outward-facing normal, in world space, so a glow
// quad can face the same direction as the building facade.
export function houseWindowGlows(hp: HouseParams, x: number, z: number): WindowGlow[] {
  const half = Math.floor(hp.footprint / 2);
  return windowVoxels(houseOptions(hp)).map((w) => {
    const px = x + (w.x + 0.5) * hp.voxelScale - 0.5;
    const py = (w.y + 0.5) * hp.voxelScale - 0.5;
    const pz = z + (w.z + 0.5) * hp.voxelScale - 0.5;
    let nx = 0;
    let nz = 0;
    if (w.z === half) nz = 1;
    else if (w.z === -half) nz = -1;
    else if (w.x === half) nx = 1;
    else if (w.x === -half) nx = -1;
    return { px, py, pz, nx, ny: 0, nz, scale: hp.voxelScale };
  });
}
