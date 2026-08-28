import { describe, expect, test } from "bun:test";
import {
  EMPTY_FILTERS,
  filterNavItems,
  groupByDay,
  openCommand,
  sortNavItems,
  type NavFilters,
} from "./navigator";
import type { ProjectData, SessionData } from "./types";

function sess(over: Partial<SessionData>): SessionData {
  return {
    id: "x", title: "t", model: null, agent: null, cost: 0, tokensIn: 0,
    tokensOut: 0, timeCreated: 0, timeUpdated: 0, slug: "", directory: "/d",
    parentId: null, ...over,
  };
}
function project(p: Partial<ProjectData>): ProjectData {
  return { id: "p", name: "proj", path: "/p", iconColor: null, sessions: [], ...p };
}

const P = project({ id: "A", name: "alpha", sessions: [
  sess({ id: "a1", title: "fix bug", model: "m1", cost: 1, tokensIn: 10, tokensOut: 5, timeUpdated: 200 }),
  sess({ id: "a2", title: "docs", model: "m2", cost: 2, tokensIn: 5, tokensOut: 10, timeUpdated: 100 }),
]});
const Q = project({ id: "B", name: "beta", sessions: [
  sess({ id: "b1", title: "fix crash", agent: "plan", cost: 3, tokensIn: 0, tokensOut: 0, timeUpdated: 300 }),
]});

const ALL = [P, Q];

describe("filterNavItems", () => {
  test("empty filters returns every session", () => {
    expect(filterNavItems(ALL, "", EMPTY_FILTERS)).toHaveLength(3);
  });
  test("text matches title and project name case-insensitively", () => {
    expect(filterNavItems(ALL, "FIX", EMPTY_FILTERS)).toHaveLength(2);
    expect(filterNavItems(ALL, "beta", EMPTY_FILTERS)).toHaveLength(1);
  });
  test("project filter narrows by project id", () => {
    const f: NavFilters = { ...EMPTY_FILTERS, projects: ["A"] };
    expect(filterNavItems(ALL, "", f).map((i) => i.session.id)).toEqual(["a1", "a2"]);
  });
  test("model filter narrows by model", () => {
    const f: NavFilters = { ...EMPTY_FILTERS, models: ["m1"] };
    expect(filterNavItems(ALL, "", f).map((i) => i.session.id)).toEqual(["a1"]);
  });
  test("date range filters by timeUpdated", () => {
    const f: NavFilters = { ...EMPTY_FILTERS, dateFrom: 150, dateTo: 250 };
    expect(filterNavItems(ALL, "", f).map((i) => i.session.id)).toEqual(["a1"]);
  });
});

describe("sortNavItems", () => {
  test("timeUpdated sorts descending by default", () => {
    expect(sortNavItems(ALL.flatMap((p) => p.sessions.map((s) => ({ session: s, project: p }))), "timeUpdated").map((i) => i.session.id)).toEqual(["b1", "a1", "a2"]);
  });
  test("cost sorts descending", () => {
    expect(sortNavItems(P.sessions.map((s) => ({ session: s, project: P })), "cost").map((i) => i.session.id)).toEqual(["a2", "a1"]);
  });
  test("title sorts ascending", () => {
    expect(sortNavItems(P.sessions.map((s) => ({ session: s, project: P })), "title").map((i) => i.session.id)).toEqual(["a2", "a1"]);
  });
});

describe("groupByDay", () => {
  test("groups and orders by day, most recent day first", () => {
    const day = 86400000;
    const t = Date.now();
    const items = [
      { session: sess({ id: "today", timeUpdated: t }), project: P },
      { session: sess({ id: "yest", timeUpdated: t - day }), project: P },
      { session: sess({ id: "older", timeUpdated: t - 2 * day }), project: P },
    ];
    const groups = groupByDay(items);
    expect(groups.map((g) => g.items.map((i) => i.session.id))).toEqual([
      ["today"], ["yest"], ["older"],
    ]);
  });
  test("today and yesterday labels", () => {
    const now = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const t = (ms: number) => new Date(ms);
    const nowItem = { session: sess({ id: "now", timeUpdated: now.getTime() }), project: P };
    const yest = { session: sess({ id: "y", timeUpdated: t(yesterday.setHours(12, 0, 0, 0)).getTime() }), project: P };
    const groups = groupByDay([nowItem, yest]);
    expect(groups[0]?.label).toBe("Today");
    expect(groups[1]?.label).toBe("Yesterday");
  });
});

describe("openCommand", () => {
  test("builds opencode resume command", () => {
    expect(openCommand(sess({ id: "s1", directory: "/home/u/repo" }))).toBe("opencode /home/u/repo --session s1");
  });
});
