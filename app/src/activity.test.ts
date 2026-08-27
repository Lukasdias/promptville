import { describe, expect, test } from "bun:test";
import { bumpBuildingActivity, resetBuildingActivity, snapshotBuildingActivity } from "./activity";

describe("buildingActivity", () => {
  test("bumps and snapshots per-kind counters", () => {
    resetBuildingActivity();
    bumpBuildingActivity("hospital", "cars", 1);
    bumpBuildingActivity("hospital", "cars", 1);
    bumpBuildingActivity("hospital", "visitors", 2);
    const s = snapshotBuildingActivity();
    expect(s.hospital).toEqual({ visitors: 2, cars: 2 });
    expect(s.police).toEqual({ visitors: 0, cars: 0 });
  });

  test("counters never go below zero", () => {
    resetBuildingActivity();
    bumpBuildingActivity("bakery", "visitors", -3);
    expect(snapshotBuildingActivity().bakery.visitors).toBe(0);
  });
});