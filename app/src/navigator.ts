import type { ProjectData, SessionData } from "./types";

export type SortKey = "timeUpdated" | "cost" | "tokens" | "title";

export interface NavFilters {
  projects: string[];
  models: string[];
  agents: string[];
  dateFrom: number | null;
  dateTo: number | null;
}

export const EMPTY_FILTERS: NavFilters = {
  projects: [],
  models: [],
  agents: [],
  dateFrom: null,
  dateTo: null,
};

export interface NavItem {
  session: SessionData;
  project: ProjectData;
}

function tokens(s: SessionData): number {
  return s.tokensIn + s.tokensOut;
}

export function filterNavItems(
  projects: ProjectData[],
  search: string,
  filters: NavFilters,
): NavItem[] {
  const q = search.trim().toLowerCase();
  const matches = (s: SessionData, p: ProjectData) => {
    if (filters.projects.length > 0 && !filters.projects.includes(p.id)) return false;
    if (filters.models.length > 0 && !(s.model && filters.models.includes(s.model))) return false;
    if (filters.agents.length > 0 && !(s.agent && filters.agents.includes(s.agent))) return false;
    if (filters.dateFrom !== null && s.timeUpdated < filters.dateFrom) return false;
    if (filters.dateTo !== null && s.timeUpdated > filters.dateTo) return false;
    if (q) {
      const hay = `${s.title} ${s.slug} ${p.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };
  const out: NavItem[] = [];
  for (const p of projects) {
    for (const session of p.sessions) {
      if (matches(session, p)) out.push({ session, project: p });
    }
  }
  return out;
}

export function sortNavItems(items: NavItem[], sort: SortKey): NavItem[] {
  const val = (i: NavItem): number | string => {
    switch (sort) {
      case "timeUpdated": return i.session.timeUpdated;
      case "cost": return i.session.cost;
      case "tokens": return tokens(i.session);
      case "title": return i.session.title.toLowerCase();
    }
  };
  const arr = [...items];
  arr.sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (typeof va === "number" && typeof vb === "number") return vb - va;
    return String(va).localeCompare(String(vb));
  });
  return arr;
}

export function groupByDay(items: NavItem[]): { day: string; label: string; items: NavItem[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const map = new Map<string, { label: string; items: NavItem[] }>();
  for (const i of items) {
    const d = new Date(i.session.timeUpdated);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let label = day;
    if (i.session.timeUpdated >= todayStart) label = "Today";
    else if (i.session.timeUpdated >= yesterdayStart) label = "Yesterday";
    let entry = map.get(day);
    if (!entry) {
      entry = { label, items: [] };
      map.set(day, entry);
    }
    entry.items.push(i);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([day, e]) => ({ day, label: e.label, items: e.items }));
}

export function openCommand(session: SessionData): string {
  return `opencode ${session.directory} --session ${session.id}`;
}
