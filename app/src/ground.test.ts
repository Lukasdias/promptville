import { describe, expect, test } from "bun:test";
import { cityPad, hillHeight, padOvershoot, HILL_MAX, HILL_RAMP, PAD_MARGIN } from "./ground";

const B = { minX: -20, maxX: 20, minZ: -10, maxZ: 10 };

describe("cityPad", () => {
  test("expands bounds by the margin and centers on the city", () => {
    const pad = cityPad(B, PAD_MARGIN);
    expect(pad.cx).toBe(0);
    expect(pad.cz).toBe(0);
    expect(pad.halfX).toBe(20 + PAD_MARGIN);
    expect(pad.halfZ).toBe(10 + PAD_MARGIN);
  });
});

describe("padOvershoot", () => {
  test("is zero inside the pad and positive outside", () => {
    const pad = cityPad(B, PAD_MARGIN);
    expect(padOvershoot(0, 0, pad)).toBe(0);
    expect(padOvershoot(0, pad.halfZ - 1, pad)).toBe(0);
    expect(padOvershoot(0, pad.halfZ + 1, pad)).toBeGreaterThan(0);
  });
});

describe("hillHeight", () => {
  test("is zero inside the pad and grows smoothly outside", () => {
    expect(hillHeight(0)).toBe(0);
    expect(hillHeight(-5)).toBe(0);
    const r = HILL_RAMP;
    expect(hillHeight(r / 2)).toBeGreaterThan(0);
    expect(hillHeight(r)).toBeCloseTo(HILL_MAX, 5);
    expect(hillHeight(r * 2)).toBeCloseTo(HILL_MAX, 5);
  });
});
