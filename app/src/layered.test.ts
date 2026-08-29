import { describe, expect, test } from "bun:test";
import {
  landmarkHeight,
  houseWindowRows,
  heavyChange,
  activeCitizen,
  ACTIVE_WINDOW_MS,
  LANDMARK_MIN_H,
  LANDMARK_MAX_H,
} from "./layered";

describe("layered city mappings", () => {
  test("landmark height clamps cost logarithmically", () => {
    expect(landmarkHeight(0)).toBe(LANDMARK_MIN_H);
    expect(landmarkHeight(1000)).toBeGreaterThan(landmarkHeight(0));
    expect(landmarkHeight(1e6)).toBeLessThanOrEqual(LANDMARK_MAX_H);
  });

  test("houseWindowRows is 1 or 2 based on message count", () => {
    expect(houseWindowRows(0)).toBe(1);
    expect(houseWindowRows(20)).toBe(2);
  });

  test("heavyChange requires many patches or big additions", () => {
    expect(heavyChange(0, 0)).toBe(false);
    expect(heavyChange(5, 0)).toBe(true);
    expect(heavyChange(0, 200)).toBe(true);
  });

  test("activeCitizen gates on the window", () => {
    const now = 1_800_000_000_000;
    expect(activeCitizen(now, now)).toBe(true);
    expect(activeCitizen(now - ACTIVE_WINDOW_MS - 1, now)).toBe(false);
    expect(activeCitizen(now - ACTIVE_WINDOW_MS, now)).toBe(true);
  });
});
