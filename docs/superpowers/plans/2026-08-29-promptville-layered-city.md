# Promptville Layered City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Express richer session data (tools, todos, cost, messages, patches) as read-only scene elements in the Promptville 3D city, plus an in-city signaling layer and active-session citizens.

**Architecture:** Extend the read-only server aggregation to surface per-project and per-session detail from the opencode DB, add pure deterministic mapping helpers on the client, and render new voxel blueprints + glow/HTML signals via the existing `InstancedVoxels` / `nightRef` / `<Html>` idiom. No DB mutation anywhere.

**Tech Stack:** Bun, Drizzle ORM (`bun-sqlite`), React 19, React Three Fiber 9, drei 10, three, Zustand, TanStack Query v5.

## Global Constraints

- Server opens the opencode DB **read-only** (`readonly: true`); never mutate it.
- Never use `any`. Avoid `as` unless necessary.
- `frameloop="always"` on Canvas. Never `setState` in `useFrame` — mutate refs.
- All scene props are **voxel-based**: one `InstancedMesh` per object via `InstancedVoxels`, per-instance color. Blueprints in `app/src/voxel.ts`.
- House windows are **separate glow quads** owned by `LitWindows.tsx`; never bake windows into the body mesh.
- Day-night: reuse `nightRef` (`app/src/night.ts`) and `GLOW_MAX` (`app/src/theme.ts`).
- Copy: all English, title "Promptville". Fonts Fredoka + Nunito only.
- Layout / mapping must be **pure and deterministic**.
- `bun run typecheck` and `bun test` from repo root must pass.

---

### Task 1: Extend server schema with new columns and todo table

**Files:**
- Modify: `server/schema.ts`

**Interfaces:**
- Produces: `session` gains `tokensReasoning`, `summaryAdditions`, `summaryDeletions` columns; adds `todo` table. Task 3 reads these.

- [ ] **Step 1: Add columns and todo table**

Add to the `session` table definition (after `tokensOutput`):

```ts
  tokensReasoning: integer("tokens_reasoning").notNull().default(0),
  summaryAdditions: integer("summary_additions"),
  summaryDeletions: integer("summary_deletions"),
```

Append a new table after `session`:

```ts
export const todo = sqliteTable("todo", {
  sessionId: text("session_id").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  position: integer("position").notNull(),
  timeCreated: integer("time_created").notNull(),
  timeUpdated: integer("time_updated").notNull(),
});
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/schema.ts
git commit -m "feat(server): add session summary columns and todo table"
```

---

### Task 2: Pure part-data extraction helpers

**Files:**
- Create: `server/parts.ts`
- Test: `server/parts.test.ts`

**Interfaces:**
- Produces:
  - `toolNameFromPart(data: string): string | null`
  - `partType(data: string): string | null`
  - `countByTool(rows: { sessionId: string; data: string }[], sessionId: string): Record<string, number>`
  - `countPartType(rows: { sessionId: string; data: string }[], sessionId: string, type: string): number`
  - `topToolNames(counts: Record<string, number>, limit?: number): string[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import {
  toolNameFromPart,
  countByTool,
  countPartType,
  topToolNames,
} from "./parts";

describe("part data extraction", () => {
  const tool = JSON.stringify({ type: "tool", tool: "edit", state: {} });
  const toolBash = JSON.stringify({ type: "tool", tool: "bash", state: {} });
  const patch = JSON.stringify({ type: "patch", files: ["/a.ts"] });
  const text = JSON.stringify({ type: "text", text: "hi" });

  test("extracts the tool name from a tool part", () => {
    expect(toolNameFromPart(tool)).toBe("edit");
    expect(toolNameFromPart(text)).toBeNull();
    expect(toolNameFromPart("not-json")).toBeNull();
  });

  test("counts tools per session", () => {
    const rows = [
      { sessionId: "s1", data: tool },
      { sessionId: "s1", data: toolBash },
      { sessionId: "s1", data: tool },
      { sessionId: "s2", data: toolBash },
    ];
    expect(countByTool(rows, "s1")).toEqual({ edit: 2, bash: 1 });
    expect(countByTool(rows, "s2")).toEqual({ bash: 1 });
  });

  test("counts parts of a type per session", () => {
    const rows = [
      { sessionId: "s1", data: patch },
      { sessionId: "s1", data: patch },
      { sessionId: "s1", data: tool },
    ];
    expect(countPartType(rows, "s1", "patch")).toBe(2);
    expect(countPartType(rows, "s1", "tool")).toBe(1);
  });

  test("returns top tool names sorted by count then name", () => {
    const counts = { bash: 5, edit: 3, read: 3, grep: 1 };
    expect(topToolNames(counts)).toEqual(["bash", "edit", "read"]);
    expect(topToolNames(counts, 2)).toEqual(["bash", "edit"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test server/parts.test.ts`
