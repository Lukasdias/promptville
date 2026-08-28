import { Database } from "bun:sqlite";
import { asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { message, part, project, session } from "./schema";

export interface SessionData {
  id: string;
  title: string;
  model: string | null;
  agent: string | null;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  timeCreated: number;
  timeUpdated: number;
  slug: string;
  directory: string;
  parentId: string | null;
}

export interface SessionDetail extends SessionData {
  snippet: string;
}

export interface ProjectData {
  id: string;
  name: string;
  path: string;
  iconColor: string | null;
  sessions: SessionData[];
}

export interface Stats {
  totalSessions: number;
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  topModels: { model: string; count: number }[];
  topAgents: { model: string; count: number }[];
  topProjects: { name: string; count: number }[];
  busiestDay: string | null;
}

export interface Neighborhood {
  stats: Stats;
  projects: ProjectData[];
}

export function openDb(path: string): Database {
  return new Database(path, { readonly: true });
}

export function createDb(db: Database) {
  return drizzle(db, { schema: { project, session, message, part } });
}

function sessionFromRow(s: typeof session.$inferSelect, _projectName: string): SessionData {
  return {
    id: s.id,
    title: s.title.trim().length > 0 ? s.title.trim() : "(untitled)",
    model: s.model ? extractModelId(s.model) : null,
    agent: s.agent && s.agent.trim() ? s.agent.trim() : null,
    cost: s.cost ?? 0,
    tokensIn: s.tokensInput ?? 0,
    tokensOut: s.tokensOutput ?? 0,
    timeCreated: s.timeCreated,
    timeUpdated: s.timeUpdated,
    slug: s.slug,
    directory: s.directory,
    parentId: s.parentId,
  };
}

function basename(p: string): string {
  const parts = p.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] ?? p;
}

function projectName(name: string | null, worktree: string): string {
  if (name && name.trim()) return name.trim();
  const base = basename(worktree);
  return base.length > 0 ? base : "root";
}

export function queryNeighborhood(db: Database): Neighborhood {
  const client = createDb(db);
  const rows = client
    .select()
    .from(session)
    .innerJoin(project, eq(session.projectId, project.id))
    .orderBy(asc(session.timeCreated), asc(session.id))
    .all();

  const projects = new Map<string, ProjectData>();
  const dayCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const agentCounts = new Map<string, number>();
  const projectCounts = new Map<string, number>();

  for (const row of rows) {
    const s = row.session;
    const p = row.project;

    const day = new Date(s.timeCreated).toISOString().slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);

    const model = s.model ? extractModelId(s.model) : null;
    const agent = s.agent && s.agent.trim() ? s.agent.trim() : null;
    if (model) modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);
    if (agent) agentCounts.set(agent, (agentCounts.get(agent) ?? 0) + 1);

    const sessionData: SessionData = sessionFromRow(s, "");

    let projectData = projects.get(p.id);
    if (!projectData) {
      const name = projectName(p.name, p.worktree);
      projectData = {
        id: p.id,
        name,
        path: p.worktree,
        iconColor: p.iconColor,
        sessions: [],
      };
      projects.set(p.id, projectData);
    }
    projectCounts.set(projectData.name, (projectCounts.get(projectData.name) ?? 0) + 1);
    projectData.sessions.push(sessionData);
  }

  const byCount = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model));

  const topProjects = [...projectCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  let totalCost = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalSessions = 0;
  for (const p of projects.values()) {
    for (const s of p.sessions) {
      totalSessions++;
      totalCost += s.cost;
      totalTokensIn += s.tokensIn;
      totalTokensOut += s.tokensOut;
    }
  }

  const busiestDay = [...dayCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]?.[0] ?? null;

  const stats: Stats = {
    totalSessions,
    totalCost,
    totalTokensIn,
    totalTokensOut,
    topModels: byCount(modelCounts),
    topAgents: byCount(agentCounts),
    topProjects,
    busiestDay,
  };

  return {
    stats,
    projects: [...projects.values()].sort((a, b) => b.sessions.length - a.sessions.length),
  };
}

function extractModelId(modelJson: string): string | null {
  try {
    const parsed = JSON.parse(modelJson) as { id?: unknown };
    return typeof parsed.id === "string" && parsed.id.length > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}

export function latestTextSnippet(db: Database, sessionId: string): string {
  const client = createDb(db);
  const messages = client
    .select({ id: message.id })
    .from(message)
    .where(eq(message.sessionId, sessionId))
    .orderBy(desc(message.timeCreated))
    .all();
  for (const m of messages) {
    const parts = client
      .select({ data: part.data })
      .from(part)
      .where(eq(part.messageId, m.id))
      .orderBy(asc(part.timeCreated))
      .all();
    for (const p of parts) {
      const trimmed = textFromPart(p.data);
      if (trimmed) return clampSnippet(trimmed);
    }
  }
  return "";
}

function textFromPart(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { type?: string; text?: string };
    if (parsed.type === "text" && typeof parsed.text === "string" && parsed.text.trim()) {
      return parsed.text.replace(/\s+/g, " ").trim();
    }
  } catch {
    // non-JSON part data — ignore
  }
  return "";
}

function clampSnippet(t: string): string {
  return t.length > 140 ? `${t.slice(0, 140).trimEnd()}…` : t;
}

export function sessionDetail(db: Database, sessionId: string): SessionDetail | null {
  const client = createDb(db);
  const row = client.select().from(session).where(eq(session.id, sessionId)).get();
  if (!row) return null;
  const base = sessionFromRow(row, "");
  return { ...base, snippet: latestTextSnippet(db, sessionId) };
}