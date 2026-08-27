import { describe, expect, test } from "bun:test";
import { queryNeighborhood } from "../server/db";
import { makeFixture } from "./fixtures";

describe("queryNeighborhood", () => {
  const data = queryNeighborhood(makeFixture());

  test("groups sessions under projects, ordered by time", () => {
    expect(data.projects).toHaveLength(3);
    const p1 = data.projects.find((p) => p.id === "p1")!;
    expect(p1.sessions.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  test("parses model JSON id, empty string and null to null", () => {
    const p1 = data.projects.find((p) => p.id === "p1")!;
    expect(p1.sessions[0].model).toBe("deepseek-v4-flash");
    expect(p1.sessions[1].model).toBeNull();
    const p2 = data.projects.find((p) => p.id === "p2")!;
    expect(p2.sessions[0].model).toBeNull();
  });

  test("defaults empty title to (untitled)", () => {
    const p2 = data.projects.find((p) => p.id === "p2")!;
    expect(p2.sessions[0].title).toBe("(untitled)");
  });

  test("project name falls back to worktree basename, then root", () => {
    expect(data.projects.find((p) => p.id === "p1")!.name).toBe("repo-a");
    expect(data.projects.find((p) => p.id === "p2")!.name).toBe("repo-b");
    expect(data.projects.find((p) => p.id === "p3")!.name).toBe("root");
  });

  test("aggregates stats", () => {
    const s = data.stats;
    expect(s.totalSessions).toBe(4);
    expect(s.totalCost).toBeCloseTo(3.75);
    expect(s.totalTokensIn).toBe(310);
    expect(s.totalTokensOut).toBe(155);
    expect(s.topModels[0]).toEqual({ model: "deepseek-v4-flash", count: 1 });
    expect(s.topAgents[0]).toEqual({ model: "build", count: 2 });
    expect(s.topProjects[0]).toEqual({ name: "repo-a", count: 2 });
  });

  test("computes busiest day as YYYY-MM-DD", () => {
    // 1700000000000 and 1700003600000 are the same UTC day (2023-11-14)
    expect(data.stats.busiestDay).toBe("2023-11-14");
  });
});