Expected: FAIL (module `./parts` not found)

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test server/parts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/parts.ts server/parts.test.ts
git commit -m "feat(server): add pure part-data extraction helpers"
```

---

### Task 3: Extend queryNeighborhood aggregation

**Files:**
- Modify: `server/db.ts`
- Test: `server/db.test.ts`

**Interfaces:**
- Consumes: `server/parts.ts` helpers; `server/schema.ts` `todo`.
- Produces: `SessionData` gains `messageCount: number`, `toolNames: string[]`, `patchCount: number`, `diffAdditions: number`, `diffDeletions: number`; `ProjectData` gains `toolCounts: Record<string, number>`, `todoCount: number`, `totalCost: number`, `reasoningTokens: number`; `Stats` gains `totalTodoCount: number`, `activeSessions: number`; exports `ACTIVE_WINDOW_MS`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { queryNeighborhood, ACTIVE_WINDOW_MS } from "./db";

function makeDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE project (id text PRIMARY KEY, worktree text NOT NULL, name text, icon_color text);
    CREATE TABLE session (
      id text PRIMARY KEY, project_id text NOT NULL, title text NOT NULL, model text,
      agent text, cost real DEFAULT 0, tokens_input integer DEFAULT 0,
      tokens_output integer DEFAULT 0, tokens_reasoning integer DEFAULT 0,
      time_created integer NOT NULL, time_updated integer NOT NULL, slug text NOT NULL,
      directory text NOT NULL, parent_id text, summary_additions integer,
      summary_deletions integer
    );
    CREATE TABLE message (id text PRIMARY KEY, session_id text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
    CREATE TABLE part (id text PRIMARY KEY, message_id text NOT NULL, session_id text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
    CREATE TABLE todo (session_id text NOT NULL, content text NOT NULL, status text NOT NULL, priority text NOT NULL, position integer NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL);
  `);
  return db;
}

let db: Database;
beforeEach(() => { db = makeDb(); });
afterEach(() => { db.close(); });

const NOW = 1_800_000_000_000;

function seed() {
  db.exec(`INSERT INTO project (id, worktree, name) VALUES ('p1','/a','A'), ('p2','/b','B')`);
  db.exec(`INSERT INTO session (id, project_id, title, cost, tokens_input, tokens_output, tokens_reasoning, time_created, time_updated, slug, directory, summary_additions, summary_deletions) VALUES
    ('s1','p1','One',0.1,100,50,20,${NOW},${NOW},'one','/a',5,2),
    ('s2','p1','Two',0.2,50,25,0,${NOW},${NOW - ACTIVE_WINDOW_MS - 1000},'two','/a',0,0),
    ('s3','p2','Three',0.0,10,10,0,${NOW},${NOW},'three','/b',1,1)`);
  db.exec(`INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('m1','s1',${NOW},${NOW},'{}'),('m2','s1',${NOW},${NOW},'{}'),('m3','s2',${NOW},${NOW},'{}')`);
  db.exec(`INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES
    ('p1','m1','s1',${NOW},${NOW},'{"type":"tool","tool":"edit"}'),
    ('p2','m1','s1',${NOW},${NOW},'{"type":"tool","tool":"edit"}'),
    ('p3','m2','s1',${NOW},${NOW},'{"type":"tool","tool":"bash"}'),
    ('p4','m3','s2',${NOW},${NOW},'{"type":"patch","files":["/x"]}')`);
  db.exec(`INSERT INTO todo (session_id, content, status, priority, position, time_created, time_updated) VALUES
    ('s1','do it','pending','high',0,${NOW},${NOW})`);
}

