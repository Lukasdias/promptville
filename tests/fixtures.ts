import { Database } from "bun:sqlite";

export function makeFixture(): Database {
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
    CREATE TABLE message (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL, data TEXT NOT NULL
    );
    CREATE TABLE part (
      id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL
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
  db.run(`INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('m1','s1',1700000000000,1700000000000,'{"role":"user","time":1700000000000}'),
    ('m2','s1',1700000001000,1700000001000,'{"role":"assistant","time":1700000001000}'),
    ('m3','s3',1700000000000,1700000000000,'{"role":"user","time":1700000000000}')`);
  db.run(`INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES
    ('p1','m1','s1',1700000000000,1700000000000,'{"type":"text","text":"I want a  a   demo\\nline for the snippet test"}'),
    ('p2','m2','s1',1700000001000,1700000001000,'{"type":"tool","tool":"bash"}'),
    ('p3','m3','s3',1700000000000,1700000000000,'{"type":"text","text":"   "}')`);
  return db;
}