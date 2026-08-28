import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { queryNeighborhood, sessionDetail } from "./db";

export function defaultDbPath(): string {
  if (process.env.OPENCODE_DB_PATH) return process.env.OPENCODE_DB_PATH;
  const candidates = [
    join(homedir(), ".local", "share", "opencode", "opencode.db"),
    join(homedir(), ".opencode", "opencode.db"),
  ];
  return candidates.find(existsSync) ?? candidates[0];
}

export function createHandler(
  open: () => Database,
): (req: Request) => Promise<Response> {
  let db: Database | null = null;
  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/api/neighborhood") {
        db ??= open();
        return Response.json(queryNeighborhood(db));
      }
      const m = url.pathname.match(/^\/api\/session\/([^/]+)$/);
      if (m) {
        db ??= open();
        const detail = sessionDetail(db, decodeURIComponent(m[1]));
        if (!detail) return Response.json({ error: "not found" }, { status: 404 });
        return Response.json(detail);
      }
      return Response.json({ error: "not found" }, { status: 404 });
    } catch (err) {
      return Response.json(
        {
          error: err instanceof Error ? err.message : String(err),
          dbPath: defaultDbPath(),
        },
        { status: 500 },
      );
    }
  };
}

const handler = createHandler(() => new Database(defaultDbPath(), { readonly: true }));

export default {
  port: 4100,
  fetch: handler,
};