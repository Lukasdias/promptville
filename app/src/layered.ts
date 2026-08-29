import { HOUSE_PAD, HOUSE_SPACING } from "./layout";
import { PROJECT_PALETTE } from "./theme";

export const LANDMARK_MIN_H = 3;
export const LANDMARK_MAX_H = 16;
export const LANDMARK_SCALE_PER_DECADE = 2;

export const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;

const WORKSHOP_COLORS: Record<string, string> = {
  edit: "#7fb6ff",
  bash: "#3ddc64",
  read: "#ffd24a",
  write: "#ff8fa3",
  grep: "#d4baff",
  get: "#b0e0ff",
};

export function landmarkHeight(cost: number): number {
  if (cost <= 0) return LANDMARK_MIN_H;
  const h = LANDMARK_MIN_H + Math.log10(1 + cost) * LANDMARK_SCALE_PER_DECADE;
  return Math.max(LANDMARK_MIN_H, Math.min(LANDMARK_MAX_H, Math.round(h)));
}

export function parkSize(todoCount: number): number {
  if (todoCount <= 0) return 0;
  return Math.min(6, 2 + Math.round(Math.log10(1 + todoCount)));
}

export function workshopSpots(
  toolNames: string[],
  block: { x: number; z: number; width: number; depth: number },
): { x: number; z: number; tool: string }[] {
  const spots: { x: number; z: number; tool: string }[] = [];
  const frontZ = block.z + block.depth / 2 - HOUSE_PAD - HOUSE_SPACING / 2;
  for (let i = 0; i < toolNames.length; i++) {
    const offset = (i - (toolNames.length - 1) / 2) * HOUSE_SPACING;
    spots.push({ x: block.x + offset, z: frontZ, tool: toolNames[i] });
  }
  return spots;
}

export function workshopColor(tool: string): string {
  return WORKSHOP_COLORS[tool] ?? PROJECT_PALETTE[Math.abs(hash(tool)) % PROJECT_PALETTE.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function houseWindowRows(messageCount: number): number {
  return messageCount > 12 ? 2 : 1;
}

export function heavyChange(patchCount: number, additions: number): boolean {
  return patchCount >= 5 || additions >= 150;
}

export function activeCitizen(timeUpdated: number, now: number): boolean {
  return now - timeUpdated <= ACTIVE_WINDOW_MS;
}
