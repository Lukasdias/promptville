import type { Neighborhood, SessionDetail, ChatTranscript } from "./types";

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

export async function fetchMessages(id: string): Promise<ChatTranscript> {
  const res = await fetch(`/api/session/${encodeURIComponent(id)}/messages`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as ChatTranscript;
}