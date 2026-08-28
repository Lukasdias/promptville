# Promptville Session Navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D town usable for finding, reviewing, and resuming opencode sessions by adding a searchable/filterable/timeline Navigator panel plus world-locating toasts and floating labels.

**Architecture:** Server exposes an enriched session list and a new `GET /api/session/:id` (with a trimmed last-message snippet). The client adds a companion `NavigatorPanel` that drives the existing camera focus (reused `CivCamera` + `SelectedBanner` as beacon), a `Toasts` stack, per-house floating title labels, and an "Open in opencode" clipboard button. Pure filter/sort/group logic lives in `app/src/navigator.ts` (tested like `layout.ts`).

**Tech Stack:** Bun + Drizzle (read-only), React 19 + R3F, TanStack Query v5, Zustand, Tailwind, drei `Html`/`Float`.

## Global Constraints

- Never mutate the opencode DB — read-only via `bun:sqlite` (`openDb` uses `{ readonly: true }`).
- Resume = client-side clipboard (`opencode <directory> --session <id>`) — never spawn opencode from the server.
- Never use `any`. Avoid `as` unless necessary. No comments unless asked.
- R3F: no `setState` in `useFrame`; hooks only inside `<Canvas>`; keep `frameloop="always"`; share geometries/materials via module-level constants.
- Ground planes rotated `rotation-x={-Math.PI/2}`; scene props are voxel-based (`InstancedVoxels`), never hand-built `<mesh>` houses.
- All UI copy in English; fonts Fredoka (display) + Nunito (body) only; storybook-toytown styling via `paper-card` cream fills, thick ink borders, soft shadows.
- Snippet extraction is best-effort; fall back to `""`.
- Types: `SessionData`/`ProjectData` in both `server/db.ts` and `app/src/types.ts` must stay structurally identical.

---

### Task 1: Server — message/part schema + enriched SessionData

**Files:**
- Modify: `server/schema.ts` (add `message`, `part`)
- Modify: `server/db.ts` (enrich `SessionData`, add `sessionDetail`, `latestTextSnippet`, shared row builder)
- Modify: `tests/fixtures.ts` (add `message`, `part` tables + seed rows)
- Test: `tests/api.test.ts` (add snippet/enrichment tests)

**Interfaces:**
- Consumes: existing `session`, `project` drizzle tables.
- Produces:
  - `SessionData` now: `id, title, model, agent, cost, tokensIn, tokensOut, timeCreated, timeUpdated, slug, directory, parentId`
  - `SessionDetail extends SessionData { snippet: string }`
  - `sessionDetail(db: Database, sessionId: string): SessionDetail | null`
  - `latestTextSnippet(db: Database, sessionId: string): string`

- [ ] **Step 1: Add `message` and `part` tables to `server/schema.ts`**

After the `session` table add:

```ts
export const message = sqliteTable("message", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
  data: text("data").notNull(),
});

export const part = sqliteTable("part", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  sessionId: text("session_id").notNull(),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
  data: text("data").notNull(),
});
```

- [ ] **Step 2: Enrich `SessionData` and add snippet helpers in `server/db.ts`**

Update the `SessionData` interface and add a `SessionDetail` interface:

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
  timeUpdated: number;
  slug: string;
  directory: string;
  parentId: string | null;
}

