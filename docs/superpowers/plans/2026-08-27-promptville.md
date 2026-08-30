# Promptville Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Promptville, a local-only 3D web app visualizing opencode history as a low-poly cartoon toy town, with a Bun API server reading the opencode sqlite database and a React Three Fiber frontend.

**Architecture:** Monorepo with two Bun workspaces: `server/` (Bun.serve + `bun:sqlite`, read-only, exposes `GET /api/neighborhood`) and `app/` (Vite + React 19 + R3F). The frontend fetches the aggregated JSON, lays out projects as city blocks and sessions as houses, and renders a pastel low-poly town with a paper-style HUD. Design spec: `docs/superpowers/specs/2026-08-27-promptville-3d-design.md`. R3F patterns: `docs/r3f-reference.md`.

**Tech Stack:** Bun 1.3+, `bun:sqlite`, Bun.serve, Vite 8, React 19, TypeScript, `@react-three/fiber` 9, `@react-three/drei` 10, `three` 0.185, Zustand 5, Tailwind CSS 4, `@fontsource/fredoka`, `@fontsource/nunito`, `concurrently`.

## Global Constraints

- Node/Bun floor: Bun ≥ 1.3 (uses `bun:sqlite`, `Bun.serve`, `bun test`, `bun --watch`).
- Deps (exact floors): `react@^19.2`, `@react-three/fiber@^9.7`, `@react-three/drei@^10.7`, `three@^0.185`, `zustand@^5`, `vite@^8`, `tailwindcss@^4` + `@tailwindcss/vite`, `@types/three@^0.185`.
- The DB is opened **read-only** — never mutate the opencode database.
- No StyleX. HUD styling uses Tailwind CSS only.
- All copy in the HUD is English, title "Promptville".
- No deployment, no auth, no real-time updates — page refresh reloads data.
- Animations mutate refs inside `useFrame` with `delta`; never `setState` in the render loop.
- Fonts: Fredoka (display) + Nunito (body) via `@fontsource`. Never Inter/Roboto/Space Grotesk.
- Cartoon palette: pastel sky `#aee6ff`, grass greens, cream roads/cards, candy block colors (see `app/src/theme.ts`).

---

### Task 1: Monorepo scaffolding

**Files:**
- Create: `package.json`
- Create: `server/package.json`, `server/tsconfig.json`
- Create: `app/package.json`, `app/tsconfig.json`, `app/tsconfig.node.json`, `app/vite.config.ts`, `app/index.html`
- Create: `app/src/main.tsx`, `app/src/index.css`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: installable workspace; `bun run dev`, `bun run build`, `bun test`, `bun run typecheck` at repo root; `app/` serves a blank Vite page (no /api yet); `server/` compiles empty.

- [ ] **Step 1: Root files**

`package.json`:
```json
{
  "name": "promptville",
  "private": true,
  "type": "module",
  "workspaces": ["server", "app"],
  "scripts": {
    "dev": "concurrently -n api,web -c blue,green \"bun --watch run server/index.ts\" \"bun run --cwd app dev\"",
    "build": "bun run --cwd app build",
    "test": "bun test",
    "typecheck": "bun run --cwd server typecheck && bun run --cwd app typecheck"
  },
  "devDependencies": {
    "concurrently": "^10.0.5",
    "typescript": "^7.0.2"
  }
}
```

`.gitignore`:
```
node_modules/
dist/
*.log
.env
```

- [ ] **Step 2: Server workspace**

`server/package.json`:
```json
{
  "name": "@promptville/server",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/bun": "^1.3.0",
    "typescript": "^7.0.2"
  }
}
```

`server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["bun"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["."]
}
```

- [ ] **Step 3: App workspace**

`app/package.json`:
```json
{
  "name": "@promptville/app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fontsource/fredoka": "^5.3.0",
    "@fontsource/nunito": "^5.3.0",
    "@react-three/drei": "^10.7.8",
    "@react-three/fiber": "^9.7.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "three": "^0.185.1",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.5",
    "@types/three": "^0.185.4",
    "@vitejs/plugin-react": "^6.1.0",
    "tailwindcss": "^4.3.3",
    "typescript": "^7.0.2",
    "vite": "^8.2.2"
  }
}
```

`app/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`app/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

`app/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:4100",
    },
  },
});
```

`app/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Promptville</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`app/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fredoka/600.css";
import "@fontsource/nunito/400.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="font-body text-neutral-800">Promptville scaffold</div>
  </StrictMode>,
);
```

`app/src/index.css`:
```css
@import "tailwindcss";

