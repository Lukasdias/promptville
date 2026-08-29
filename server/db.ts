import { Database } from "bun:sqlite";
import { asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { message, part, project, session, todo } from "./schema";
import { countByTool, countPartType, topToolNames } from "./parts";

export const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;

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
  messageCount: number;
  patchCount: number;
  toolNames: string[];
  diffAdditions: number;
  diffDeletions: number;
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
  toolCounts: Record<string, number>;
  todoCount: number;
  totalCost: number;
  reasoningTokens: number;
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
  totalTodoCount: number;
  activeSessions: number;
}

export interface Neighborhood {
  stats: Stats;
  projects: ProjectData[];
}

export function openDb(path: string): Database {
  return new Database(path, { readonly: true });
}

export function createDb(db: Database) {
  return drizzle(db, { schema: { project, session, message, part, todo } });
}

function sessionFromRow(
  s: typeof session.$inferSelect,
  _projectName: string,
  extras: {
    messageCount: number;
    patchCount: number;
    toolNames: string[];
  },
): SessionData {
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
    messageCount: extras.messageCount,
    patchCount: extras.patchCount,
    toolNames: extras.toolNames,
    diffAdditions: s.summaryAdditions ?? 0,
    diffDeletions: s.summaryDeletions ?? 0,
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

  const allParts = client
    .select({ sessionId: part.sessionId, data: part.data })
    .from(part)
    .all();
  const msgCounts = new Map<string, number>();
  for (const m of client.select({ id: message.id, sessionId: message.sessionId }).from(message).all()) {
    msgCounts.set(m.sessionId, (msgCounts.get(m.sessionId) ?? 0) + 1);
  }
  const todoCountBySession = new Map<string, number>();
  for (const t of client.select({ sessionId: todo.sessionId }).from(todo).all()) {
    todoCountBySession.set(t.sessionId, (todoCountBySession.get(t.sessionId) ?? 0) + 1);
  }

  const projects = new Map<string, ProjectData>();
  const dayCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const agentCounts = new Map<string, number>();
  const projectCounts = new Map<string, number>();
  let maxUpdated = 0;

  for (const row of rows) {
    const s = row.session;
    const p = row.project;
    if (s.timeUpdated > maxUpdated) maxUpdated = s.timeUpdated;

    const day = new Date(s.timeCreated).toISOString().slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);

    const model = s.model ? extractModelId(s.model) : null;
    const agent = s.agent && s.agent.trim() ? s.agent.trim() : null;
    if (model) modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);
    if (agent) agentCounts.set(agent, (agentCounts.get(agent) ?? 0) + 1);

    const sessionToolCounts = countByTool(allParts, s.id);
    const sessionData: SessionData = sessionFromRow(s, "", {
      messageCount: msgCounts.get(s.id) ?? 0,
      patchCount: countPartType(allParts, s.id, "patch"),
      toolNames: topToolNames(sessionToolCounts),
    });

    let projectData = projects.get(p.id);
    if (!projectData) {
      const name = projectName(p.name, p.worktree);
      projectData = {
        id: p.id,
        name,
        path: p.worktree,
        iconColor: p.iconColor,
        sessions: [],
        toolCounts: {},
        todoCount: 0,
        totalCost: 0,
        reasoningTokens: 0,
      };
      projects.set(p.id, projectData);
    }
    projectCounts.set(projectData.name, (projectCounts.get(projectData.name) ?? 0) + 1);
    projectData.sessions.push(sessionData);
    for (const [name, n] of Object.entries(sessionToolCounts)) {
      projectData.toolCounts[name] = (projectData.toolCounts[name] ?? 0) + n;
    }
    projectData.todoCount += todoCountBySession.get(s.id) ?? 0;
    projectData.totalCost += s.cost ?? 0;
    projectData.reasoningTokens += s.tokensReasoning ?? 0;
  }

  const cutoff = maxUpdated - ACTIVE_WINDOW_MS;
  let totalCost = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalSessions = 0;
  let totalTodoCount = 0;
  let activeSessions = 0;
  for (const p of projects.values()) {
    totalTodoCount += p.todoCount;
    for (const s of p.sessions) {
      totalSessions++;
      totalCost += s.cost;
      totalTokensIn += s.tokensIn;
      totalTokensOut += s.tokensOut;
      if (s.timeUpdated >= cutoff) activeSessions++;
    }
  }

  const busiestDay = [...dayCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]?.[0] ?? null;

  const byCount = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model));

  const topProjects = [...projectCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const stats: Stats = {
    totalSessions,
    totalCost,
    totalTokensIn,
    totalTokensOut,
    topModels: byCount(modelCounts),
    topAgents: byCount(agentCounts),
    topProjects,
    busiestDay,
    totalTodoCount,
    activeSessions,
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
  const base = sessionFromRow(row, "", { messageCount: 0, patchCount: 0, toolNames: [] });
  return { ...base, snippet: latestTextSnippet(db, sessionId) };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: number;
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function sessionMessages(db: Database, sessionId: string): ChatMessage[] {
  const client = createDb(db);
  const rows = client
    .select({ id: message.id, time: message.timeCreated, data: message.data })
    .from(message)
    .where(eq(message.sessionId, sessionId))
    .orderBy(asc(message.timeCreated))
    .all();

  const out: ChatMessage[] = [];
  for (const row of rows) {
    const meta = parseJson<{ role?: string }>(row.data);
    const role = meta?.role === "user" ? "user" : meta?.role === "assistant" ? "assistant" : null;
    if (!role) continue;

    const parts = client
      .select({ data: part.data })
      .from(part)
      .where(eq(part.messageId, row.id))
      .orderBy(asc(part.timeCreated))
      .all();

    let text = "";
    for (const p of parts) {
      const pd = parseJson<{ type?: string; text?: string }>(p.data);
      if (pd?.type === "text" && typeof pd.text === "string") text += pd.text;
    }
    text = text.trim();
    if (!text) continue;

    out.push({ id: row.id, role, text, time: row.time });
  }
  return out;
}