export interface SessionDetail extends SessionData {
  snippet: string;
}
```

Update `import { asc, desc, eq } from "drizzle-orm";` (add `desc`).

Add a `defaultsDb` client helper. Replace `createDb` to include `message`/`part`:

```ts
export function createDb(db: Database) {
  return drizzle(db, { schema: { project, session, message, part } });
}
```

Add a shared row-to-`SessionData` builder and use it inside `queryNeighborhood`:

```ts
function sessionFromRow(
  s: typeof session.$inferSelect,
  projectName: string,
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
  };
}
```

Then in `queryNeighborhood`, replace the inline `const sessionData: SessionData = {...}` block (currently lines ~88-97) with:

```ts
const sessionData: SessionData = sessionFromRow(s, "");
```

(`projectName` param is unused here; keep the signature simple — call with `""`.)

Add the snippet helpers at the bottom of `server/db.ts`:

```ts
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
```

Also `import { message, part, project, session } from "./schema";`.

- [ ] **Step 3: Extend `tests/fixtures.ts` with `message`/`part`**

Append to the `db.exec` string (before the INSERT statements) a `message` and `part` table, then seed rows so `s1` has a text part and `s3` has none:

```ts
CREATE TABLE IF NOT EXISTS message (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS part (
  id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL,
  time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL
);
```

After the session INSERT, add:

```ts
db.run(`INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
  ('m1','s1',1700000000000,1700000000000,'{"role":"user","time":1700000000000}'),
  ('m2','s1',1700000001000,1700000001000,'{"role":"assistant","time":1700000001000}'),
  ('m3','s3',1700000000000,1700000000000,'{"role":"user","time":1700000000000}')`);
db.run(`INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES
  ('p1','m1','s1',1700000000000,1700000000000,'{"type":"text","text":"I want a  a   demo\\nline for the snippet test"}'),
  ('p2','m2','s1',1700000001000,1700000001000,'{"type":"tool","tool":"bash"}'),
  ('p3','m3','s3',1700000000000,1700000000000,'{"type":"text","text":"   "}')`);
```

Note `p2` is a tool part (no text) and `p3` is blank whitespace, so `m3`'s snippet resolves to `""` and `m1` (the later-created message) resolves first.

- [ ] **Step 4: Edit `tests/api.test.ts` to cover the new endpoint**

Add imports at the top:

```ts
import { sessionDetail } from "../server/db";
```

Add inside `describe("createHandler", ...)`:

```ts
test("neighborhood list carries navigation fields", async () => {
  const handler = createHandler(() => makeFixture());
  const res = await handler(new Request("http://localhost/api/neighborhood"));
  const body = await res.json();
  const s = body.projects[0].sessions[0];
  expect(typeof s.slug).toBe("string");
  expect(typeof s.directory).toBe("string");
  expect(typeof s.timeUpdated).toBe("number");
  expect(s.parentId).toBeNull();
});

test("GET /api/session/:id returns session with trimmed snippet", async () => {
  const handler = createHandler(() => makeFixture());
  const res = await handler(new Request("http://localhost/api/session/s1"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.id).toBe("s1");
  expect(body.snippet).toBe("I want a a demo line for the snippet test");
});

test("GET /api/session/:id returns empty snippet when no text", async () => {
  const handler = createHandler(() => makeFixture());
  const res = await handler(new Request("http://localhost/api/session/s3"));
  expect(res.status).toBe(200);
  expect((await res.json()).snippet).toBe("");
});

test("sessionDetail returns null for unknown id", () => {
  expect(sessionDetail(makeFixture(), "nope")).toBeNull();
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test`
Expected: all pass (note the two pre-existing `createHandler` tests still pass; the snippet tests above now pass).

- [ ] **Step 6: Commit**

```bash
git add server/schema.ts server/db.ts tests/fixtures.ts tests/api.test.ts
git commit -m "feat(server): enrich sessions and add snippet detail endpoint"
```

---

### Task 2: Server — route `GET /api/session/:id`

**Files:**
- Modify: `server/index.ts` (add route)
- Test: `tests/api.test.ts` (verify 200/404 routing)

**Interfaces:**
- Consumes: `sessionDetail` from `server/db.ts`.
- Produces: handler routes `GET /api/session/:id` → 200 `SessionDetail` or 404 `{ error: "not found" }`.

- [ ] **Step 1: Refactor the handler routing**

Replace the body of `handleRequest` (the `url.pathname !== "/api/neighborhood"` guard and the try/catch) with:

```ts
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
    { error: err instanceof Error ? err.message : String(err), dbPath: defaultDbPath() },
    { status: 500 },
  );
}
```

Update the import line to add `sessionDetail`:

```ts
import { queryNeighborhood, sessionDetail } from "./db";
```

- [ ] **Step 2: Add routing tests to `tests/api.test.ts`**

```ts
test("GET /api/session/:id returns 404 for unknown session", async () => {
  const handler = createHandler(() => makeFixture());
  const res = await handler(new Request("http://localhost/api/session/does-not-exist"));
  expect(res.status).toBe(404);
  expect((await res.json()).error).toBe("not found");
});
```

- [ ] **Step 3: Run the tests**

Run: `bun test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/index.ts tests/api.test.ts
git commit -m "feat(server): add GET /api/session/:id route"
```

---

### Task 3: Client — types, API fetch, query hook

**Files:**
- Modify: `app/src/types.ts`
- Modify: `app/src/api.ts`
- Modify: `app/src/query.ts`

**Interfaces:**
- Consumes: `Neighborhood` from the server (now with enriched `SessionData`).
- Produces:
  - `app/src/types.ts`: `SessionData` gains `timeUpdated, slug, directory, parentId`; new `SessionDetail extends SessionData { snippet: string }`.
  - `api.ts`: `fetchSession(id: string): Promise<SessionDetail>`.
  - `query.ts`: `sessionQueryOptions(id: string)` and `useSession(id: string | null | undefined)`.

- [ ] **Step 1: Update `app/src/types.ts`**

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
  timeUpdated: number;
  slug: string;
  directory: string;
  parentId: string | null;
}

export interface SessionDetail extends SessionData {
  snippet: string;
}
```

- [ ] **Step 2: Add `fetchSession` to `app/src/api.ts`**

```ts
export async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/session/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as SessionDetail;
}
```

Update the type import:

```ts
import type { Neighborhood, SessionDetail } from "./types";
```

- [ ] **Step 3: Add `sessionQueryOptions` + `useSession` to `app/src/query.ts`**

```ts
import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchNeighborhood, fetchSession } from "./api";

export const neighborhoodQueryOptions = queryOptions({
  queryKey: ["neighborhood"],
  queryFn: fetchNeighborhood,
  staleTime: 1000 * 60 * 5,
  refetchOnWindowFocus: false,
});

export function useNeighborhood() {
  return useQuery(neighborhoodQueryOptions);
}

export const sessionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["session", id],
    queryFn: () => fetchSession(id),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

export function useSession(id: string | null | undefined) {
  return useQuery({
    ...(id ? sessionQueryOptions(id) : { queryKey: ["session", null], enabled: false, queryFn: () => fetchSession("") as never }),
    enabled: Boolean(id),
  });
}
```

- [ ] **Step 4: Verify typechecks**

Run: `bun run typecheck`
Expected: PASS (enriched fields now required everywhere `SessionData` is constructed — `House.tsx`, `DetailCard.tsx` only read fields; `server/db.ts` already provides them).

- [ ] **Step 5: Commit**

```bash
git add app/src/types.ts app/src/api.ts app/src/query.ts
git commit -m "feat(app): add session detail types, fetch, and query hook"
```

---

### Task 4: Client — pure navigator logic (`app/src/navigator.ts`)

**Files:**
- Create: `app/src/navigator.ts`
- Test: `app/src/navigator.test.ts`

**Interfaces:**
- Consumes: `ProjectData`, `SessionData` from `app/src/types.ts`; `SortKey`/`NavFilters` types (see Task 5 store).
- Produces:
  - `export type SortKey = "timeUpdated" | "cost" | "tokens" | "title"`
  - `export interface NavFilters { projects: string[]; models: string[]; agents: string[]; dateFrom: number | null; dateTo: number | null }`
  - `export const EMPTY_FILTERS: NavFilters`
  - `export interface NavItem { session: SessionData; project: ProjectData }`
  - `filterNavItems(projects: ProjectData[], search: string, filters: NavFilters): NavItem[]`
  - `sortNavItems(items: NavItem[], sort: SortKey): NavItem[]`
  - `groupByDay(items: NavItem[]): { day: string; label: string; items: NavItem[] }[]`
  - `openCommand(session: SessionData): string`

- [ ] **Step 1: Write the failing test (`app/src/navigator.test.ts`)**

```ts
import { describe, expect, test } from "bun:test";
import {
  EMPTY_FILTERS,
  filterNavItems,
  groupByDay,
  openCommand,
  sortNavItems,
  type NavFilters,
} from "./navigator";
import type { ProjectData, SessionData } from "./types";

function sess(over: Partial<SessionData>): SessionData {
  return {
    id: "x", title: "t", model: null, agent: null, cost: 0, tokensIn: 0,
    tokensOut: 0, timeCreated: 0, timeUpdated: 0, slug: "", directory: "/d",
    parentId: null, ...over,
  };
}
function project(p: Partial<ProjectData>): ProjectData {
  return { id: "p", name: "proj", path: "/p", iconColor: null, sessions: [], ...p };
}

const P = project({ id: "A", name: "alpha", sessions: [
  sess({ id: "a1", title: "fix bug", model: "m1", cost: 1, tokensIn: 10, tokensOut: 5, timeUpdated: 200 }),
  sess({ id: "a2", title: "docs", model: "m2", cost: 2, tokensIn: 5, tokensOut: 10, timeUpdated: 100 }),
]});
const Q = project({ id: "B", name: "beta", sessions: [
  sess({ id: "b1", title: "fix crash", agent: "plan", cost: 3, tokensIn: 0, tokensOut: 0, timeUpdated: 300 }),
]});

const ALL = [P, Q];

describe("filterNavItems", () => {
  test("empty filters returns every session", () => {
    expect(filterNavItems(ALL, "", EMPTY_FILTERS)).toHaveLength(3);
  });
  test("text matches title and project name case-insensitively", () => {
    expect(filterNavItems(ALL, "FIX", EMPTY_FILTERS)).toHaveLength(2);
    expect(filterNavItems(ALL, "beta", EMPTY_FILTERS)).toHaveLength(1);
  });
  test("project filter narrows by project id", () => {
    const f: NavFilters = { ...EMPTY_FILTERS, projects: ["A"] };
    expect(filterNavItems(ALL, "", f).map((i) => i.session.id)).toEqual(["a1", "a2"]);
  });
  test("model filter narrows by model", () => {
    const f: NavFilters = { ...EMPTY_FILTERS, models: ["m1"] };
    expect(filterNavItems(ALL, "", f).map((i) => i.session.id)).toEqual(["a1"]);
  });
  test("date range filters by timeUpdated", () => {
    const f: NavFilters = { ...EMPTY_FILTERS, dateFrom: 150, dateTo: 250 };
    expect(filterNavItems(ALL, "", f).map((i) => i.session.id)).toEqual(["a1"]);
  });
});

describe("sortNavItems", () => {
  test("timeUpdated sorts descending by default", () => {
    expect(sortNavItems(ALL.flatMap((p) => p.sessions.map((s) => ({ session: s, project: p }))), "timeUpdated").map((i) => i.session.id)).toEqual(["b1", "a1", "a2"]);
  });
  test("cost sorts descending", () => {
    expect(sortNavItems(P.sessions.map((s) => ({ session: s, project: P })), "cost").map((i) => i.session.id)).toEqual(["a2", "a1"]);
  });
  test("title sorts ascending", () => {
    expect(sortNavItems(P.sessions.map((s) => ({ session: s, project: P })), "title").map((i) => i.session.id)).toEqual(["a1", "a2"]);
  });
});

describe("groupByDay", () => {
  test("groups and orders by day, most recent day first", () => {
    const items = ALL.flatMap((p) => p.sessions.map((s) => ({ session: s, project: p })));
    const groups = groupByDay(items);
    expect(groups[0]?.items.map((i) => i.session.id)).toEqual(["b1"]);
    expect(groups.length).toBe(3);
  });
  test("today and yesterday labels", () => {
    const now = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const t = (ms: number) => new Date(ms);
    const nowItem = { session: sess({ id: "now", timeUpdated: now.getTime() }), project: P };
    const yest = { session: sess({ id: "y", timeUpdated: t(yesterday.setHours(12, 0, 0, 0)).getTime() }), project: P };
    const groups = groupByDay([nowItem, yest]);
    expect(groups[0]?.label).toBe("Today");
    expect(groups[1]?.label).toBe("Yesterday");
  });
});

describe("openCommand", () => {
  test("builds opencode resume command", () => {
    expect(openCommand(sess({ id: "s1", directory: "/home/u/repo" }))).toBe("opencode /home/u/repo --session s1");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `bun test app/src/navigator.test.ts`
Expected: FAIL (`./navigator` not found).

- [ ] **Step 3: Implement `app/src/navigator.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `bun test app/src/navigator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/navigator.ts app/src/navigator.test.ts
git commit -m "feat(app): add pure navigator filter/sort/group logic"
```

---

### Task 5: Client — Zustand store additions

**Files:**
- Modify: `app/src/store.ts`

**Interfaces:**
- Consumes: nothing new (types from `app/src/navigator.ts`).
- Produces: `navigatorOpen`, `toggleNavigator`, `search`, `setSearch`, `filters`, `setFilter`, `resetFilters`, `sortKey`, `setSortKey`, `searchFocusNonce`, `focusSearch`, `toasts`, `pushToast`, `dismissToast`.

- [ ] **Step 1: Add the new state**

Add `import { EMPTY_FILTERS, type NavFilters, type SortKey } from "./navigator";` at the top.

Add to the `AppState` interface:

```ts
  navigatorOpen: boolean;
  toggleNavigator: () => void;
  search: string;
  setSearch: (v: string) => void;
  filters: NavFilters;
  setFilter: <K extends keyof NavFilters>(k: K, v: NavFilters[K]) => void;
  resetFilters: () => void;
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  searchFocusNonce: number;
  focusSearch: () => void;
  toasts: Toast[];
  pushToast: (kind: Toast["kind"], message: string) => void;
  dismissToast: (id: number) => void;
```

Add above `AppState`:

```ts
export interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  message: string;
}
```

Add defaults inside the `create` initializer:

```ts
      navigatorOpen: false,
      toggleNavigator: () => set((s) => ({ navigatorOpen: !s.navigatorOpen })),
      search: "",
      setSearch: (v) => set({ search: v }),
      filters: EMPTY_FILTERS,
      setFilter: (k, v) => set((s) => ({ filters: { ...s.filters, [k]: v } })),
      resetFilters: () => set({ filters: EMPTY_FILTERS }),
      sortKey: "timeUpdated",
      setSortKey: (k) => set({ sortKey: k }),
      searchFocusNonce: 0,
      focusSearch: () => set((s) => ({ navigatorOpen: true, searchFocusNonce: s.searchFocusNonce + 1 })),
      toasts: [],
      pushToast: (kind, message) => {
        const id = Date.now() + Math.random();
        set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
```

Update `partialize` to persist nav prefs (but not toasts/search):

```ts
    {
      name: "promptville-tweaks",
      partialize: (s) => ({
        tweaks: s.tweaks,
        navigatorOpen: s.navigatorOpen,
        filters: s.filters,
        sortKey: s.sortKey,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppState>),
        tweaks: {
          ...DEFAULT_TWEAKS,
          ...((persisted as Partial<AppState> | undefined)?.tweaks ?? {}),
          statsRows: {
            ...DEFAULT_TWEAKS.statsRows,
            ...((persisted as Partial<AppState> | undefined)?.tweaks?.statsRows ?? {}),
          },
        },
        filters: {
          ...EMPTY_FILTERS,
          ...((persisted as Partial<AppState> | undefined)?.filters ?? {}),
        },
      }),
    },
```

- [ ] **Step 2: Verify typechecks**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/store.ts
git commit -m "feat(app): add navigator state and toasts to store"
```

---

### Task 6: Client — Toasts component

**Files:**
- Create: `app/src/components/hud/Toasts.tsx`

**Interfaces:**
- Consumes: `useApp` `toasts`, `dismissToast`; `Toast` type.
- Produces: `<Toasts />` — bottom-center stacked paper-card toasts.

- [ ] **Step 1: Create `app/src/components/hud/Toasts.tsx`**

```tsx
import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";

const KIND_STYLE: Record<Toast["kind"], { border: string; emoji: string }> = {
  info: { border: "#4a4453", emoji: "🧭" },
  success: { border: "#2e8b57", emoji: "✅" },
  error: { border: "#c0392b", emoji: "⚠️" },
};

export function Toasts() {
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2">
      <ToastStack />
    </div>
  );
}

function ToastStack() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <>
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { opacity, y, scale } = useSpring({
    from: { opacity: 0, y: 20, scale: 0.9 },
    to: { opacity: 1, y: 0, scale: 1 },
    config: { tension: 280, friction: 22 },
  });
  const s = KIND_STYLE[toast.kind];
  return (
    <animated.button
      type="button"
      onClick={onDismiss}
      className="paper-card pointer-events-auto flex w-auto items-center gap-2 px-4 py-2 font-body text-sm font-bold text-ink"
      style={{
        opacity,
        transform: y.to((v) => `translateY(${v}px) scale(${scale.get()})`),
        border: `3px solid ${s.border}`,
      }}
    >
      <span className="text-base">{s.emoji}</span>
      <span>{toast.message}</span>
    </animated.button>
  );
}
```

- [ ] **Step 2: Wire `<Toasts />` into `app/src/App.tsx`**

Add to imports:

```tsx
import { Toasts } from "./components/hud/Toasts";
```

Add `<Toasts />` near the other HUD components (e.g. after `<DetailCard />`).

- [ ] **Step 3: Verify typechecks**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/hud/Toasts.tsx app/src/App.tsx
git commit -m "feat(app): add cartoon toast stack"
```

