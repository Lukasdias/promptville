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

export type BuildingKind = "hospital" | "police" | "fire" | "mall" | "bakery" | "petshop";