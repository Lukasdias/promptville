import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { queryNeighborhood, crowdChatter, ACTIVE_WINDOW_MS } from "./db";

function makeDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE project (id text PRIMARY KEY, worktree text NOT NULL, name text, icon_color text);
    CREATE TABLE session (
      id text PRIMARY KEY, project_id text NOT NULL, title text NOT NULL, model text,
      agent text, cost real DEFAULT 0, tokens_input integer DEFAULT 0,
      tokens_output integer DEFAULT 0, tokens_reasoning integer DEFAULT 0,
      time_created integer NOT NULL, time_updated integer NOT NULL, slug text NOT NULL,
      directory text NOT NULL, parent_id text, summary_additions integer,
      summary_deletions integer
    );
    CREATE TABLE message (id text PRIMARY KEY, session_id text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
    CREATE TABLE part (id text PRIMARY KEY, message_id text NOT NULL, session_id text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
    CREATE TABLE todo (session_id text NOT NULL, content text NOT NULL, status text NOT NULL, priority text NOT NULL, position integer NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL);
  `);
  return db;
}

let db: Database;
beforeEach(() => { db = makeDb(); });
afterEach(() => { db.close(); });

const NOW = 1_800_000_000_000;

function seed() {
  db.exec(`INSERT INTO project (id, worktree, name) VALUES ('p1','/a','A'), ('p2','/b','B')`);
  db.exec(`INSERT INTO session (id, project_id, title, cost, tokens_input, tokens_output, tokens_reasoning, time_created, time_updated, slug, directory, summary_additions, summary_deletions) VALUES
    ('s1','p1','One',0.1,100,50,20,${NOW},${NOW},'one','/a',5,2),
    ('s2','p1','Two',0.2,50,25,0,${NOW},${NOW - ACTIVE_WINDOW_MS - 1000},'two','/a',0,0),
    ('s3','p2','Three',0.0,10,10,0,${NOW},${NOW},'three','/b',1,1)`);
  db.exec(`INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('m1','s1',${NOW},${NOW},'{}'),('m2','s1',${NOW},${NOW},'{}'),('m3','s2',${NOW},${NOW},'{}')`);
  db.exec(`INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES
    ('p1','m1','s1',${NOW},${NOW},'{"type":"tool","tool":"edit"}'),
    ('p2','m1','s1',${NOW},${NOW},'{"type":"tool","tool":"edit"}'),
    ('p3','m2','s1',${NOW},${NOW},'{"type":"tool","tool":"bash"}'),
    ('p4','m3','s2',${NOW},${NOW},'{"type":"patch","files":["/x"]}')`);
  db.exec(`INSERT INTO todo (session_id, content, status, priority, position, time_created, time_updated) VALUES
    ('s1','do it','pending','high',0,${NOW},${NOW})`);
}

describe("queryNeighborhood aggregation", () => {
  test("adds per-project tool counts, todo count, cost, and reasoning tokens", () => {
    seed();
    const { projects } = queryNeighborhood(db);
    const a = projects.find((p) => p.id === "p1")!;
    expect(a.toolCounts).toEqual({ edit: 2, bash: 1 });
    expect(a.todoCount).toBe(1);
    expect(a.totalCost).toBeCloseTo(0.3);
    expect(a.reasoningTokens).toBe(20);
  });

  test("adds per-session message, patch, and diff detail", () => {
    seed();
    const { projects } = queryNeighborhood(db);
    const a = projects.find((p) => p.id === "p1")!;
    const one = a.sessions.find((s) => s.id === "s1")!;
    expect(one.messageCount).toBe(2);
    expect(one.patchCount).toBe(0);
    expect(one.toolNames).toEqual(["edit", "bash"]);
    expect(one.diffAdditions).toBe(5);
    expect(one.diffDeletions).toBe(2);
  });

  test("counts active sessions (timeUpdated within ACTIVE_WINDOW_MS)", () => {
    seed();
    const { stats } = queryNeighborhood(db);
    expect(stats.activeSessions).toBe(2);
  });

  test("counts total todos across the city", () => {
    seed();
    const { stats } = queryNeighborhood(db);
    expect(stats.totalTodoCount).toBe(1);
  });
});

describe("crowdChatter", () => {
  test("collects recent clean text parts, deduped, as an array", () => {
    db.exec(`INSERT INTO project (id, worktree, name) VALUES ('p1','/a','A')`);
    db.exec(`INSERT INTO session (id, project_id, title, time_created, time_updated, slug, directory) VALUES
      ('s1','p1','One',${NOW},${NOW},'one','/a')`);
    db.exec(`INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
      ('m1','s1',${NOW},${NOW},'{"role":"user"}'),
      ('m2','s1',${NOW},${NOW},'{"role":"assistant"}')`);
    db.exec(`INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES
      ('p1','m1','s1',${NOW},${NOW},'{"type":"text","text":"Make the lamp glow at night"}'),
      ('p2','m1','s1',${NOW},${NOW},'{"type":"text","text":"Make the lamp glow at night"}'),
      ('p3','m2','s1',${NOW},${NOW},'{"type":"text","text":"Done — the lamp now glows."}'),
      ('p4','m2','s1',${NOW},${NOW},'{"type":"tool","tool":"edit"}')`);
    const chatter = crowdChatter(db);
    expect(chatter.length).toBeGreaterThanOrEqual(2);
    expect(chatter).toContain("Make the lamp glow at night");
    expect(chatter).toContain("Done — the lamp now glows.");
    // Deduped: the repeated line appears once.
    expect(chatter.filter((l) => l === "Make the lamp glow at night")).toHaveLength(1);
  });

  test("falls back to cozy defaults when there are no text parts", () => {
    seed();
    expect(crowdChatter(db).length).toBeGreaterThan(0);
  });

  test("is exposed on the neighborhood payload", () => {
    db.exec(`INSERT INTO project (id, worktree, name) VALUES ('p1','/a','A')`);
    db.exec(`INSERT INTO session (id, project_id, title, time_created, time_updated, slug, directory) VALUES
      ('s1','p1','One',${NOW},${NOW},'one','/a')`);
    db.exec(`INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
      ('m1','s1',${NOW},${NOW},'{"role":"user"}')`);
    db.exec(`INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES
      ('p1','m1','s1',${NOW},${NOW},'{"type":"text","text":"hello world"}')`);
    const { chatter } = queryNeighborhood(db);
    expect(chatter).toContain("hello world");
  });
});
