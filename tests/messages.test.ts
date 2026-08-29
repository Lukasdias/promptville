import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { sessionMessages } from "../server/db";

function chatDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE project (id TEXT PRIMARY KEY, worktree TEXT NOT NULL, name TEXT, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, sandboxes TEXT NOT NULL);
    CREATE TABLE session (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, slug TEXT NOT NULL, directory TEXT NOT NULL, version TEXT NOT NULL);
    CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL);
  `);
  db.run(`INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('u1','x',100,110,'{"role":"user"}'),
    ('a1','x',120,130,'{"role":"assistant"}'),
    ('a2','x',140,150,'{"role":"assistant"}'),
    ('other','x',180,190,'{"role":"system"}')`);
  db.run(`INSERT INTO part (message_id, session_id, time_created, time_updated, data) VALUES
    ('u1','x',100,110,'{"type":"text","text":"prompt 1"}'),
    ('a1','x',120,130,'{"type":"text","text":"reply one"}'),
    ('a1','x',125,130,'{"type":"text","text":" more"}'),
    ('a2','x',140,150,'{"type":"tool","tool":"bash"}'),
    ('other','x',180,190,'{"type":"text","text":"sys"}')`);
  return db;
}

describe("sessionMessages", () => {
  test("returns user + assistant text turns in order, joining multi-part text", () => {
    const msgs = sessionMessages(chatDb(), "x");
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[0]).toMatchObject({ id: "u1", role: "user", text: "prompt 1" });
    expect(msgs[1]).toMatchObject({ id: "a1", role: "assistant", text: "reply one more" });
  });
  test("drops tool-only and non user/assistant messages", () => {
    const msgs = sessionMessages(chatDb(), "x");
    expect(msgs.some((m) => m.id === "a2" || m.id === "other")).toBe(false);
  });
  test("returns empty for an unknown session", () => {
    expect(sessionMessages(chatDb(), "nope")).toEqual([]);
  });
});
