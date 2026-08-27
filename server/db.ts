import { Database } from "bun:sqlite";

export interface SessionData {
  id: string;
  title: string;
  model: string | null;
  agent: string | null;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  timeCreated: number;
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
  const rows = db
    .query<{
      id: string;
      title: string;
      model: string | null;
      agent: string | null;
      cost: number;
      tokens_input: number;
      tokens_output: number;
      time_created: number;
      project_id: string;
      worktree: string;
      name: string | null;
      icon_color: string | null;
    }>(`SELECT s.id, s.title, s.model, s.agent, s.cost,
                s.tokens_input, s.tokens_output, s.time_created,
                p.id AS project_id, p.worktree, p.name, p.icon_color
         FROM session s JOIN project p ON p.id = s.project_id
         ORDER BY s.time_created ASC, s.id ASC`)
    .all();

  const projects = new Map<string, ProjectData>();
  const dayCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const agentCounts = new Map<string, number>();
  const projectCounts = new Map<string, number>();

  for (const r of rows) {
    const day = new Date(r.time_created).toISOString().slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);

    const model = r.model ? extractModelId(r.model) : null;
    const agent = r.agent && r.agent.trim() ? r.agent.trim() : null;
    if (model) modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);
    if (agent) agentCounts.set(agent, (agentCounts.get(agent) ?? 0) + 1);

    const title = r.title.trim().length > 0 ? r.title.trim() : "(untitled)";
    const session: SessionData = {
      id: r.id,
      title,
      model,
      agent,
      cost: r.cost ?? 0,
      tokensIn: r.tokens_input ?? 0,
      tokensOut: r.tokens_output ?? 0,
      timeCreated: r.time_created,
    };

    let project = projects.get(r.project_id);
    if (!project) {
      const name = projectName(r.name, r.worktree);
      project = {
        id: r.project_id,
        name,
        path: r.worktree,
        iconColor: r.icon_color,
        sessions: [],
      };
      projects.set(r.project_id, project);
    }
    projectCounts.set(project.name, (projectCounts.get(project.name) ?? 0) + 1);
    project.sessions.push(session);
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