---

### Task 7: Client — NavigatorPanel + SessionRow

**Files:**
- Create: `app/src/components/navigator/NavigatorPanel.tsx`
- Create: `app/src/components/navigator/SessionRow.tsx`
- Modify: `app/src/App.tsx`

**Interfaces:**
- Consumes: `useNeighborhood`, `useSession` (snippet), `filterNavItems`, `sortNavItems`, `groupByDay`, `openCommand`, store (`navigatorOpen`, `toggleNavigator`, `search`, `setSearch`, `filters`, `setFilter`, `resetFilters`, `sortKey`, `setSortKey`, `select`, `pushToast`).
- Produces: `<NavigatorPanel />` (left paper card) and its internal `SessionRow`.

- [ ] **Step 1: Create `app/src/components/navigator/SessionRow.tsx`**

```tsx
import { useSession } from "../../query";
import { openCommand } from "../../navigator";
import { useApp } from "../../store";
import type { NavItem } from "../../navigator";

export function SessionRow({ item, active }: { item: NavItem; active: boolean }) {
  const select = useApp((s) => s.select);
  const pushToast = useApp((s) => s.pushToast);
  const { session, project } = item;
  const { data } = useSession(active ? session.id : null);
  const date = new Date(session.timeUpdated).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const tokens = session.tokensIn + session.tokensOut;

  const copy = () => {
    const cmd = openCommand(session);
    navigator.clipboard.writeText(cmd).then(
      () => pushToast("success", `Copied: ${cmd}`),
      () => pushToast("error", "Could not copy command"),
    );
  };

  return (
    <div
      onClick={() => {
        select(session);
        pushToast("info", `Flying to "${session.title}"`);
      }}
      onMouseEnter={() => {}}
      className="cursor-pointer rounded-xl border-2 border-ink/15 bg-cream p-2 transition-colors hover:border-ink/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-semibold leading-tight">
            {session.title}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs opacity-70">
            <span className="font-bold">{project.name}</span>
            <span>{date}</span>
            {session.model && <span>· {session.model}</span>}
            {session.agent && <span>· {session.agent}</span>}
            <span>· ${session.cost.toFixed(4)}</span>
            <span>· {tokens.toLocaleString()} tok</span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            copy();
          }}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-ink/40 text-xs hover:bg-ink/10"
          aria-label="Open in opencode"
        >
          ↗
        </button>
      </div>
      {active && data?.snippet && (
        <p className="mt-1 line-clamp-2 text-xs opacity-70">{data.snippet}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/src/components/navigator/NavigatorPanel.tsx`**

