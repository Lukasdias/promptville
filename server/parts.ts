export function partType(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as { type?: unknown };
    return typeof parsed.type === "string" ? parsed.type : null;
  } catch {
    return null;
  }
}

export function toolNameFromPart(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as { type?: unknown; tool?: unknown };
    if (parsed.type === "tool" && typeof parsed.tool === "string" && parsed.tool) {
      return parsed.tool;
    }
  } catch {
    // non-JSON — ignore
  }
  return null;
}

export function countByTool(
  rows: { sessionId: string; data: string }[],
  sessionId: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.sessionId !== sessionId) continue;
    const name = toolNameFromPart(r.data);
    if (name) out[name] = (out[name] ?? 0) + 1;
  }
  return out;
}

export function countPartType(
  rows: { sessionId: string; data: string }[],
  sessionId: string,
  type: string,
): number {
  let n = 0;
  for (const r of rows) {
    if (r.sessionId !== sessionId) continue;
    if (partType(r.data) === type) n++;
  }
  return n;
}

export function topToolNames(counts: Record<string, number>, limit = 3): string[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}
