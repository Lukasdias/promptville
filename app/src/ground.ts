import type { Bounds } from "./layout";

export const PAD_MARGIN = 8;
export const HILL_MAX = 5;
export const HILL_RAMP = 40;

export interface PadRect {
  cx: number;
  cz: number;
  halfX: number;
  halfZ: number;
}

export function cityPad(bounds: Bounds, margin: number): PadRect {
  return {
    cx: (bounds.minX + bounds.maxX) / 2,
    cz: (bounds.minZ + bounds.maxZ) / 2,
    halfX: (bounds.maxX - bounds.minX) / 2 + margin,
    halfZ: (bounds.maxZ - bounds.minZ) / 2 + margin,
  };
}

export function padOvershoot(px: number, pz: number, pad: PadRect): number {
  const dx = Math.max(0, Math.abs(px - pad.cx) - pad.halfX);
  const dz = Math.max(0, Math.abs(pz - pad.cz) - pad.halfZ);
  return Math.hypot(dx, dz);
}

export function hillHeight(overshoot: number, maxHill: number = HILL_MAX, ramp: number = HILL_RAMP): number {
  if (overshoot <= 0) return 0;
  const t = Math.min(1, overshoot / ramp);
  return maxHill * t * t * (3 - 2 * t);
}