```tsx
import { useEffect, useMemo, useRef } from "react";
import { animated, useSpring } from "@react-spring/web";
import { useNeighborhood } from "../../query";
import { EMPTY_FILTERS, filterNavItems, groupByDay, sortNavItems } from "../../navigator";
import { useApp } from "../../store";
import { SessionRow } from "./SessionRow";

const MODELS = ["deepseek-v4-flash", "deepseek-v4-flash-vision-exp", "minimax-m3", "kimi-k2.7-code", "gpt-5.6-luna"];

export function NavigatorPanel() {
  const open = useApp((s) => s.navigatorOpen);
  const search = useApp((s) => s.search);
  const setSearch = useApp((s) => s.setSearch);
  const filters = useApp((s) => s.filters);
  const setFilter = useApp((s) => s.setFilter);
  const resetFilters = useApp((s) => s.resetFilters);
  const sortKey = useApp((s) => s.sortKey);
  const setSortKey = useApp((s) => s.setSortKey);
  const selected = useApp((s) => s.selected);
  const focusNonce = useApp((s) => s.searchFocusNonce);
  const { data } = useNeighborhood();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && focusNonce > 0) inputRef.current?.focus();
  }, [open, focusNonce]);

  const items = useMemo(() => {
    const projects = data?.projects ?? [];
    const filtered = filterNavItems(projects, search, filters);
    return sortNavItems(filtered, sortKey);
  }, [data, search, filters, sortKey]);

  const groups = useMemo(() => groupByDay(items), [items]);

  const possibleModels = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.projects ?? []) for (const s of p.sessions) if (s.model) set.add(s.model);
    return [...set].sort();
  }, [data]);
  const possibleAgents = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.projects ?? []) for (const s of p.sessions) if (s.agent) set.add(s.agent);
    return [...set].sort();
  }, [data]);

  const { opacity, x } = useSpring({
    from: { opacity: 0, x: -40 },
    to: { opacity: open ? 1 : 0, x: open ? 0 : -60 },
    config: { tension: 240, friction: 24 },
  });

  if (!open) return null;

  const tokens = (arr: typeof items) => arr.reduce((a, i) => a + i.session.tokensIn + i.session.tokensOut, 0);
  const cost = (arr: typeof items) => arr.reduce((a, i) => a + i.session.cost, 0);

  return (
    <animated.aside
      className="absolute left-4 top-20 bottom-16 z-30 flex w-80 flex-col"
      style={{ opacity, transform: x.to((v) => `translateX(${v}px)`) }}
    >
      <div className="paper-card flex min-h-0 flex-1 flex-col overflow-hidden p-3 font-body text-ink">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions…"
            className="flex-1 rounded-lg border-2 border-ink/40 bg-cream px-3 py-1.5 font-body text-sm outline-none focus:border-ink"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="rounded-lg border-2 border-ink/40 bg-cream px-2 py-1.5 text-xs"
          >
            <option value="timeUpdated">Newest</option>
            <option value="cost">Cost</option>
            <option value="tokens">Tokens</option>
            <option value="title">Title</option>
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border-2 border-ink/40 px-2 py-1.5 text-xs hover:bg-ink/10"
            aria-label="Reset filters"
          >
            ↺
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          <select
            multiple
            value={filters.projects}
            onChange={(e) => setFilter("projects", [...e.target.selectedOptions].map((o) => o.value))}
            className="min-w-24 rounded-lg border-2 border-ink/40 bg-cream px-1 py-1"
          >
            <option value="" disabled>Projects</option>
            {(data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            multiple
            value={filters.models}
            onChange={(e) => setFilter("models", [...e.target.selectedOptions].map((o) => o.value))}
            className="min-w-24 rounded-lg border-2 border-ink/40 bg-cream px-1 py-1"
          >
            <option value="" disabled>Models</option>
            {possibleModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            multiple
            value={filters.agents}
            onChange={(e) => setFilter("agents", [...e.target.selectedOptions].map((o) => o.value))}
            className="min-w-24 rounded-lg border-2 border-ink/40 bg-cream px-1 py-1"
          >
            <option value="" disabled>Agents</option>
            {possibleAgents.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs opacity-70">
          <span>{items.length} sessions</span>
          <span>${cost(items).toFixed(2)} · {tokens(items).toLocaleString()} tok</span>
        </div>

        <div className="mt-2 flex-1 space-y-3 overflow-y-auto pr-1">
          {groups.length === 0 && (
            <p className="py-8 text-center text-sm opacity-60">No sessions match.</p>
          )}
          {groups.map((g) => (
            <div key={g.day}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide opacity-50">{g.label}</div>
              <div className="space-y-1.5">
                {g.items.map((item) => (
                  <SessionRow key={item.session.id} item={item} active={selected?.id === item.session.id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </animated.aside>
  );
}
```