describe("queryNeighborhood aggregation", () => {
  test("adds per-project tool counts, todo count, cost, and reasoning tokens", () => {
    seed();
    const { projects } = queryNeighborhood(db);
    const a = projects.find((p) => p.id === "p1")!;
    expect(a.toolCounts).toEqual({ edit: 2, bash: 1 });
    expect(a.todoCount).toBe(1);
    expect(a.totalCost).toBeCloseTo(0.3);
    expect(a.reasoningTokens).toBe(20);
  });

  test("adds per-session message, patch, and diff detail", () => {
    seed();
    const { projects } = queryNeighborhood(db);
    const a = projects.find((p) => p.id === "p1")!;
    const one = a.sessions.find((s) => s.id === "s1")!;
    expect(one.messageCount).toBe(2);
    expect(one.patchCount).toBe(0);
    expect(one.toolNames).toEqual(["edit", "bash"]);
    expect(one.diffAdditions).toBe(5);
    expect(one.diffDeletions).toBe(2);
  });

  test("counts active sessions (timeUpdated within ACTIVE_WINDOW_MS)", () => {
    seed();
    const { stats } = queryNeighborhood(db);
    expect(stats.activeSessions).toBe(2);
  });

  test("counts total todos across the city", () => {
    seed();
    const { stats } = queryNeighborhood(db);
    expect(stats.totalTodoCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test server/db.test.ts`
Expected: FAIL (missing fields / `ACTIVE_WINDOW_MS`)

- [ ] **Step 3: Implement schema additions (Task 1 not yet run)**

Ensure `server/schema.ts` already has the Task 1 additions (columns + `todo`). If executing this plan as one sequence, Task 1 is done first.

- [ ] **Step 4: Implement aggregation in db.test.ts**

Update imports and interfaces:

```ts
import { todo, message, part } from "./schema"; // todo already present
```

Add to `server/db.ts`. Update `SessionData`:

```ts
export interface SessionData {
  // ...existing...
  messageCount: number;
  patchCount: number;
  toolNames: string[];
  diffAdditions: number;
  diffDeletions: number;
}
```

Update `ProjectData`:

```ts
export interface ProjectData {
  // ...existing...
  toolCounts: Record<string, number>;
  todoCount: number;
  totalCost: number;
  reasoningTokens: number;
}
```

Update `Stats`:

```ts
export interface Stats {
  // ...existing...
  totalTodoCount: number;
  activeSessions: number;
}
```

Add exported constant:

```ts
export const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;
```

In `queryNeighborhood`, before the loop, load all parts and messages once (avoid N+1), and compute per-project/session maps:

```ts
const allParts = client
  .select({ sessionId: part.sessionId, data: part.data })
  .from(part)
  .all();
const msgCounts = new Map<string, number>();
for (const m of client.select({ id: message.id, sessionId: message.sessionId }).from(message).all()) {
  msgCounts.set(m.sessionId, (msgCounts.get(m.sessionId) ?? 0) + 1);
}
const todoRows = client.select({ sessionId: todo.sessionId }).from(todo).all();
const todoCountBySession = new Map<string, number>();
for (const t of todoRows) todoCountBySession.set(t.sessionId, (todoCountBySession.get(t.sessionId) ?? 0) + 1);
```

Inside the per-row loop, in `sessionFromRow` call (`sessionData = sessionFromRow(s, "")`), pass the sessionId-derived details. Change `sessionFromRow` signature to take an extra object:

```ts
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
    // ...existing fields...
    messageCount: extras.messageCount,
    patchCount: extras.patchCount,
    toolNames: extras.toolNames,
    diffAdditions: s.summaryAdditions ?? 0,
    diffDeletions: s.summaryDeletions ?? 0,
  };
}
```

Compute tool counts / patch count / toolNames per project after building `projectData.sessions`:

```ts
const projectToolCounts = new Map<string, Record<string, number>>();
const projectPatchCounts = new Map<string, number>();
```

Use `countByTool(allParts, s.id)` and `countPartType(allParts, s.id, "patch")` per session inside the loop; aggregate tool counts into the project map across its sessions. Set `projectData.toolCounts`, `projectData.todoCount` (sum of its sessions' todo counts), `projectData.totalCost` (sum of session cost), `projectData.reasoningTokens` (sum of `s.tokensReasoning ?? 0`).

In the stats block, compute sums for `totalTodoCount` and `activeSessions`:

```ts
const activeSessions = [...sessions].filter((s) => NOW-check ... ).length
```

Use `Date.now() - ACTIVE_WINDOW_MS` as the active threshold:

```ts
const activeCutoff = Date.now() - ACTIVE_WINDOW_MS;
```

Track `activeSessions` and `totalTodoCount` while iterating projects/sessions. Note: the test seeds `time_created`/`time_updated` in the future relative to `Date.now()` — define the active cutoff using the max `timeUpdated` so the test is deterministic. Simplest: compute cutoff as `maxTimeUpdated - ACTIVE_WINDOW_MS` where `maxTimeUpdated` is the max across all sessions (treat "now" as the newest session). Document this.

```ts
let activeSessions = 0;
let totalTodoCount = 0;
const maxUpdated = Math.max(0, ...allSessions.map((s) => s.timeUpdated));
const cutoff = maxUpdated - ACTIVE_WINDOW_MS;
// inside loop:
if (s.timeUpdated >= cutoff) activeSessions++;
totalTodoCount += todoCountBySession.get(s.id) ?? 0;
```

(Define `allSessions` from the raw rows.)

In `sessionDetail`, pass extras with `messageCount: 0, patchCount: 0, toolNames: []` to satisfy the new signature (snippet detail is unchanged in scope).

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test server/db.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck + full test**

Run: `bun run typecheck && bun test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/db.ts server/db.test.ts
git commit -m "feat(server): surface per-project and per-session aggregates"
```

---

### Task 4: Update client types

**Files:**
- Modify: `app/src/types.ts`

**Interfaces:**
- Consumes: Task 3 server shape.
- Produces: matches server so client components typecheck.

- [ ] **Step 1: Extend types to match server**

```ts
export interface SessionData {
  // ...existing...
  messageCount: number;
  patchCount: number;
  toolNames: string[];
  diffAdditions: number;
  diffDeletions: number;
}

export interface ProjectData {
  // ...existing...
  toolCounts: Record<string, number>;
  todoCount: number;
  totalCost: number;
  reasoningTokens: number;
}

export interface Stats {
  // ...existing...
  totalTodoCount: number;
  activeSessions: number;
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/types.ts
git commit -m "feat(app): mirror new aggregate fields in client types"
```

---

### Task 5: Pure scene-mapping helpers

**Files:**
- Create: `app/src/layered.ts`
- Test: `app/src/layered.test.ts`

**Interfaces:**
- Produces:
  - `LANDMARK_MIN_H, LANDMARK_MAX_H, LANDMARK_TITLE`
  - `landmarkHeight(cost: number): number`
  - `parkSize(todoCount: number): number`
  - `workshopSpots(toolNames: string[], block: { x: number; z: number; width: number; depth: number }): { x: number; z: number; tool: string }[]`
  - `workshopColor(tool: string): string`
  - `houseWindowRows(messageCount: number): number` (1-2)
  - `heavyChange(patchCount: number, additions: number): boolean`
  - `activeCitizen(timeUpdated: number, now: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test";
import {
  landmarkHeight,
  parkSize,
  workshopSpots,
  workshopColor,
  houseWindowRows,
  heavyChange,
  activeCitizen,
  ACTIVE_WINDOW_MS,
  LANDMARK_MIN_H,
  LANDMARK_MAX_H,
} from "./layered";

describe("layered city mappings", () => {
  test("landmark height clamps cost logarithmically", () => {
    expect(landmarkHeight(0)).toBe(LANDMARK_MIN_H);
    expect(landmarkHeight(1000)).toBeGreaterThan(landmarkHeight(0));
    expect(landmarkHeight(1e6)).toBeLessThanOrEqual(LANDMARK_MAX_H);
  });

  test("park size scales with todo count and clamps", () => {
    expect(parkSize(0)).toBe(0);
    expect(parkSize(1)).toBeGreaterThan(0);
    expect(parkSize(100)).toBeLessThanOrEqual(6);
  });

  test("workshop spots stay inside block bounds and along the inner edge", () => {
    const block = { x: 0, z: 0, width: 20, depth: 20 };
    const spots = workshopSpots(["edit", "bash", "read"], block);
    expect(spots).toHaveLength(3);
    for (const s of spots) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(block.width / 2);
      expect(Math.abs(s.z)).toBeLessThanOrEqual(block.depth / 2);
    }
  });

  test("workshops have no overlapping positions", () => {
    const block = { x: 0, z: 0, width: 20, depth: 20 };
    const spots = workshopSpots(["edit", "bash", "read", "grep", "write"], block);
    const keys = new Set(spots.map((s) => `${s.x}:${s.z}`));
    expect(keys.size).toBe(spots.length);
  });

  test("workshopColor returns a distinct color per tool", () => {
    expect(workshopColor("edit")).toBe(workshopColor("edit"));
    expect(workshopColor("edit")).not.toBe(workshopColor("bash"));
  });

  test("houseWindowRows is 1 or 2 based on message count", () => {
    expect(houseWindowRows(0)).toBe(1);
    expect(houseWindowRows(20)).toBe(2);
  });

  test("heavyChange requires many patches or big additions", () => {
    expect(heavyChange(0, 0)).toBe(false);
    expect(heavyChange(5, 0)).toBe(true);
    expect(heavyChange(0, 200)).toBe(true);
  });

  test("activeCitizen gates on the window", () => {
    const now = 1_800_000_000_000;
    expect(activeCitizen(now, now)).toBe(true);
    expect(activeCitizen(now - ACTIVE_WINDOW_MS - 1, now)).toBe(false);
    expect(activeCitizen(now - ACTIVE_WINDOW_MS, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/layered.test.ts`
Expected: FAIL (module `./layered` not found)

- [ ] **Step 3: Write minimal implementation**

```ts
import { HOUSE_PAD, HOUSE_SPACING } from "./layout";
import { PROJECT_PALETTE } from "./theme";

export const LANDMARK_MIN_H = 3;
export const LANDMARK_MAX_H = 16;
export const LANDMARK_SCALE_PER_DECADE = 2;

export const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;

const WORKSHOP_COLORS: Record<string, string> = {
  edit: "#7fb6ff",
  bash: "#3ddc64",
  read: "#ffd24a",
  write: "#ff8fa3",
  grep: "#d4baff",
  get: "#b0e0ff",
};

export function landmarkHeight(cost: number): number {
  if (cost <= 0) return LANDMARK_MIN_H;
  const h = LANDMARK_MIN_H + Math.log10(1 + cost) * LANDMARK_SCALE_PER_DECADE;
  return Math.max(LANDMARK_MIN_H, Math.min(LANDMARK_MAX_H, Math.round(h)));
}

export function parkSize(todoCount: number): number {
  if (todoCount <= 0) return 0;
  return Math.min(6, 2 + Math.round(Math.log10(1 + todoCount)));
}

export function workshopSpots(
  toolNames: string[],
  block: { x: number; z: number; width: number; depth: number },
): { x: number; z: number; tool: string }[] {
  const spots: { x: number; z: number; tool: string }[] = [];
  const frontZ = block.z + block.depth / 2 - HOUSE_PAD - HOUSE_SPACING / 2;
  for (let i = 0; i < toolNames.length; i++) {
    const offset = (i - (toolNames.length - 1) / 2) * HOUSE_SPACING;
    spots.push({ x: block.x + offset, z: frontZ, tool: toolNames[i] });
  }
  return spots;
}

export function workshopColor(tool: string): string {
  return WORKSHOP_COLORS[tool] ?? PROJECT_PALETTE[Math.abs(hash(tool)) % PROJECT_PALETTE.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function houseWindowRows(messageCount: number): number {
  return messageCount > 12 ? 2 : 1;
}

export function heavyChange(patchCount: number, additions: number): boolean {
  return patchCount >= 5 || additions >= 150;
}

export function activeCitizen(timeUpdated: number, now: number): boolean {
  return now - timeUpdated <= ACTIVE_WINDOW_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/layered.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/layered.ts app/src/layered.test.ts
git commit -m "feat(app): add pure layered-city mapping helpers"
```

---

### Task 6: Voxel blueprints for workshops, park, landmark, signs

**Files:**
- Modify: `app/src/voxel.ts`
- Test: `app/src/voxel.test.ts`

**Interfaces:**
- Consumes: `app/src/layered.ts` constants.
- Produces:
  - `workshopVoxels(body: string): Voxel[]`
  - `parkVoxels(size: number): Voxel[]`
  - `landmarkVoxels(height: number, body: string, glowColor: string): Voxel[]`
  - `todoSignVoxels(): Voxel[]`
  - `markerVoxels(color: string): Voxel[]`

- [ ] **Step 1: Write the failing test**

Append to `app/src/voxel.test.ts`:

```ts
import {
  workshopVoxels,
  parkVoxels,
  landmarkVoxels,
  todoSignVoxels,
  markerVoxels,
} from "./voxel";

describe("layered city blueprints", () => {
  test("workshop is a small hollow shed within bounds", () => {
    const voxels = workshopVoxels("#7fb6ff");
    expect(voxels.length).toBeGreaterThan(0);
    for (const v of voxels) {
      expect(Math.abs(v.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(v.z)).toBeLessThanOrEqual(3);
      expect(v.y).toBeGreaterThanOrEqual(0);
    }
  });

  test("park grows with size and includes water", () => {
    const small = parkVoxels(1);
    const big = parkVoxels(4);
    expect(big.length).toBeGreaterThan(small.length);
    expect(big.some((v) => v.color === FOUNTAIN_WATER)).toBe(true);
  });

  test("landmark height matches requested height and tops with a glow", () => {
    const voxels = landmarkVoxels(6, "#ff7f50", "#ffd98a");
    const tops = voxels.filter((v) => v.y === 6);
    expect(tops.some((v) => v.color === "#ffd98a")).toBe(true);
    for (const v of voxels) expect(v.y).toBeLessThanOrEqual(6);
  });

  test("todo sign has a pole and board", () => {
    const voxels = todoSignVoxels();
    expect(voxels.filter((v) => v.y === 3).length).toBeGreaterThanOrEqual(2);
  });

  test("marker voxels stack vertically", () => {
    const voxels = markerVoxels("#ff5252");
    expect(voxels.length).toBeGreaterThan(1);
    expect(voxels.every((v) => v.color === "#ff5252")).toBe(true);
  });
});
```

Note: add the new imports to the top import block of `app/src/voxel.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/voxel.test.ts`
Expected: FAIL (imports undefined)

- [ ] **Step 3: Write implementations in `app/src/voxel.ts`**

```ts
export const WORKSHOP_COLOR = "#7fb6ff";

export function workshopVoxels(body: string): Voxel[] {
  const voxels: Voxel[] = [];
  const hw = 2; // small 5-wide shed
  for (let x = -hw; x <= hw; x++) {
    for (let z = -hw; z <= hw; z++) {
      if (Math.abs(x) === hw || Math.abs(z) === hw) {
        for (let y = 0; y < 2; y++) voxels.push({ x, y, z, color: body });
      }
    }
  }
  voxels.push({ x: 0, y: 2, z: 0, color: body });
  voxels.push({ x: 0, y: 1, z: hw, color: WINDOW_COLOR });
  return voxels;
}

export function parkVoxels(size: number): Voxel[] {
  const voxels: Voxel[] = [];
  const r = Math.min(3, Math.max(1, size));
  for (let x = -r; x <= r; x++)
    for (let z = -r; z <= r; z++) {
      if (Math.abs(x) === r && Math.abs(z) === r) continue;
      voxels.push({ x, y: 0, z, color: BUSH_COLOR });
    }
  voxels.push(...treeVoxels("#86c255"));
  voxels.push(...benchVoxels());
  if (size >= 3) voxels.push(...fountainVoxels());
  return voxels;
}

export function landmarkVoxels(height: number, body: string, glow: string): Voxel[] {
  const voxels: Voxel[] = [];
  const base = 2;
  for (let y = 0; y < height; y++) {
    const r = y < 2 ? 2 : y < height - 1 ? 1 : 0;
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++)
        if (Math.abs(x) === r || Math.abs(z) === r || r === 0)
          voxels.push({ x, y, z, color: y === height - 1 ? glow : body });
  }
  return voxels;
}

export function todoSignVoxels(): Voxel[] {
  return signVoxels(SIGN_POLE, "#ffd24a");
}

export function markerVoxels(color: string): Voxel[] {
  return [
    { x: 0, y: 0, z: 0, color },
    { x: 0, y: 1, z: 0, color },
    { x: 0, y: 2, z: 0, color },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/voxel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/voxel.ts app/src/voxel.test.ts
git commit -m "feat(app): add workshop, park, landmark and sign voxel blueprints"
```

---

### Task 7: Add showSignals store toggle

**Files:**
- Modify: `app/src/store.ts`

**Interfaces:**
- Produces: `tweaks.showSignals: boolean` (default `true`). Consumed by Task 9.

- [ ] **Step 1: Add to Tweaks interface**

```ts
export interface Tweaks {
  // ...existing...
  showSignals: boolean;
}
```

- [ ] **Step 2: Add to DEFAULT_TWEAKS**

```ts
  showSignals: true,
```

- [ ] **Step 3: Add to the merge spread**

Inside the `merge` function, where `tweaks` is spread from `DEFAULT_TWEAKS`, ensure `showSignals` is included. Because `DEFAULT_TWEAKS` already carries it, the spread `...DEFAULT_TWEAKS` covers it; verify the persisted `...tweaks` doesn't drop it. The existing pattern already spreads `DEFAULT_TWEAKS` first, so add `showSignals` to `DEFAULT_TWEAKS` (Step 2) and it flows through. No extra change needed, but confirm the persisted partial doesn't have a stale default that removes it.

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/store.ts
git commit -m "feat(app): add showSignals display toggle"
```

---

### Task 8: Active-session citizens

**Files:**
- Modify: `app/src/components/three/People.tsx`

**Interfaces:**
- Consumes: `app/src/layered.ts` `activeCitizen`; `useNeighborhood`; `useApp` `selected`.
- Produces: people only for active or selected sessions.

- [ ] **Step 1: Update People.tsx**

```tsx
import { useMemo } from "react";
import { useCity } from "../../city";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";
import { PROJECT_PALETTE } from "../../theme";
import { activeCitizen } from "../../layered";
import { personVoxels, placeVoxels, type Voxel } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";

const PERSON_SIZE = 0.15;

export function People() {
  const { blocks } = useCity();
  const { data } = useNeighborhood();
  const selected = useApp((s) => s.selected);
  const showPeople = useApp((s) => s.tweaks.showPeople);

  const voxels = useMemo(() => {
    if (!data) return [];
    const out: Voxel[] = [];
    const now = Date.now();
    blocks.forEach((block, bi) => {
      if (block.kind === "plaza") return;
      const project = data.projects.find((p) => p.id === block.projectId);
      if (!project) return;
      block.houses.forEach((slot, i) => {
        const session = project.sessions[slot.index];
        if (!session) return;
        const isActive = activeCitizen(session.timeUpdated, now);
        const isSelected = selected?.id === session.id;
        if (!isActive && !isSelected) return;
        const shirt =
          isSelected ? "#ffd24a"
          : PROJECT_PALETTE[(bi * 5 + i * 3) % PROJECT_PALETTE.length];
        const side = i % 2 === 0 ? -1 : 1;
        const bx = slot.x + side * 0.85;
        const bz = slot.z;
        for (const v of placeVoxels(personVoxels(shirt), bx, bz, PERSON_SIZE)) out.push(v);
      });
    });
    return out;
  }, [blocks, data, selected]);

  if (voxels.length === 0 || !showPeople) return null;
  return <InstancedVoxels voxels={voxels} voxelSize={PERSON_SIZE} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/components/three/People.tsx
git commit -m "feat(app): show citizens only for active or selected sessions"
```

---

### Task 9: Service ring render (workshops, park, landmark)

**Files:**
- Create: `app/src/components/three/ServiceRing.tsx`
- Modify: `app/src/components/three/Scene.tsx`

**Interfaces:**
- Consumes: `app/src/layered.ts`, `app/src/voxel.ts`, `useCity`, `useNeighborhood`, `useApp`.
- Produces: `<ServiceRing />`, mounted in `Scene` after `<City />`.

- [ ] **Step 1: Write the component**

```tsx
import { useMemo } from "react";
import { useCity } from "../../city";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";
import {
  landmarkHeight,
  parkSize,
  workshopSpots,
  workshopColor,
} from "../../layered";
import {
  landmarkVoxels,
  parkVoxels,
  workshopVoxels,
} from "../../voxel";
import { placeVoxels } from "../../voxel";
import { MODEL_ROOF, UNKNOWN_ROOF } from "../../theme";
import { InstancedVoxels } from "./InstancedVoxels";

const SIZE = 0.4;

export function ServiceRing() {
  const { blocks } = useCity();
  const { data } = useNeighborhood();
  const showSignals = useApp((s) => s.tweaks.showSignals);
  const select = useApp((s) => s.select);

  const lots = useMemo(() => {
    if (!data) return [];
    const out: { id: string; x: number; z: number; voxels: ReturnType<typeof landmarkVoxels> }[] = [];
    for (const block of blocks) {
      if (block.kind === "plaza") continue;
      const project = data.projects.find((p) => p.id === block.projectId);
      if (!project) continue;

      const h = landmarkHeight(project.totalCost);
      const bodyColor = "#d8d4c8";
      const landmark = landmarkVoxels(h, bodyColor, "#ffd98a").map((v) => ({
        ...v,
        x: v.x + block.x,
        z: v.z + block.z,
      }));
      const park = project.todoCount > 0 ? parkVoxels(parkSize(project.todoCount)) : [];
      const topTools = [...new Set(project.sessions.flatMap((s) => s.toolNames ?? []))].slice(0, 4);
      const workshops = workshopSpots(topTools, block);

      out.push({
        id: block.projectId,
        x: block.x,
        z: block.z,
        voxels: [
          ...landmark,
          ...placeVoxels(park, block.x + 3, block.z - 3, SIZE),
          ...workshops.flatMap((w) =>
            placeVoxels(workshopVoxels(workshopColor(w.tool)), w.x, w.z, SIZE),
          ),
        ],
      });
    }
    return out;
  }, [blocks, data]);

  if (!showSignals || lots.length === 0) return null;

  return (
    <group>
      {lots.map((lot) => (
        <InstancedVoxels key={lot.id} voxels={lot.voxels} voxelSize={SIZE} onClick={() => {
          // select the project's first session to scope the block
          const project = data?.projects.find((p) => p.id === lot.id);
          if (project?.sessions[0]) select(project.sessions[0]);
        }} />
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Mount in Scene.tsx**

Add import and render after `<City />`:

```tsx
import { ServiceRing } from "./ServiceRing";
// ...
<City />
<ServiceRing />
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/components/three/ServiceRing.tsx app/src/components/three/Scene.tsx
git commit -m "feat(app): render per-block service ring (workshops, park, landmark)"
```

---

### Task 9b: Drive house window rows from message count

**Files:**
- Modify: `app/src/components/three/House.tsx`
- Modify: `app/src/house.ts`
- Test: `app/src/house.test.ts`

**Interfaces:**
- Consumes: `app/src/layered.ts` `houseWindowRows`; `SessionData.messageCount`.
- Produces: `House` passes `messageCount` into `houseParams`, which derives window rows for `LitWindows` (via `houseWindowGlows`). Keeps windows as glow quads owned by `LitWindows.tsx`.

- [ ] **Step 1: Write the failing test**

Create `app/src/house.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { houseParams } from "./house";
import { houseWindowGlows } from "./house";
import type { SessionData } from "./types";

function session(overrides: Partial<SessionData> = {}): SessionData {
  return {
    id: "s1",
    title: "t",
    model: "deepseek-v4-flash",
    agent: null,
    cost: 1,
    tokensIn: 100,
    tokensOut: 50,
    timeCreated: 1,
    timeUpdated: 1,
    slug: "s",
    directory: "/x",
    parentId: null,
    messageCount: 0,
    patchCount: 0,
    toolNames: [],
    diffAdditions: 0,
    diffDeletions: 0,
    ...overrides,
  };
}

describe("houseParams window rows", () => {
  test("low message count yields a single window row", () => {
    const hp = houseParams(session({ messageCount: 3 }), 0);
    const glows = houseWindowGlows(hp, 0, 0);
    const ys = new Set(glows.map((g) => g.py));
    expect(ys.size).toBeLessThanOrEqual(1.5);
  });

  test("high message count yields more window rows", () => {
    const low = houseParams(session({ messageCount: 3 }), 0);
    const high = houseParams(session({ messageCount: 30 }), 0);
    expect(houseWindowGlows(high, 0, 0).length).toBeGreaterThan(
      houseWindowGlows(low, 0, 0).length,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/house.test.ts`
Expected: FAIL (messageCount doesn't affect window layout yet)

- [ ] **Step 3: Implement**

In `app/src/house.ts`, import `houseWindowRows` from `./layered`, add a `windowRows: number` field to `HouseParams`, and set it from `session.messageCount` in `houseParams`:

```ts
import { houseWindowRows } from "./layered";
// ...
export interface HouseParams {
  // ...existing...
  windowRows: number;
}
// in houseParams:
windowRows: houseWindowRows(session.messageCount),
```

In `houseOptions`, thread `windowRows` into `houseVoxels`' `windows` handling. In `windowVoxels` (in `app/src/voxel.ts`) accept an optional `rows` param and lay windows in additional rows when `rows > 1`. Adjust `houseOptions` to pass `rows: hp.windowRows`.

In `app/src/components/three/House.tsx`, no change is needed if it already builds voxels from `houseParams` (verify it passes the session to `houseParams`; add `session` argument if it instead calls `houseScale` inline — align it to the `houseParams` path used by `LitWindows`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test app/src/house.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/house.ts app/src/voxel.ts app/src/components/three/House.tsx app/src/house.test.ts
git commit -m "feat(app): scale house window rows with session message count"
```

---

### Task 10: Signaling layer (beacons, glow, markers, signs)

**Files:**
- Create: `app/src/components/three/Signals.tsx`
- Modify: `app/src/components/three/Scene.tsx`

**Interfaces:**
- Consumes: `useCity`, `useNeighborhood`, `useApp`, `nightRef`, `GLOW_MAX`, drei `Html`/`Float`, `app/src/layered.ts`.
- Produces: `<Signals />`, mounted in `Scene` after `<ServiceRing />`.

- [ ] **Step 1: Write the component**

```tsx
import { useMemo } from "react";
import { Float, Html } from "@react-three/drei";
import { useCity } from "../../city";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";
import { heavyChange, landmarkHeight } from "../../layered";
import { markerVoxels, todoSignVoxels } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { MODEL_ROOF, UNKNOWN_ROOF } from "../../theme";

const CARD_STYLE: CSSProperties = {
  background: "#fff6e5",
  border: "3px solid #4a4453",
  borderRadius: 10,
  boxShadow: "3px 3px 0 rgba(74,68,83,0.35)",
  padding: "4px 10px",
  fontFamily: '"Nunito", sans-serif',
  fontWeight: 700,
  fontSize: 12,
  color: "#4a4453",
  whiteSpace: "nowrap",
  maxWidth: 200,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export function Signals() {
  const { blocks } = useCity();
  const { data } = useNeighborhood();
  const showSignals = useApp((s) => s.tweaks.showSignals);

  const signals = useMemo(() => {
    if (!data) return [];
    return blocks
      .filter((b) => b.kind !== "plaza")
      .map((block) => {
        const project = data.projects.find((p) => p.id === block.projectId);
        if (!project) return null;
        const beacon = project.sessions[0];
        if (!beacon) return null;
        const topModel = beacon.model ?? null;
        const roof = topModel ? MODEL_ROOF[topModel] ?? UNKNOWN_ROOF : UNKNOWN_ROOF;
        const h = landmarkHeight(project.totalCost);
        return {
          project,
          block,
          x: block.x,
          z: block.z,
          height: h,
          roof,
          markers: project.sessions
            .filter((s) => heavyChange(s.patchCount, s.diffAdditions))
            .map((s) => {
              const slot = block.houses[project.sessions.indexOf(s)];
              return slot ? { x: slot.x, z: slot.z } : null;
            })
            .filter((m): m is { x: number; z: number } => m !== null),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [blocks, data]);

  if (!showSignals || signals.length === 0) return null;

  return (
    <group>
      {signals.map((s) => (
        <Float key={s.project.id} speed={2} rotationIntensity={0} floatIntensity={0.6}>
          <Html
            center
            distanceFactor={12}
            zIndexRange={[20, 0]}
            position={[s.x, s.height * 0.4 + 1.2, s.z]}
            style={{ pointerEvents: "none" }}
          >
            <div style={CARD_STYLE}>
              {s.project.name} · {s.project.sessions.length} · ${s.project.totalCost.toFixed(2)}
            </div>
          </Html>
        </Float>
      ))}
      {signals.map((s) => (
        <InstancedVoxels
          key={`markers-${s.project.id}`}
          voxels={s.markers.flatMap((m) =>
            markerVoxels("#ff5252").map((v) => ({ ...v, x: v.x + m.x, z: v.z + m.z })),
          )}
          onClick={undefined}
        />
      ))}
      {signals.filter((s) => s.project.todoCount > 0).map((s) => (
        <InstancedVoxels
          key={`todo-${s.project.id}`}
          voxels={todoSignVoxels().map((v) => ({ ...v, x: v.x + s.x + 3, z: v.z + s.z - 3 }))}
        />
      ))}
    </group>
  );
}
```

Night-aware glow for the landmark is handled in Task 9 by passing a shared
material to `ServiceRing`'s landmark `InstancedVoxels` (see below). `Signals.tsx`
owns only `Html` beacons, heavy-change markers, and todo signs; it needs no
shader material of its own.

Add the shared glow material to `ServiceRing`. Replace the `SIZE`-const declaration
and add a `MeshStandardMaterial` driven by `nightRef`, reusing `GLOW_MAX`:

```tsx
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
// ...existing imports...
import { LAMP_GLOW, GLOW_MAX } from "../../theme";
import { nightRef } from "../../night";

const SIZE = 0.4;

// inside component:
const landmarkMaterial = useMemo(
  () => new MeshStandardMaterial({ color: "#d8d4c8", emissive: "#ffd98a", emissiveIntensity: 0, flatShading: true }),
  [],
);
useFrame(() => {
  landmarkMaterial.emissiveIntensity = nightRef.current * GLOW_MAX;
});
```

Pass `material={landmarkMaterial}` to the landmark's `InstancedVoxels` (the one
built from `landmarkVoxels`), so only the landmark glows at night — matching the
lamp behavior in `World.tsx`.

- [ ] **Step 2: Mount in Scene.tsx**

```tsx
import { Signals } from "./Signals";
// ...
<ServiceRing />
<Signals />
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS (fix any `React.CSSProperties` / `THREE` import issues — import `type { CSSProperties }` from "react" and `type { InstancedMesh }` from "three" as needed)

- [ ] **Step 4: Commit**

```bash
git add app/src/components/three/Signals.tsx app/src/components/three/Scene.tsx
git commit -m "feat(app): add in-city signaling layer (beacons, markers, todo signs)"
```

---

### Task 11: Final verification

**Files:**
- No file changes.

- [ ] **Step 1: Run the full suite**

Run: `bun test`
Expected: PASS (all app + server tests)

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Run the dev build to confirm the scene boots**

Run: `bun run build`
Expected: PASS (tsc --noEmit + vite build)

- [ ] **Step 4: Manual smoke check**

Run `bun run dev` and verify: service ring appears per block, block beacon label shows on hover/selection, todo signs over parks, heavy-change markers over busy sessions, people only near active/selected sessions, and beacons/markers glow at night.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "test(app): verify layered city build"
```
