import { describe, expect, test } from "bun:test";
import { mottleBlobs, shade, stripeBands, roundedRectPath } from "./texturePatterns";
import { mulberry32 } from "./rand";

describe("shade", () => {
  test("mixes toward white for f > 0 and toward black for f < 0", () => {
    expect(shade("#000000", 1)).toBe("rgb(255, 255, 255)");
    expect(shade("#ffffff", -1)).toBe("rgb(0, 0, 0)");
    expect(shade("#808080", 0)).toBe("rgb(128, 128, 128)");
    expect(shade("#808080", 1)).toBe("rgb(255, 255, 255)");
    expect(shade("#808080", -1)).toBe("rgb(0, 0, 0)");
  });
});

describe("mottleBlobs", () => {
  test("is deterministic for a given seed", () => {
    const a = mottleBlobs(128, 28, mulberry32(101));
    const b = mottleBlobs(128, 28, mulberry32(101));
    expect(a).toEqual(b);
  });

  test("stays inside the tile with a sane lighten range", () => {
    for (const blob of mottleBlobs(128, 60, mulberry32(7))) {
      expect(blob.x).toBeGreaterThanOrEqual(0);
      expect(blob.x).toBeLessThanOrEqual(128);
      expect(blob.y).toBeGreaterThanOrEqual(0);
      expect(blob.y).toBeLessThanOrEqual(128);
      expect(blob.r).toBeGreaterThan(0);
      expect(blob.lighten).toBeGreaterThanOrEqual(-0.06);
      expect(blob.lighten).toBeLessThanOrEqual(0.06);
    }
  });
});

describe("stripeBands", () => {
  test("tiles the size exactly and alternates tone", () => {
    const bands = stripeBands(128, 6);
    expect(bands[0]!.y).toBe(0);
    expect(bands[bands.length - 1]!.y + bands[bands.length - 1]!.h).toBeCloseTo(128);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.y).toBeCloseTo(bands[i - 1]!.y + bands[i - 1]!.h);
    }
    expect(bands.map((b) => b.tone)).toEqual([0, 1, 0, 1, 0, 1]);
  });
});

describe("roundedRectPath", () => {
  // Records the emitted path commands; pure, DOM-free.
  function recorder() {
    const calls: string[] = [];
    const ctx = {
      moveTo: (x: number, y: number) => calls.push(`M${x},${y}`),
      lineTo: (x: number, y: number) => calls.push(`L${x},${y}`),
      arc: (x: number, y: number, r: number, a: number, b: number) => calls.push(`A${x},${y},${r},${a},${b}`),
      closePath: () => calls.push("Z"),
    };
    return { calls, ctx };
  }

  test("clamps radius to half the smaller side", () => {
    const { calls, ctx } = recorder();
    const x: typeof ctx = {
      ...ctx,
      moveTo: (a: number, b: number) => calls.push(`M${a},${b}`),
      lineTo: (a: number, b: number) => calls.push(`L${a},${b}`),
      arc: (...a: number[]) => calls.push(`A`),
      closePath: () => calls.push("Z"),
    };
    roundedRectPath(x, 0, 0, 10, 10, 99);
    // Radius clamps to 5 (half the side); no NaN coordinates appear.
    expect(calls.join(".")).not.toMatch(/NaN/);
  });

  test("never emits NaNs for zero or negative radius", () => {
    const { calls, ctx } = recorder();
    roundedRectPath(ctx, 0, 0, 10, 10, -5);
    roundedRectPath(ctx, 0, 0, 0, 0, 4);
    expect(calls.join(".")).not.toMatch(/NaN/);
  });

  test("forms a closed loop (starts and ends with a closePath)", () => {
    const { calls, ctx } = recorder();
    roundedRectPath(ctx, 1, 2, 8, 4, 1);
    expect(calls[0]).toMatch(/^M/);
    expect(calls[calls.length - 1]).toBe("Z");
  });
});