- [ ] **Step 3: Wire `<NavigatorPanel />` into `app/src/App.tsx`**

Import and render `<NavigatorPanel />` (e.g. after `<Header />`).

- [ ] **Step 4: Verify typechecks**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/navigator/NavigatorPanel.tsx app/src/components/navigator/SessionRow.tsx app/src/App.tsx
git commit -m "feat(app): add session navigator panel with search/filter/timeline"
```

---

### Task 8: Client — "Open in opencode" + snippet in DetailCard

**Files:**
- Modify: `app/src/components/hud/DetailCard.tsx`

**Interfaces:**
- Consumes: `useSession` (snippet), `openCommand`, `pushToast`.
- Produces: DetailCard shows the snippet and an "Open in opencode" copy button.

- [ ] **Step 1: Edit `app/src/components/hud/DetailCard.tsx`**

Add imports:

```tsx
import { openCommand } from "../../navigator";
import { useSession } from "../../query";
```

At the start of the component, fetch the snippet for a selected session:

```tsx
  const sessionId = selected?.id ?? null;
  const { data: detail } = useSession(sessionId);
```

Inside the `selected` branch body (`<dl className="mt-2 space-y-1 text-sm">`), after `Row k="Date"`, add rows for snippet and the copy button:

```tsx
          {detail?.snippet && (
            <div className="pt-1 text-xs leading-snug opacity-70">{detail.snippet}</div>
          )}
          <button
            type="button"
            onClick={() => {
              if (!selected) return;
              const cmd = openCommand(selected);
              navigator.clipboard.writeText(cmd).then(
                () => pushToast("success", `Copied: ${cmd}`),
                () => pushToast("error", "Could not copy command"),
              );
            }}
            className="mt-2 w-full rounded-lg border-2 border-ink/40 bg-cream py-1.5 font-display text-sm font-semibold hover:bg-ink/10"
          >
            Open in opencode ↗
          </button>
