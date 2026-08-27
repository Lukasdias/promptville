import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { queryNeighborhood } from "../server/db";

function makeFixture(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY, worktree TEXT NOT NULL, vcs TEXT, name TEXT,
      icon_url TEXT, icon_color TEXT, time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL, time_initialized INTEGER,
      sandboxes TEXT NOT NULL, commands TEXT, icon_url_override TEXT
    );
    CREATE TABLE session (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_id TEXT,
      slug TEXT NOT NULL, directory TEXT NOT NULL, title TEXT NOT NULL,
      version TEXT NOT NULL, share_url TEXT, summary_additions INTEGER,
      summary_deletions INTEGER, summary_files INTEGER, summary_diffs TEXT,
      revert TEXT, permission TEXT, time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL, time_compacting INTEGER,
      time_archived INTEGER, workspace_id TEXT, path TEXT, agent TEXT,
      model TEXT, cost REAL DEFAULT 0 NOT NULL, tokens_input INTEGER DEFAULT 0 NOT NULL,
      tokens_output INTEGER DEFAULT 0 NOT NULL, tokens_reasoning INTEGER DEFAULT 0 NOT NULL,
      tokens_cache_read INTEGER DEFAULT 0 NOT NULL, tokens_cache_write INTEGER DEFAULT 0 NOT NULL,
      metadata TEXT
    );
  `);
  db.run(`INSERT INTO project (id, worktree, name, icon_color, time_created, time_updated, sandboxes) VALUES
    ('p1', '/home/u/repo-a', 'repo-a', '#ff0000', 1, 1, '[]'),
    ('p2', '/home/u/repo-b', NULL, NULL, 1, 1, '[]'),
    ('p3', '/', NULL, NULL, 1, 1, '[]')`);
  db.run(`INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated, agent, model, cost, tokens_input, tokens_output) VALUES
    ('s1','p1','s1','/d','Title One','0',1700000000000,1700000000000,'build','{"id":"deepseek-v4-flash","providerID":"opencode-go"}',1.5,100,50),
    ('s2','p1','s2','/d','Title Two','0',1700003600000,1700003600000,NULL,'',0.25,10,5),
    ('s3','p2','s3','/d','','0',1700000000000,1700000000000,'plan',NULL,0,0,0),
    ('s4','p3','s4','/d','Root work','0',1700007200000,1700007200000,'build','{"id":"minimax-m3","providerID":"opencode-go"}',2.0,200,100)`);
  return db;
}

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