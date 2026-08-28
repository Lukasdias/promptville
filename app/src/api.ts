import type { Neighborhood, SessionDetail } from "./types";

export async function fetchNeighborhood(): Promise<Neighborhood> {
  const res = await fetch("/api/neighborhood");
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; dbPath?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as Neighborhood;
}

export async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/session/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as SessionDetail;
}