```

Add `const pushToast = useApp((s) => s.pushToast);` in the component body.

- [ ] **Step 2: Verify typechecks**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/hud/DetailCard.tsx
git commit -m "feat(app): add open-in-opencode and snippet to detail card"
```

---

### Task 9: Client — world locating (hover label + beacon)

**Files:**
- Modify: `app/src/components/three/House.tsx` (hover title tag)
- Modify: `app/src/components/three/SelectedBanner.tsx` (beacon enhance)

**Interfaces:**
- Consumes: `useApp` (`selected`), `focusTargetFor` already handles camera.
- Produces: a floating title tag on the hovered house; a more prominent beacon over the selected house.

- [ ] **Step 1: Add a hover title tag in `House.tsx`**

Add `import { Float, Html } from "@react-three/drei";` and add `useState` to the React import (`import { useMemo, useRef, useState } from "react";`).

In the component add hover state:

```tsx
  const [hovered, setHovered] = useState(false);
```

Set it in the existing pointer handlers:

```tsx
      onPointerOver={(e) => {
        e.stopPropagation();
        hoverRef.current = 1;
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        hoverRef.current = 0;
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
```

Add inside the `<group>` element, after `<InstancedVoxels ... />`:

```tsx
      {(hovered || isSelected) && (
        <Float speed={2} rotationIntensity={0} floatIntensity={0.6}>
          <Html center distanceFactor={12} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: "#fff6e5",
                border: "3px solid #4a4453",
                borderRadius: 10,
                boxShadow: "3px 3px 0 rgba(74,68,83,0.35)",
                padding: "3px 8px",
                fontFamily: '"Nunito", sans-serif',
                fontWeight: 700,
                fontSize: 12,
                color: "#4a4453",
                whiteSpace: "nowrap",
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {session.title}
            </div>
          </Html>
        </Float>
      )}
```

