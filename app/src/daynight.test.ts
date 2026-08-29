import { describe, expect, test } from "bun:test";
import { daylight, nightAmount, skyPalette, sunDirection } from "./daynight";

describe("sunDirection", () => {
  test("sun is up at noon, below horizon at midnight", () => {
    expect(sunDirection(0.5).y).toBeCloseTo(1, 5);
    expect(sunDirection(0).y).toBeCloseTo(-1, 5);
  });
  test("sun crosses the horizon at sunrise and sunset", () => {
    expect(sunDirection(0.25).y).toBeCloseTo(0, 5);
    expect(sunDirection(0.75).y).toBeCloseTo(0, 5);
  });
});

describe("daylight / nightAmount", () => {
  test("daylight is 1 at noon, 0 at midnight, 0.5 at the horizon", () => {
    expect(daylight(0.5)).toBeCloseTo(1, 5);
    expect(daylight(0)).toBeCloseTo(0, 5);
    expect(daylight(0.25)).toBeCloseTo(0.5, 5);
  });
  test("nightAmount is the complement", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 0.9]) {
      expect(nightAmount(t)).toBeCloseTo(1 - daylight(t), 5);
    }
  });
  test("daylight increases over the morning", () => {
    expect(daylight(0.3)).toBeGreaterThan(daylight(0.26));
  });
});

describe("skyPalette", () => {
  test("returns finite hex colors and a fog color", () => {
    const p = skyPalette(0.5);
    expect(p.top).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.horizon).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.fog).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.sunColor).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
