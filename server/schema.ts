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
  timeCreated: integer("time_created").notNull(),
});