- [ ] **Step 2: Enhance `SelectedBanner.tsx` (beacon pin)**

Add a floating pin marker at the top of the existing pole. After the `<Float>` block, add:

```tsx
      <Float speed={2.6} rotationIntensity={0} floatIntensity={0.8}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial color="#ff5050" />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <coneGeometry args={[0.16, 0.3, 12]} />
          <meshStandardMaterial color="#ffd54a" />
        </mesh>
      </Float>
```

- [ ] **Step 3: Verify typechecks**

Run: `bun run typecheck`
Expected: PASS. (Fix the duplicate `const [hovered...]` line — only declare once.)

- [ ] **Step 4: Commit**

```bash
git add app/src/components/three/House.tsx app/src/components/three/SelectedBanner.tsx
git commit -m "feat(app): add hover title tags and beacon marker"
```

---

### Task 10: Client — keyboard, Header toggle, HelpPanel

**Files:**
- Modify: `app/src/components/three/CivCamera.tsx`
- Modify: `app/src/components/hud/Header.tsx`
- Modify: `app/src/components/hud/HelpPanel.tsx`

**Interfaces:**
- Consumes: store `toggleNavigator`, `focusSearch`.
- Produces: `L` toggles navigator, `/` opens+focuses search; a "List" button in the header; updated help.

