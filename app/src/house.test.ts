import { describe, expect, test } from "bun:test";
import { houseParams } from "./house";
import { houseWindowGlows } from "./house";
import type { SessionData } from "./types";

function session(overrides: Partial<SessionData> = {}): SessionData {
  return {
    id: "s1",
    title: "t",
    model: "deepseek-v4-flash",
    agent: null,
    cost: 1,
    tokensIn: 100,
    tokensOut: 50,
    timeCreated: 1,
    timeUpdated: 1,
    slug: "s",
    directory: "/x",
    parentId: null,
    messageCount: 0,
    patchCount: 0,
    toolNames: [],
    diffAdditions: 0,
    diffDeletions: 0,
    ...overrides,
  };
}

describe("houseParams window rows", () => {
  test("low message count yields a single window row", () => {
    const hp = houseParams(session({ messageCount: 3 }), 0);
    expect(hp.windowRows).toBe(1);
  });

  test("high message count yields more window rows", () => {
    const hp = houseParams(session({ messageCount: 30 }), 0);
    expect(hp.windowRows).toBe(2);
  });

  test("higher message count yields more window glows", () => {
    const low = houseParams(session({ messageCount: 3 }), 0);
    const high = houseParams(session({ messageCount: 30 }), 0);
    expect(houseWindowGlows(high, 0, 0).length).toBeGreaterThan(
      houseWindowGlows(low, 0, 0).length,
    );
  });
});
