import type { PlacedBlock } from "./layout";
import type { ProjectData, SessionData } from "./types";

export const PITCH = (55 * Math.PI) / 180;
export const YAW_STEP = Math.PI / 4;
export const MIN_DISTANCE = 8;
export const MAX_DISTANCE = 80;
export const MIN_CAM_HEIGHT = 3;
export const DEFAULT_YAW = 0;
export const DEFAULT_DISTANCE = 32;
export const DEFAULT_EXTENT = 40;
export const EDGE_MARGIN = 24;
export const DRAG_THRESHOLD = 5;

export interface CameraState {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  distance: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

export const DEFAULT_CAMERA: CameraState = {
  x: 0,
  z: 0,
  yaw: DEFAULT_YAW,
  pitch: PITCH,
  distance: DEFAULT_DISTANCE,
};

export function computePosition(s: CameraState): { x: number; y: number; z: number } {
  const sinP = Math.sin(s.pitch);
  return {
    x: s.x + s.distance * sinP * Math.sin(s.yaw),
    y: Math.max(s.distance * Math.cos(s.pitch), MIN_CAM_HEIGHT),
    z: s.z + s.distance * sinP * Math.cos(s.yaw),
  };
}

export function clampState(s: CameraState, extent: number): CameraState {
  const maxR = Math.max(DEFAULT_EXTENT, extent);
  const r = Math.hypot(s.x, s.z);
  const scale = r > maxR ? maxR / r : 1;
  return {
    ...s,
    x: s.x * scale,
    z: s.z * scale,
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, s.distance)),
  };
}

export function panDelta(s: CameraState, sx: number, sz: number): Vec2 {
  const c = Math.cos(s.yaw);
  const si = Math.sin(s.yaw);
  return {
    x: sx * c - sz * si,
    z: -sx * si - sz * c,
  };
}

export function nudgeYaw(yaw: number, dir: 1 | -1): number {
  const next = yaw + dir * YAW_STEP;
  return ((next % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

export function zoomBy(distance: number, factor: number): number {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance * factor));
}

export function focusTargetFor(
  blocks: PlacedBlock[],
  projects: ProjectData[],
  selected: SessionData | null,
): Vec2 {
  if (!selected) return { x: 0, z: 0 };
  for (const block of blocks) {
    const project = projects.find((p) => p.id === block.projectId);
    if (!project) continue;
    const index = project.sessions.findIndex((s) => s.id === selected.id);
    if (index >= 0 && block.houses[index]) {
      return { x: block.houses[index].x, z: block.houses[index].z };
    }
  }
  return { x: 0, z: 0 };
}