- [ ] **Step 1: Add keys + input guard in `CivCamera.tsx`**

Add `const toggleNavigator = useApp((s) => s.toggleNavigator);` and `const focusSearch = useApp((s) => s.focusSearch);`.

Add `"l", "/"` to `HANDLED_KEYS`.

Inside `onKeyDown`, at the very top add an input guard:

```ts
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
```

Add branches in the key handling:

```ts
      } else if (k === "l") {
        toggleNavigator();
      } else if (k === "/") {
        focusSearch();
```

Add `toggleNavigator` and `focusSearch` to the `useEffect` dependency array (the big one with `[gl, blocks, projects, toggleHelp, toggleTweaks, clearSelection]`).

- [ ] **Step 2: Add a "List" toggle button in `Header.tsx`**

Add `const toggleNavigator = useApp((s) => s.toggleNavigator);`. Add a button next to the gear button:

```tsx
      <button
        type="button"
        onClick={toggleNavigator}
        aria-label="Toggle session navigator"
        className="pointer-events-auto ml-1 grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-cream text-lg transition-colors hover:bg-ink/10"
      >
        🗺️
      </button>
```

- [ ] **Step 3: Update `HelpPanel.tsx`**

Add a new group before "General":

```ts
  {
    title: "Navigate",
    rows: [
      { keys: ["L"], label: "Toggle session list" },
      { keys: ["/"], label: "Search sessions" },
      { keys: ["Click"], label: "Select a session" },
    ],
  },
```

- [ ] **Step 4: Verify typechecks**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/three/CivCamera.tsx app/src/components/hud/Header.tsx app/src/components/hud/HelpPanel.tsx
git commit -m "feat(app): wire navigator keyboard, header toggle, help"
```

---

### Task 11: Verify full build and tests

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: all server + navigator tests PASS (including the existing `api.test.ts` tests).

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Run the production build**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev`, open `http://localhost:5173`. Verify:
- Press `L` (or click 🗺️) → navigator slides in from the left.
- Type in the search box → list filters live; empty state renders.
- Sort by Cost/Newest reorders.
- Select a row → camera flies to the house, beacon + title tag appear, toast "Flying to…" shows, DetailCard opens with snippet + "Open in opencode".
- Click "Open in opencode" → toast "Copied: opencode …".
- Hover a house → its title tag floats above it.
- `Esc` clears selection.

- [ ] **Step 5: Commit (if smoke found fixes, address them first)**

```bash
git add -A
git commit -m "chore: verify session navigator build and smoke"
```

---

## Self-Review

**Spec coverage:**

- Enrich neighborhood + `GET /api/session/:id` snippet → Tasks 1–2.
- Resume = client clipboard → Tasks 4 (`openCommand`), 7, 8.
- Timeline browse (group by day) → Task 4 (`groupByDay`), 7.
- Find (search/filter/sort) → Task 4, 7.
- Navigator panel → Task 7.
- Toasts → Task 6 (+ wired into rows/details).
- World floating labels + beacon → Task 9.
- Keyboard/help/header → Task 10.
- Enriched client types/api/query → Task 3.
- Store state → Task 5.
- Tests → Tasks 1, 2, 4; typecheck/build → Task 11.

**Placeholder scan:** no TBD/TODO; every code step includes real code.

**Type consistency:** `NavFilters`/`SortKey`/`EMPTY_FILTERS` defined in `app/src/navigator.ts` (Task 4) and imported by store (Task 5) and panel (Task 7) with identical names. `SessionDetail`, `sessionDetail`, `latestTextSnippet`, `openCommand`, `focusTargetFor` reused consistently. `pushToast`, `toggleNavigator`, `focusSearch` used in Tasks 6–10 match store definitions.

**Deviation from spec (with rationale):** no separate `CameraRig.tsx`/`BeaconMarker.tsx` — fly-to already exists via `CivCamera` + `focusTargetFor` (reused), and the beacon is folded into the existing `SelectedBanner`. This avoids redundant components; the spec's intent (fly-to + visual locate) is preserved.