@theme {
  --font-display: "Fredoka", sans-serif;
  --font-body: "Nunito", sans-serif;
  --color-cream: #fff6e5;
  --color-sky: #aee6ff;
  --color-grass: #9bd46a;
  --color-road: #f3e3c0;
  --color-ink: #4a4453;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}
```

- [ ] **Step 4: Install and verify**

Run: `bun install`
Run: `bun run typecheck`
Run: `bun --cwd app dev` briefly — expect the Vite page to render "Promptville scaffold" (Ctrl-C after).

- [ ] **Step 5: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Promptville monorepo (bun workspaces)"
```

---

### Task 2: Server DB layer

**Files:**
- Create: `server/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: Task 1 workspace layout.
- Produces: `openDb(path: string): Database`, `queryNeighborhood(db: Database): Neighborhood`, plus exported types `SessionData`, `ProjectData`, `Stats`, `Neighborhood` (used by Task 3 and by `app/src/types.ts` in Task 4 — keep field names identical).

- [ ] **Step 1: Write the failing test**

`tests/db.test.ts`:
```ts
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { queryNeighborhood } from "../server/db";

function makeFixture(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY, worktree TEXT NOT NULL, vcs TEXT, name TEXT,
      icon_url TEXT, icon_color TEXT, time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL, time_initialized INTEGER,
      sandboxes TEXT NOT NULL, commands TEXT, icon_url_override TEXT
    );
    CREATE TABLE session (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_id TEXT,
      slug TEXT NOT NULL, directory TEXT NOT NULL, title TEXT NOT NULL,
      version TEXT NOT NULL, share_url TEXT, summary_additions INTEGER,
      summary_deletions INTEGER, summary_files INTEGER, summary_diffs TEXT,
      revert TEXT, permission TEXT, time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL, time_compacting INTEGER,
      time_archived INTEGER, workspace_id TEXT, path TEXT, agent TEXT,
      model TEXT, cost REAL DEFAULT 0 NOT NULL, tokens_input INTEGER DEFAULT 0 NOT NULL,
      tokens_output INTEGER DEFAULT 0 NOT NULL, tokens_reasoning INTEGER DEFAULT 0 NOT NULL,
      tokens_cache_read INTEGER DEFAULT 0 NOT NULL, tokens_cache_write INTEGER DEFAULT 0 NOT NULL,
      metadata TEXT
    );
  `);
  db.run(`INSERT INTO project (id, worktree, name, icon_color, time_created, time_updated, sandboxes) VALUES
    ('p1', '/home/u/repo-a', 'repo-a', '#ff0000', 1, 1, '[]'),
    ('p2', '/home/u/repo-b', NULL, NULL, 1, 1, '[]'),
    ('p3', '/', NULL, NULL, 1, 1, '[]')`);
  db.run(`INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated, agent, model, cost, tokens_input, tokens_output) VALUES
    ('s1','p1','s1','/d','Title One','0',1700000000000,1700000000000,'build','{"id":"deepseek-v4-flash","providerID":"opencode-go"}',1.5,100,50),
    ('s2','p1','s2','/d','Title Two','0',1700003600000,1700003600000,NULL,'',0.25,10,5),
    ('s3','p2','s3','/d','','0',1700000000000,1700000000000,'plan',NULL,0,0,0),
    ('s4','p3','s4','/d','Root work','0',1700007200000,1700007200000,'build','{"id":"minimax-m3","providerID":"opencode-go"}',2.0,200,100)`);
  return db;
}

describe("queryNeighborhood", () => {
  const data = queryNeighborhood(makeFixture());

  test("groups sessions under projects, ordered by time", () => {
    expect(data.projects).toHaveLength(3);
    const p1 = data.projects.find((p) => p.id === "p1")!;
    expect(p1.sessions.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  test("parses model JSON id, empty string and null to null", () => {
    const p1 = data.projects.find((p) => p.id === "p1")!;
    expect(p1.sessions[0].model).toBe("deepseek-v4-flash");
    expect(p1.sessions[1].model).toBeNull();
    const p2 = data.projects.find((p) => p.id === "p2")!;
    expect(p2.sessions[0].model).toBeNull();
  });

  test("defaults empty title to (untitled)", () => {
    const p2 = data.projects.find((p) => p.id === "p2")!;
    expect(p2.sessions[0].title).toBe("(untitled)");
  });

  test("project name falls back to worktree basename, then root", () => {
    expect(data.projects.find((p) => p.id === "p1")!.name).toBe("repo-a");
    expect(data.projects.find((p) => p.id === "p2")!.name).toBe("repo-b");
    expect(data.projects.find((p) => p.id === "p3")!.name).toBe("root");
  });

  test("aggregates stats", () => {
    const s = data.stats;
    expect(s.totalSessions).toBe(4);
    expect(s.totalCost).toBeCloseTo(3.75);
    expect(s.totalTokensIn).toBe(310);
    expect(s.totalTokensOut).toBe(155);
    expect(s.topModels[0]).toEqual({ model: "deepseek-v4-flash", count: 1 });
    expect(s.topAgents[0]).toEqual({ model: "build", count: 2 });
    expect(s.topProjects[0]).toEqual({ name: "repo-a", count: 2 });
  });

  test("computes busiest day as YYYY-MM-DD", () => {
    // 1700000000000 and 1700003600000 are the same UTC day (2023-11-14)
    expect(data.stats.busiestDay).toBe("2023-11-14");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test`
