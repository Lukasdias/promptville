export const LANDMARK_MIN_H = 3;
export const LANDMARK_MAX_H = 16;
export const LANDMARK_SCALE_PER_DECADE = 2;

export const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function landmarkHeight(cost: number): number {
  if (cost <= 0) return LANDMARK_MIN_H;
  const h = LANDMARK_MIN_H + Math.log10(1 + cost) * LANDMARK_SCALE_PER_DECADE;
  return Math.max(LANDMARK_MIN_H, Math.min(LANDMARK_MAX_H, Math.round(h)));
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
