import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Read-only model of the opencode database tables. The schema is owned by
// opencode; these definitions only describe the columns Promptville reads.
export const project = sqliteTable("project", {
  id: text("id").primaryKey(),
  worktree: text("worktree").notNull(),
  name: text("name"),
  iconColor: text("icon_color"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  model: text("model"),
  agent: text("agent"),
  cost: real("cost").notNull().default(0),
  tokensInput: integer("tokens_input").notNull().default(0),
  tokensOutput: integer("tokens_output").notNull().default(0),
  tokensReasoning: integer("tokens_reasoning").notNull().default(0),
  summaryAdditions: integer("summary_additions"),
  summaryDeletions: integer("summary_deletions"),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
  slug: text("slug").notNull(),
  directory: text("directory").notNull(),
  parentId: text("parent_id"),
});

export const todo = sqliteTable("todo", {
  sessionId: text("session_id").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  position: integer("position").notNull(),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
});

export const message = sqliteTable("message", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
  data: text("data").notNull(),
});

export const part = sqliteTable("part", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  sessionId: text("session_id").notNull(),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
  data: text("data").notNull(),
});