Expected: FAIL — `queryNeighborhood` / `openDb` not exported from `server/db.ts` (file doesn't exist).

- [ ] **Step 3: Write the implementation**

`server/db.ts`:
```ts
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
      projectCounts.set(name, (projectCounts.get(name) ?? 0) + 1);
    }
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test`
Expected: PASS (7 tests). If `busiestDay` fails, confirm the timestamps share a UTC day and adjust the assertion comment — the three-way tie sorts by earliest date.

- [ ] **Step 5: Commit**

```bash
git add server/db.ts tests/db.test.ts
git commit -m "feat: server db layer with neighborhood query"
```

---

### Task 3: Server HTTP handler

**Files:**
- Create: `server/index.ts`
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: `openDb`, `queryNeighborhood` from `server/db.ts` (Task 2).
- Produces: `createHandler(dbPath: string): (req: Request) => Promise<Response>`; default DB path resolution helper `defaultDbPath(): string`; `server/index.ts` starts `Bun.serve` on port `4100` exporting `fetch`. `app/src/api.ts` (Task 4) consumes the JSON shape from Task 2.

- [ ] **Step 1: Write the failing test**

`tests/api.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { createHandler } from "../server/index";
import { makeFixture } from "./fixtures";

describe("createHandler", () => {
  test("returns neighborhood JSON for GET /api/neighborhood", async () => {
    const db = makeFixture();
    const handler = createHandler(() => db);
    const res = await handler(new Request("http://localhost/api/neighborhood"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects.length).toBeGreaterThan(0);
    expect(body.stats.totalSessions).toBe(4);
  });

  test("returns 404 for unknown paths", async () => {
    const handler = createHandler(() => makeFixture());
    const res = await handler(new Request("http://localhost/nope"));
    expect(res.status).toBe(404);
  });

  test("returns 500 with dbPath when the database cannot be opened", async () => {
    const handler = createHandler(() => {
      throw new Error("no such file");
    });
    const res = await handler(new Request("http://localhost/api/neighborhood"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.dbPath).toBeDefined();
  });
});
```

- [ ] **Step 2: Share the fixture**

`tests/fixtures.ts` — extract `makeFixture()` from `tests/db.test.ts` verbatim (same SQL, same rows). Then update `tests/db.test.ts` to import it:
```ts
import { makeFixture } from "./fixtures";
```
and delete the local definition.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test tests/api.test.ts`
Expected: FAIL — `createHandler` not exported from `server/index.ts`.

- [ ] **Step 4: Write the implementation**

`server/index.ts`:
```ts
import { existsSync, homedir } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { queryNeighborhood } from "./db";

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
    if (url.pathname !== "/api/neighborhood") {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    try {
      db ??= open();
      return Response.json(queryNeighborhood(db));
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test`
Expected: PASS. Also run `bun --watch run server/index.ts` and curl once:
`curl -s localhost:4100/api/neighborhood | head -c 200` → JSON begins with `{"stats":`.

- [ ] **Step 6: Commit**

```bash
git add server/index.ts tests/api.test.ts tests/db.test.ts tests/fixtures.ts
git commit -m "feat: api server with neighborhood endpoint"
```

---

### Task 4: App data layer (types, api client, store)

**Files:**
- Create: `app/src/types.ts`, `app/src/api.ts`, `app/src/store.ts`
- Modify: `app/src/main.tsx` (import store hook to exercise it)

**Interfaces:**
- Consumes: JSON shape from Task 2 (`Neighborhood`, `ProjectData`, `SessionData`, `Stats`).
- Produces: `fetchNeighborhood(): Promise<Neighborhood>`; zustand hook `useApp()` exposing `{ data, loading, error, selected, select, clearSelection, load }`. `load()` is called by `App.tsx` in Task 6. Consumed by HUD (Task 10) and scene (Tasks 6–9).

- [ ] **Step 1: Write the types**

`app/src/types.ts` — mirror the server shapes exactly:
```ts
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
```

- [ ] **Step 2: Write the api client**

`app/src/api.ts`:
```ts
import type { Neighborhood } from "./types";

export async function fetchNeighborhood(): Promise<Neighborhood> {
  const res = await fetch("/api/neighborhood");
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; dbPath?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as Neighborhood;
}
```

- [ ] **Step 3: Write the store**

`app/src/store.ts`:
```ts
import { create } from "zustand";
import type { Neighborhood, SessionData } from "./types";
import { fetchNeighborhood } from "./api";

interface AppState {
  data: Neighborhood | null;
  loading: boolean;
  error: string | null;
  selected: SessionData | null;
  load: () => Promise<void>;
  select: (session: SessionData | null) => void;
  clearSelection: () => void;
}

export const useApp = create<AppState>((set) => ({
  data: null,
  loading: false,
  error: null,
  selected: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchNeighborhood();
      set({ data, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },
  select: (session) => set({ selected: session }),
  clearSelection: () => set({ selected: null }),
}));
```

- [ ] **Step 4: Exercise the store in main.tsx**

Modify `app/src/main.tsx` — render a placeholder that calls `useApp((s) => s.load)` once and prints counts. (Removed in Task 6 when `App.tsx` takes over.)
```tsx
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fredoka/600.css";
import "@fontsource/nunito/400.css";
import { useApp } from "./store";
import "./index.css";

function Probe() {
  const load = useApp((s) => s.load);
  const data = useApp((s) => s.data);
  const error = useApp((s) => s.error);
  useEffect(() => {
    void load();
  }, [load]);
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!data) return <div className="p-4">Loading…</div>;
  return (
    <div className="p-4">
      {data.stats.totalSessions} sessions / {data.projects.length} projects
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Probe />
  </StrictMode>,
);
```

- [ ] **Step 5: Verify end-to-end**

Run: `bun run dev` (both processes). Open `http://localhost:5173` — expect "462 sessions / 25 projects" (or your machine's live counts). Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add app/src/types.ts app/src/api.ts app/src/store.ts app/src/main.tsx
git commit -m "feat: app data layer (api client + zustand store)"
```

---

### Task 5: City layout math

**Files:**
- Create: `app/src/layout.ts`
- Test: `app/src/layout.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions on `ProjectData`-shaped input).
- Produces:
  - `layoutCity(projects: { id: string; name: string; sessions: { tokensIn: number; tokensOut: number }[] }[]): PlacedBlock[]`
  - `PlacedBlock = { projectId, name, x, z, width, depth, houses: { x, z, index }[] }`
  - `BLOCKS_PER_ROW = 4`, `ROAD_WIDTH = 3.5`, `HOUSE_SPACING = 1.7`, `HOUSE_PAD = 0.6`
  - `houseScale(tokensIn, tokensOut): number` → `1 + log10(1 + tokens) * 1.5`, clamped `[1, 6]`.
  - Consumed by `City.tsx` / `Block.tsx` (Task 7) and `Scene.tsx` ground (Task 6).

- [ ] **Step 1: Write the failing test**

`app/src/layout.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import {
  layoutCity,
  houseScale,
  HOUSE_SPACING,
  HOUSE_PAD,
  ROAD_WIDTH,
} from "./layout";

const projects = [
  { id: "a", name: "A", sessions: Array.from({ length: 5 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "b", name: "B", sessions: Array.from({ length: 20 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "c", name: "C", sessions: Array.from({ length: 3 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "d", name: "D", sessions: Array.from({ length: 9 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "e", name: "E", sessions: Array.from({ length: 7 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
];

describe("layoutCity", () => {
  const blocks = layoutCity(projects);

  test("places one block per project, in order", () => {
    expect(blocks.map((b) => b.projectId)).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("wraps to a new row after BLOCKS_PER_ROW", () => {
    const first = blocks[0];
    const fifth = blocks[4];
    expect(fifth.x).toBeCloseTo(first.x); // same left column
    expect(fifth.z).toBeGreaterThan(first.z); // moved down a row
  });

  test("adjacent blocks in a row are separated by ROAD_WIDTH", () => {
    expect(blocks[1].x - (blocks[0].x + blocks[0].width)).toBeCloseTo(ROAD_WIDTH);
  });

  test("every house lands inside its block bounds", () => {
    for (const b of blocks) {
      for (const h of b.houses) {
        expect(h.x).toBeGreaterThanOrEqual(b.x - b.width / 2);
        expect(h.x).toBeLessThanOrEqual(b.x + b.width / 2);
        expect(h.z).toBeGreaterThanOrEqual(b.z - b.depth / 2);
        expect(h.z).toBeLessThanOrEqual(b.z + b.depth / 2);
      }
    }
  });

  test("houses are spaced HOUSE_SPACING apart on a grid", () => {
    const b = blocks[1]; // 20 sessions
    const sorted = [...b.houses].sort((p, q) => p.index - q.index);
    for (let i = 1; i < sorted.length; i++) {
      const dx = Math.abs(sorted[i].x - sorted[i - 1].x);
      const dz = Math.abs(sorted[i].z - sorted[i - 1].z);
      expect(Math.min(dx, dz)).toBeCloseTo(HOUSE_SPACING);
    }
    expect(HOUSE_PAD).toBeGreaterThan(0);
  });
});

describe("houseScale", () => {
  test("maps token counts logarithmically with clamp", () => {
    expect(houseScale(0, 0)).toBeCloseTo(1);
    expect(houseScale(100, 100)).toBeGreaterThan(1);
    expect(houseScale(1_000_000, 1_000_000)).toBeLessThanOrEqual(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/layout.test.ts`
Expected: FAIL — `./layout` module not found.

- [ ] **Step 3: Write the implementation**

`app/src/layout.ts`:
```ts
export interface HouseSlot {
  x: number;
  z: number;
  index: number;
}

export interface PlacedBlock {
  projectId: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  houses: HouseSlot[];
}

export const HOUSE_SPACING = 1.7;
export const HOUSE_PAD = 0.6;
export const ROAD_WIDTH = 3.5;
export const BLOCKS_PER_ROW = 4;

export function houseScale(tokensIn: number, tokensOut: number): number {
  const tokens = tokensIn + tokensOut;
  return Math.max(1, Math.min(6, 1 + Math.log10(1 + tokens) * 1.5));
}

interface InputProject {
  id: string;
  name: string;
  sessions: { tokensIn: number; tokensOut: number }[];
}

export function layoutCity(projects: InputProject[]): PlacedBlock[] {
  const blocks: PlacedBlock[] = [];
  let x = 0;
  let z = 0;
  let rowDepth = 0;

  for (const project of projects) {
    const count = project.sessions.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));
    const width = cols * HOUSE_SPACING + HOUSE_PAD * 2;
    const depth = rows * HOUSE_SPACING + HOUSE_PAD * 2;

    const block: PlacedBlock = {
      projectId: project.id,
      name: project.name,
      x,
      z,
      width,
      depth,
      houses: [],
    };

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      block.houses.push({
        x: x - width / 2 + HOUSE_PAD + HOUSE_SPACING / 2 + col * HOUSE_SPACING,
        z: z - depth / 2 + HOUSE_PAD + HOUSE_SPACING / 2 + row * HOUSE_SPACING,
        index: i,
      });
    }

    blocks.push(block);

    x += width + ROAD_WIDTH;
    rowDepth = Math.max(rowDepth, depth);

    if (blocks.length % BLOCKS_PER_ROW === 0) {
      x = 0;
      z += rowDepth + ROAD_WIDTH;
      rowDepth = 0;
    }
  }

  return blocks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/layout.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/layout.ts app/src/layout.test.ts
git commit -m "feat: city layout math"
```

---

### Task 6: Scene shell (Canvas, sky, lights, ground, roads, park)

**Files:**
- Create: `app/src/App.tsx`, `app/src/components/three/Scene.tsx`, `app/src/components/three/Ground.tsx`
- Create: `app/src/theme.ts`
- Modify: `app/src/main.tsx` (render `<App />`)

**Interfaces:**
- Consumes: `useApp` store (Task 4), `layoutCity` + `PlacedBlock` (Task 5).
- Produces: `<App />` renders `<Canvas frameloop="demand">` + `<Scene />`; `<Ground />` receives `blocks: PlacedBlock[]`. `Scene.tsx` later mounts `City` (Task 7) and `World` (Task 8). `theme.ts` exports the candy palette and roof-color map used by `House.tsx` (Task 7).

- [ ] **Step 1: Write the theme**

`app/src/theme.ts`:
```ts
export const PROJECT_PALETTE = [
  "#ffb3ba", "#ffdfba", "#ffffba", "#baffc9",
  "#bae1ff", "#d4baff", "#ffd1dc", "#c9f2ff",
  "#e6ffba", "#ffc9de", "#c1e1c1", "#f0c4ff",
];

export const MODEL_ROOF: Record<string, string> = {
  "deepseek-v4-flash": "#ff7f50",
  "minimax-m3": "#3cb371",
  "kimi-k2.7-code": "#9370db",
  "gpt-5.6-luna": "#ffd700",
};

export const UNKNOWN_ROOF = "#b0a89a";

export const COLORS = {
  sky: "#aee6ff",
  grass: "#9bd46a",
  grassDark: "#86c255",
  road: "#f3e3c0",
  roadLine: "#fff6e5",
  cream: "#fff6e5",
  ink: "#4a4453",
};
```

- [ ] **Step 2: App shell**

`app/src/App.tsx`:
```tsx
import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Scene } from "./components/three/Scene";
import { useApp } from "./store";

export default function App() {
  const load = useApp((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        frameloop="demand"
        shadows
        camera={{ position: [0, 18, 26], fov: 50 }}
        className="h-full w-full"
      >
        <Scene />
        <OrbitControls
          enablePan
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.4}
          minDistance={6}
          maxDistance={80}
        />
      </Canvas>
    </div>
  );
}
```

Update `app/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fredoka/600.css";
import "@fontsource/nunito/400.css";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Scene shell**

`app/src/components/three/Scene.tsx`:
```tsx
import { useMemo } from "react";
import { useApp } from "../../store";
import { layoutCity } from "../../layout";
import { Ground } from "./Ground";

export function Scene() {
  const data = useApp((s) => s.data);
  const blocks = useMemo(
    () => (data ? layoutCity(data.projects) : []),
    [data],
  );

  return (
    <>
      <color attach="background" args={["#aee6ff"]} />
      <fog attach="fog" args={["#aee6ff", 40, 110]} />
      <hemisphereLight intensity={0.9} groundColor="#cfe8b0" />
      <directionalLight
        position={[18, 30, 10]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={80}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <Ground blocks={blocks} />
    </>
  );
}
```

- [ ] **Step 4: Ground + roads + park**

`app/src/components/three/Ground.tsx`:
```tsx
import type { PlacedBlock } from "../../layout";
import { COLORS } from "../../theme";

export function Ground({ blocks }: { blocks: PlacedBlock[] }) {
  if (blocks.length === 0) return null;
  const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2)) + 6;
  const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2)) + 6;
  const minX = Math.min(...blocks.map((b) => b.x - b.width / 2)) - 6;
  const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2)) - 6;
  const sizeX = maxX - minX;
  const sizeZ = maxZ - minZ;
  const cx = (maxX + minX) / 2;
  const cz = (maxZ + minZ) / 2;

  return (
    <group>
      {/* City plaza (cream roads) under everything */}
      <mesh position={[cx, -0.05, cz]} receiveShadow>
        <planeGeometry args={[sizeX, sizeZ]} />
        <meshStandardMaterial color={COLORS.road} />
      </mesh>

      {/* Grass pad per block */}
      {blocks.map((b) => (
        <mesh
          key={b.projectId}
          position={[b.x, -0.02, b.z]}
          receiveShadow
        >
          <planeGeometry args={[b.width + 1, b.depth + 1]} />
          <meshStandardMaterial color={COLORS.grass} />
        </mesh>
      ))}

      {/* Center park */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color={COLORS.grassDark} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 5: Verify visually**

Run: `bun run dev`. Expect a pastel blue sky over a cream plaza with green pads and a park circle; orbit/zoom works; scene idle (no continuous redraw) when not interacting. Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add app/src/App.tsx app/src/main.tsx app/src/components/three/Scene.tsx app/src/components/three/Ground.tsx app/src/theme.ts
git commit -m "feat: 3d scene shell with sky, lights, ground"
```

---

### Task 7: Blocks and houses

**Files:**
- Create: `app/src/components/three/City.tsx`, `app/src/components/three/Block.tsx`, `app/src/components/three/House.tsx`

**Interfaces:**
- Consumes: `PlacedBlock` + `houseScale` (Task 5), `PROJECT_PALETTE`/`MODEL_ROOF`/`UNKNOWN_ROOF` (Task 6), store `select`, `selected` (Task 4).
- Produces: `<City />` mounts inside `Scene.tsx` (Task 6) — it reads `layoutCity` result. `<House session slot>` handles `onPointerOver`/`onPointerOut`/`onClick`. Task 9 adds the banner + hover highlight consumers.

- [ ] **Step 1: City mounts blocks**

`app/src/components/three/City.tsx`:
```tsx
import { useMemo } from "react";
import { useApp } from "../../store";
import { layoutCity } from "../../layout";
import { Block } from "./Block";

export function City() {
  const data = useApp((s) => s.data);
  const blocks = useMemo(
    () => (data ? layoutCity(data.projects) : []),
    [data],
  );
  if (blocks.length === 0) return null;
  return (
    <group>
      {blocks.map((b, i) => (
        <Block key={b.projectId} block={b} paletteIndex={i % 12} />
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Block maps to houses**

`app/src/components/three/Block.tsx`:
```tsx
import type { PlacedBlock } from "../../layout";
import { useApp } from "../../store";
import { House } from "./House";

export function Block({ block, paletteIndex }: { block: PlacedBlock; paletteIndex: number }) {
  const data = useApp((s) => s.data);
  const project = data?.projects.find((p) => p.id === block.projectId);
  if (!project) return null;

  return (
    <group position={[block.x, 0, block.z]}>
      {block.houses.map((slot) => {
        const session = project.sessions[slot.index];
        return (
          <House
            key={session.id}
            session={session}
            x={slot.x - block.x}
            z={slot.z - block.z}
            paletteIndex={paletteIndex}
          />
        );
      })}
    </group>
  );
}
```

- [ ] **Step 3: House (procedural + pop-in + selection)**

`app/src/components/three/House.tsx`:
```tsx
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, ConeGeometry, type Group } from "three";
import { houseScale } from "../../layout";
import { MODEL_ROOF, PROJECT_PALETTE, UNKNOWN_ROOF } from "../../theme";
import { useApp } from "../../store";
import type { SessionData } from "../../types";

// Shared geometries — created once, reused by every house (see docs/r3f-reference.md §9/§10).
const BODY_GEO = new BoxGeometry(1, 1, 1);
const ROOF_GEO = new ConeGeometry(0.82, 0.55, 4);
const DOOR_GEO = new BoxGeometry(0.18, 0.42, 0.04);
const WINDOW_GEO = new BoxGeometry(0.16, 0.16, 0.04);
const CHIMNEY_GEO = new BoxGeometry(0.12, 0.5, 0.12);

export function House({
  session,
  x,
  z,
  paletteIndex,
}: {
  session: SessionData;
  x: number;
  z: number;
  paletteIndex: number;
}) {
  const groupRef = useRef<Group>(null);
  const select = useApp((s) => s.select);
  const selected = useApp((s) => s.selected);
  const hoverRef = useRef(0);

  const bodyColor = useMemo(() => PROJECT_PALETTE[paletteIndex % PROJECT_PALETTE.length], [paletteIndex]);
  const roofColor = useMemo(() => (session.model ? MODEL_ROOF[session.model] ?? UNKNOWN_ROOF : UNKNOWN_ROOF), [session.model]);
  const height = useMemo(() => houseScale(session.tokensIn, session.tokensOut), [session.tokensIn, session.tokensOut]);
  const delay = useMemo(() => (session.id.charCodeAt(session.id.length - 1) % 30) / 60, [session.id]);
  const start = useRef<number | null>(null);
  const isSelected = selected?.id === session.id;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    start.current ??= clock.elapsedTime;
    const t = (clock.elapsedTime - start.current - delay) / 0.35;
    const eased = Math.max(0, Math.min(1, t));
    const smooth = eased * eased * (3 - 2 * eased);
    const base = smooth === 1 ? 1 : Math.max(0.001, smooth);
    const hover = hoverRef.current ? 1.08 : 1;
    g.scale.setScalar(base * hover);
    const bob = isSelected ? Math.sin(clock.elapsedTime * 2.2) * 0.06 : 0;
    g.position.y = bob;
  });

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      scale={0.001}
      onClick={(e) => {
        e.stopPropagation();
        select(session);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        hoverRef.current = 1;
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        hoverRef.current = 0;
        document.body.style.cursor = "auto";
      }}
    >
      {/* Body */}
      <mesh castShadow receiveShadow geometry={BODY_GEO} scale={[0.72, height, 0.72]} position={[0, height / 2, 0]}>
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {/* Roof */}
      <mesh castShadow geometry={ROOF_GEO} position={[0, height + 0.28, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.15, 1, 1.15]}>
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Door */}
      <mesh geometry={DOOR_GEO} position={[0, 0.28, 0.361]}>
        <meshStandardMaterial color="#7a5230" />
      </mesh>
      {/* Windows */}
      <mesh geometry={WINDOW_GEO} position={[0.26, 0.78, 0.361]}>
        <meshStandardMaterial color="#aee6ff" />
      </mesh>
      <mesh geometry={WINDOW_GEO} position={[-0.26, 0.78, 0.361]}>
        <meshStandardMaterial color="#aee6ff" />
      </mesh>
      {/* Chimney on some houses */}
      {session.id.charCodeAt(0) % 3 === 0 && (
        <mesh geometry={CHIMNEY_GEO} position={[0.2, height + 0.28, 0.1]}>
          <meshStandardMaterial color="#c96f6f" />
        </mesh>
      )}
    </group>
  );
}
```

**Note:** `hoverRef` and the bob are consumed by Tasks 9 and 11; the hover scale (1.08) is already wired in here so no re-edit is needed there.

- [ ] **Step 4: Mount City in Scene**

Modify `app/src/components/three/Scene.tsx` — add `<City />` after `<Ground blocks={blocks} />`:
```tsx
import { City } from "./City";
// ...
<Ground blocks={blocks} />
<City />
```

- [ ] **Step 5: Verify visually**

Run: `bun run dev`. Expect houses popping in staggered, colored by project, roof color by model, taller for token-heavy sessions. Hover shows pointer cursor + slight scale-up. Click selects (no visible effect yet — Task 9). Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/three/City.tsx app/src/components/three/Block.tsx app/src/components/three/House.tsx app/src/components/three/Scene.tsx
git commit -m "feat: low-poly houses in project blocks"
```

---

### Task 8: World dressing (trees, lamps, clouds)

**Files:**
- Create: `app/src/components/three/World.tsx`
- Modify: `app/src/components/three/Scene.tsx`

**Interfaces:**
- Consumes: nothing new. Produces: `<World />` self-contained prop-less component mounted in `Scene.tsx`.

- [ ] **Step 1: Write the component**

`app/src/components/three/World.tsx`:
```tsx
import { useMemo } from "react";
import { Billboard, Cloud, Float } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import { COLORS } from "../../theme";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function World() {
  const rand = useMemo(() => mulberry32(1337), []);
  const trees = useMemo(
    () =>
      Array.from({ length: 60 }, () => ({
        x: (rand() - 0.5) * 60,
        z: (rand() - 0.5) * 60,
        s: 0.6 + rand() * 0.7,
        skip: rand() < 0.18, // leave some open lawn
      })).filter((t) => !t.skip),
    [rand],
  );

  const lamps = useMemo(
    () =>
      Array.from({ length: 10 }, () => ({
        x: (rand() - 0.5) * 56,
        z: (rand() - 0.5) * 56,
      })),
    [rand],
  );

  return (
    <group>
      <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.4}>
        <Cloud position={[-14, 12, -18]} speed={0.4} opacity={0.9} />
        <Cloud position={[10, 15, -6]} speed={0.3} opacity={0.85} />
        <Cloud position={[22, 11, 8]} speed={0.5} opacity={0.8} />
      </Float>

      {/* Trees: instanced trunks + foliage */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh castShadow position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.09, 0.12, 0.7, 6]} />
            <meshStandardMaterial color="#8b5a2b" />
          </mesh>
          <mesh castShadow position={[0, 1.15, 0]}>
            <coneGeometry args={[0.55, 1.1, 7]} />
            <meshStandardMaterial color={COLORS.grassDark} />
          </mesh>
        </group>
      ))}

      {/* Street lamps */}
      {lamps.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]}>
          <mesh castShadow position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 1.5, 6]} />
            <meshStandardMaterial color="#5a5a5a" />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial emissive="#ffd98a" color="#ffe9b3" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
```

**Note:** trees/lamps are per-mesh groups (~140 meshes) — acceptable for a demand-rendered desktop scene. If FPS suffers on your machine, migrate trees to `<Instances>` (see `docs/r3f-reference.md` §9); leave as-is otherwise.

- [ ] **Step 2: Mount in Scene**

Modify `app/src/components/three/Scene.tsx` — add `<World />` after `<City />`.

- [ ] **Step 3: Verify visually**

Run: `bun run dev`. Expect scattered trees, street lamps, and slow-drifting clouds. Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/three/World.tsx app/src/components/three/Scene.tsx
git commit -m "feat: world dressing (trees, lamps, clouds)"
```

---

### Task 9: Interaction (selection banner, hover highlight)

**Files:**
- Create: `app/src/components/three/SelectedBanner.tsx`
- Modify: `app/src/components/three/House.tsx` (hover scale), `app/src/components/three/Scene.tsx` (mount banner)

**Interfaces:**
- Consumes: store `selected` + `clearSelection` (Task 4); layout to resolve the selected house position.
- Produces: `<SelectedBanner />` rendering drei `Html` with the title when a session is selected; ground-click clears selection.

- [ ] **Step 1: Selection banner**

`app/src/components/three/SelectedBanner.tsx`:
```tsx
import { useMemo } from "react";
import { Float, Html } from "@react-three/drei";
import { useApp } from "../../store";
import { layoutCity } from "../../layout";
import type { PlacedBlock } from "../../layout";

export function SelectedBanner() {
  const selected = useApp((s) => s.selected);
  const data = useApp((s) => s.data);

  const blocks = useMemo<PlacedBlock[]>(
    () => (data ? layoutCity(data.projects) : []),
    [data],
  );

  const position = useMemo(() => {
    if (!selected || blocks.length === 0) return null;
    for (const project of data?.projects ?? []) {
      const idx = project.sessions.findIndex((s) => s.id === selected.id);
      if (idx === -1) continue;
      const block = blocks.find((b) => b.projectId === project.id);
      const slot = block?.houses[idx];
      if (!block || !slot) return null;
      return { x: slot.x, z: slot.z };
    }
    return null;
  }, [selected, data, blocks]);

  if (!selected || !position) return null;

  return (
    <group position={[position.x, 1.4, position.z]}>
      <Float speed={2.2} rotationIntensity={0.15} floatIntensity={0.35}>
        <Html center distanceFactor={14} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "#fff6e5",
              border: "3px solid #4a4453",
              borderRadius: 12,
              boxShadow: "4px 4px 0 rgba(74, 68, 83, 0.35)",
              padding: "6px 12px",
              fontFamily: '"Nunito", sans-serif',
              fontWeight: 700,
              color: "#4a4453",
              whiteSpace: "nowrap",
              maxWidth: 260,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {selected.title}
          </div>
        </Html>
      </Float>
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.4, 6]} />
        <meshStandardMaterial color="#4a4453" />
      </mesh>
    </group>
  );
}
```

**Note:** `layoutCity` house coordinates are absolute world positions (block origin + slot offset), so `slot.x`/`slot.z` place the banner directly above the house. `House.tsx` already applies the hover scale via `hoverRef` (Task 7) — no hover edit needed here.

- [ ] **Step 2: Ground click clears selection**

Modify `app/src/components/three/Ground.tsx` — add the store hook and click handlers to the plaza plane, the grass pads, and the park circle:
```tsx
import { useApp } from "../../store";
// inside Ground():
const clearSelection = useApp((s) => s.clearSelection);
const clear = (e: { stopPropagation: () => void }) => {
  e.stopPropagation();
  clearSelection();
};
// ...on the plaza mesh:
<mesh position={[cx, -0.05, cz]} receiveShadow onClick={clear}>
// ...on each grass pad:
<mesh key={b.projectId} position={[b.x, -0.02, b.z]} receiveShadow onClick={clear}>
// ...on the park circle:
<mesh position={[0, -0.02, 0]} receiveShadow onClick={clear}>
```

- [ ] **Step 3: Mount banner in Scene**

Modify `app/src/components/three/Scene.tsx` — import and render `<SelectedBanner />` after `<World />`.

- [ ] **Step 4: Verify**

Run: `bun run dev`. Click a house → title chip appears floating above it, house bobs gently, cursor stays pointer while hovered; clicking ground hides the chip. Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/three/SelectedBanner.tsx app/src/components/three/Ground.tsx app/src/components/three/Scene.tsx
git commit -m "feat: house selection with floating title banner"
```

---

### Task 10: HUD (header, stats, detail card, hint bar, missing state)

**Files:**
- Create: `app/src/components/hud/Header.tsx`, `app/src/components/hud/StatsPanel.tsx`, `app/src/components/hud/DetailCard.tsx`, `app/src/components/hud/HintBar.tsx`, `app/src/components/hud/MissingState.tsx`
- Modify: `app/src/App.tsx` (mount HUD), `app/src/index.css` (card utility classes)

**Interfaces:**
- Consumes: store `data`, `error`, `loading`, `selected`, `clearSelection` (Task 4).
- Produces: HUD overlay components. `App.tsx` renders them above the Canvas.

- [ ] **Step 1: Card utility + body font**

`app/src/index.css` — append:
```css
@layer components {
  .paper-card {
    @apply rounded-2xl border-[3px] border-ink/80 bg-cream shadow-[4px_4px_0_rgba(74,68,83,0.25)];
  }
}
```

- [ ] **Step 2: Header**

`app/src/components/hud/Header.tsx`:
```tsx
export function Header() {
  return (
    <header className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
      <span className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-amber-300 text-xl">
        ☀️
      </span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink drop-shadow-[2px_2px_0_rgba(255,255,255,0.8)]">
        Promptville
      </h1>
    </header>
  );
}
```

- [ ] **Step 3: Stats panel**

`app/src/components/hud/StatsPanel.tsx`:
```tsx
import { useApp } from "../../store";

function fmtCost(c: number): string {
  return `$${c.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function StatsPanel() {
  const data = useApp((s) => s.data);
  if (!data) return null;
  const { stats } = data;

  return (
    <aside className="paper-card absolute right-4 top-4 w-64 p-4 font-body text-ink">
      <h2 className="font-display text-lg font-semibold">City Stats</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <Row k="Sessions" v={String(stats.totalSessions)} />
        <Row k="Total cost" v={fmtCost(stats.totalCost)} />
        <Row k="Tokens in" v={fmtTokens(stats.totalTokensIn)} />
        <Row k="Tokens out" v={fmtTokens(stats.totalTokensOut)} />
        <Row k="Busiest day" v={stats.busiestDay ?? "—"} />
      </dl>
      <h3 className="mt-3 font-display text-base font-semibold">Top models</h3>
      <ul className="mt-1 space-y-0.5 text-sm">
        {stats.topModels.slice(0, 4).map((m) => (
          <li key={m.model} className="flex justify-between gap-2">
            <span className="truncate">{m.model}</span>
            <span className="shrink-0 font-bold">{m.count}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-3 font-display text-base font-semibold">Top projects</h3>
      <ul className="mt-1 space-y-0.5 text-sm">
        {stats.topProjects.slice(0, 4).map((p) => (
          <li key={p.name} className="flex justify-between gap-2">
            <span className="truncate">{p.name}</span>
            <span className="shrink-0 font-bold">{p.count}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="opacity-70">{k}</dt>
      <dd className="font-bold">{v}</dd>
    </div>
  );
}
```

- [ ] **Step 4: Detail card**

`app/src/components/hud/DetailCard.tsx`:
```tsx
import { useApp } from "../../store";

export function DetailCard() {
  const selected = useApp((s) => s.selected);
  const clearSelection = useApp((s) => s.clearSelection);
  if (!selected) return null;

  const date = new Date(selected.timeCreated).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="paper-card absolute bottom-16 left-1/2 w-80 -translate-x-1/2 p-4 font-body text-ink">
      <button
        onClick={clearSelection}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-ink/50 text-sm hover:bg-ink/10"
        aria-label="Close"
      >
        ✕
      </button>
      <h2 className="font-display text-lg font-semibold leading-snug">{selected.title}</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <Row k="Model" v={selected.model ?? "unknown"} />
        <Row k="Agent" v={selected.agent ?? "—"} />
        <Row k="Cost" v={`$${selected.cost.toFixed(4)}`} />
        <Row k="Tokens" v={`${selected.tokensIn} in / ${selected.tokensOut} out`} />
        <Row k="Date" v={date} />
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="opacity-70">{k}</dt>
      <dd className="text-right font-bold">{v}</dd>
    </div>
  );
}
```

- [ ] **Step 5: Hint bar + missing state**

`app/src/components/hud/HintBar.tsx`:
```tsx
export function HintBar() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border-[3px] border-ink/70 bg-cream px-4 py-1.5 font-body text-sm font-bold text-ink/80 shadow-[3px_3px_0_rgba(74,68,83,0.2)]">
      Drag to orbit · Scroll to zoom · Click a house
    </div>
  );
}
```

`app/src/components/hud/MissingState.tsx`:
```tsx
import { useApp } from "../../store";

export function MissingState() {
  const error = useApp((s) => s.error);
  const loading = useApp((s) => s.loading);
  if (loading || !error) return null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-sky p-6">
      <div className="paper-card max-w-md p-6 text-center font-body text-ink">
        <div className="text-4xl">🗺️</div>
        <h2 className="mt-2 font-display text-2xl font-semibold">Map not found</h2>
        <p className="mt-2 text-sm opacity-80">
          Promptville couldn't read the opencode database.
        </p>
        <p className="mt-1 break-all rounded-lg bg-ink/5 p-2 text-xs font-mono">{error}</p>
        <p className="mt-3 text-xs opacity-70">
          Ensure <code>~/.local/share/opencode/opencode.db</code> exists, or set{" "}
          <code>OPENCODE_DB_PATH</code>.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Mount HUD in App**

Modify `app/src/App.tsx` — wrap the Canvas in the HUD shell:
```tsx
<div className="relative h-full w-full overflow-hidden">
  <Canvas ...>...</Canvas>
  <Header />
  <StatsPanel />
  <DetailCard />
  <HintBar />
  <MissingState />
</div>
```
Add imports for the five HUD components.

- [ ] **Step 7: Verify**

Run: `bun run dev`. Full HUD renders over the town; clicking a house opens the detail card; the stats panel shows live aggregates; if you stop the server the app shows "Map not found". Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/hud app/src/App.tsx app/src/index.css
git commit -m "feat: cartoon HUD (header, stats, detail card, hints)"
```

---

### Task 11: Polish, build, and smoke test

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: final build artifacts; usage README.

**Note:** the selected-house idle bob is already implemented in `House.tsx` (Task 7 Step 3) — no extra edit required here.

- [ ] **Step 1: README**

`README.md`:
```md
# Promptville

A local-only 3D toy town visualizing your opencode history. Each project is a city
block, each session is a house: height scales with token usage, roof color encodes
the model, and a cartoon HUD shows aggregate stats.

## Run

```bash
bun install
bun run dev
```

Open http://localhost:5173. The API reads the opencode sqlite database
(`~/.local/share/opencode/opencode.db`) read-only. Point at another database with
`OPENCODE_DB_PATH`.

## Scripts

- `bun run dev` — API server (:4100) + Vite (:5173)
- `bun run build` — typecheck + production build
- `bun test` — API + layout tests
- `bun run typecheck` — both workspaces

## Notes

- 3D: React Three Fiber + drei + three. Patterns: `docs/r3f-reference.md`.
- Spec: `docs/superpowers/specs/2026-08-27-promptville-3d-design.md`.
```

- [ ] **Step 2: Full build + tests**

Run: `bun run typecheck` — clean.
Run: `bun test` — all pass.
Run: `bun run build` — production build succeeds into `app/dist/`.

- [ ] **Step 3: Final smoke**

Run: `bun run dev`; orbit the town, hover/click several houses across blocks, open and close the detail card, confirm stats match `sqlite3 ~/.local/share/opencode/opencode.db "SELECT COUNT(*) FROM session"`. Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: polish and smoke-test Promptville"
```

---

## Self-Review Notes

- Spec coverage: scene (T6–T9), data/API (T2–T3), layout (T5), HUD (T10), tests (T2, T3, T5), error state (T3 + MissingState T10), R3F perf patterns (`frameloop="demand"`, shared geometry, refs-over-state) wired in T6–T9.
- Placeholders: none — every step carries concrete code.
- Type consistency: `Neighborhood`/`SessionData`/`ProjectData`/`Stats` defined once (server) and mirrored (app). `layoutCity` consumed by `Scene` (T6), `City` (T7), and `SelectedBanner` (T9) with identical signatures.