# Promptville Session Chat Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side chat panel that shows the user↔assistant text conversation for the selected session, loaded on demand.

**Architecture:** A pure `sessionMessages(db, id)` helper in `server/db.ts` (read-only `message`/`part` join) exposed via `GET /api/session/:id/messages`. The client fetches it with TanStack Query into a `ChatSidebar` paper-card panel that auto-opens when a session is selected; the store adds `chatOpen`.

**Tech Stack:** Bun + Drizzle (read-only), React 19, TanStack Query v5, Zustand, Tailwind (paper-card HUD).

## Global Constraints

- Server reads the opencode DB read-only; never mutate it.
- Only `role: "user" | "assistant"` text turns are returned — tool/reasoning/step-only messages are dropped.
- Timeline is immutable → `staleTime` long, no refetch on window focus.
- No `any`; avoid `as` unless necessary; no comments unless asked.
- UI copy in English; fonts Fredoka + Nunito; paper-card storybook styling; custom scrollbars via index.css.
- Chat is not persisted in the tweaks slice (transient).

---

### Task 1: Server — `sessionMessages` helper

**Files:**
- Modify: `server/db.ts`
- Test: `tests/messages.test.ts` (create)

**Interfaces:**
- Produces:
  - `export interface ChatMessage { id: string; role: "user" | "assistant"; text: string; time: number }`
  - `sessionMessages(db: Database, sessionId: string): ChatMessage[]` — asc by `timeCreated`, text parts joined, empty/tool/non-user-assistant dropped.

- [ ] **Step 1: Write the failing test (`tests/messages.test.ts`)**

```ts
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { sessionMessages } from "../server/db";

function chatDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE project (id TEXT PRIMARY KEY, worktree TEXT NOT NULL, name TEXT, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, sandboxes TEXT NOT NULL);
    CREATE TABLE session (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, slug TEXT NOT NULL, directory TEXT NOT NULL, version TEXT NOT NULL);
    CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL);
  `);
  db.run(`INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('u1','x',100,110,'{"role":"user"}'),
    ('a1','x',120,130,'{"role":"assistant"}'),
    ('a2','x',140,150,'{"role":"assistant"}'),
    ('other','x',180,190,'{"role":"system"}')`);
  db.run(`INSERT INTO part (message_id, session_id, time_created, time_updated, data) VALUES
    ('u1','x',100,110,'{"type":"text","text":"prompt 1"}'),
    ('a1','x',120,130,'{"type":"text","text":"reply one"}'),
    ('a1','x',125,130,'{"type":"text","text":" more"}'),
    ('a2','x',140,150,'{"type":"tool","tool":"bash"}'),
    ('other','x',180,190,'{"type":"text","text":"sys"}')`);
  return db;
}

describe("sessionMessages", () => {
  test("returns user + assistant text turns in order, joining multi-part text", () => {
    const msgs = sessionMessages(chatDb(), "x");
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[0]).toMatchObject({ id: "u1", role: "user", text: "prompt 1" });
    expect(msgs[1]).toMatchObject({ id: "a1", role: "assistant", text: "reply one more" });
  });
  test("drops tool-only and non user/assistant messages", () => {
    const msgs = sessionMessages(chatDb(), "x");
    expect(msgs.some((m) => m.id === "a2" || m.id === "other")).toBe(false);
  });
  test("returns empty for an unknown session", () => {
    expect(sessionMessages(chatDb(), "nope")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `bun test tests/messages.test.ts`
Expected: FAIL (`sessionMessages` not exported).

- [ ] **Step 3: Implement `sessionMessages` in `server/db.ts`**

Add the interface and a `parseJson` helper near the top (after imports):

```ts
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: number;
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
```

Add the function at the end of `server/db.ts`:

```ts
export function sessionMessages(db: Database, sessionId: string): ChatMessage[] {
  const client = createDb(db);
  const rows = client
    .select({ id: message.id, time: message.timeCreated, data: message.data })
    .from(message)
    .where(eq(message.sessionId, sessionId))
    .orderBy(asc(message.timeCreated))
    .all();

  const out: ChatMessage[] = [];
  for (const row of rows) {
    const meta = parseJson<{ role?: string }>(row.data);
    const role = meta?.role === "user" ? "user" : meta?.role === "assistant" ? "assistant" : null;
    if (!role) continue;

    const parts = client
      .select({ data: part.data })
      .from(part)
      .where(eq(part.messageId, row.id))
      .orderBy(asc(part.timeCreated))
      .all();

    let text = "";
    for (const p of parts) {
      const pd = parseJson<{ type?: string; text?: string }>(p.data);
      if (pd?.type === "text" && typeof pd.text === "string") text += pd.text;
    }
    text = text.trim();
    if (!text) continue;

    out.push({ id: row.id, role, text, time: row.time });
  }
  return out;
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `bun test tests/messages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/db.ts tests/messages.test.ts
git commit -m "feat(server): add sessionMessages transcript helper"
```

---

### Task 2: Server — route `GET /api/session/:id/messages`

**Files:**
- Modify: `server/index.ts`
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: `sessionMessages` from `server/db.ts`.
- Produces: `GET /api/session/:id/messages` → `200 { messages: ChatMessage[] }` or `404 { error: "not found" }`.

- [ ] **Step 1: Add the route to `server/index.ts`**

Update the import:

```ts
import { queryNeighborhood, sessionDetail, sessionMessages } from "./db";
```

Add a route before the plain `/api/session/:id` match (order matters only for clarity; the plain regex won't catch `/messages`):

```ts
      const mm = url.pathname.match(/^\/api\/session\/([^/]+)\/messages$/);
      if (mm) {
        db ??= open();
        return Response.json({ messages: sessionMessages(db, decodeURIComponent(mm[1])) });
      }
```

- [ ] **Step 2: Add endpoint tests to `tests/api.test.ts`**

```ts
test("GET /api/session/:id/messages returns the text transcript", async () => {
  const handler = createHandler(() => makeFixture());
  const res = await handler(new Request("http://localhost/api/session/s1/messages"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.messages).toHaveLength(1);
  expect(body.messages[0]).toMatchObject({ id: "m1", role: "user", time: 1700000000000 });
  expect(body.messages[0].text.trim()).toContain("I want a demo line");
});

test("GET /api/session/:id/messages returns 404 for unknown session", async () => {
  const handler = createHandler(() => makeFixture());
  const res = await handler(new Request("http://localhost/api/session/nope/messages"));
  expect(res.status).toBe(404);
});
```

> Note: the existing fixture has `s1` = user `m1` (with a text part) + assistant `m2` (tool-only), so the transcript is the single user message; the 404 path hits the handler's catch (ensure the messages route falls through to the `404` return for an ids path that doesn't exist — see Step 3).

- [ ] **Step 3: Ensure unknown-session messages returns 404**

In `server/index.ts`, the `/messages` route currently returns `{ messages: sessionMessages(...) }` unconditionally (empty array for unknown). To return `404` for a real unknown session, check `sessionDetail` exists first:

```ts
      const mm = url.pathname.match(/^\/api\/session\/([^/]+)\/messages$/);
      if (mm) {
        db ??= open();
        const id = decodeURIComponent(mm[1]);
        if (!sessionDetail(db, id)) return Response.json({ error: "not found" }, { status: 404 });
        return Response.json({ messages: sessionMessages(db, id) });
      }
```

- [ ] **Step 4: Run the tests**

Run: `bun test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/index.ts tests/api.test.ts
git commit -m "feat(server): add session messages route"
```

---

### Task 3: Client — types, API, query

**Files:**
- Modify: `app/src/types.ts`
- Modify: `app/src/api.ts`
- Modify: `app/src/query.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `ChatMessage { id; role; text; time }` and `ChatTranscript { messages: ChatMessage[] }`.
  - `api.ts`: `fetchMessages(id: string): Promise<ChatTranscript>`.
  - `query.ts`: `messagesQueryOptions(id)` + `useMessages(id: string | null | undefined)`.

- [ ] **Step 1: Add types**

In `app/src/types.ts`:

```ts
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: number;
}

export interface ChatTranscript {
  messages: ChatMessage[];
}
```

- [ ] **Step 2: Add `fetchMessages` to `app/src/api.ts`**

```ts
import type { Neighborhood, SessionDetail, ChatTranscript } from "./types";

export async function fetchMessages(id: string): Promise<ChatTranscript> {
  const res = await fetch(`/api/session/${encodeURIComponent(id)}/messages`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as ChatTranscript;
}
```

- [ ] **Step 3: Add `useMessages` to `app/src/query.ts`**

```ts
import { fetchNeighborhood, fetchSession, fetchMessages } from "./api";

export function useMessages(id: string | null | undefined) {
  return useQuery({
    queryKey: ["messages", id ?? "none"],
    queryFn: () => {
      if (!id) return Promise.reject(new Error("no session"));
      return fetchMessages(id);
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}
```

- [ ] **Step 4: Verify typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/types.ts app/src/api.ts app/src/query.ts
git commit -m "feat(app): add chat transcript types, fetch, and query"
```

---

### Task 4: Store — `chatOpen`

**Files:**
- Modify: `app/src/store.ts`

**Interfaces:**
- Produces: `chatOpen: boolean`, `closeChat: () => void`; `select(session)` sets `chatOpen: true`; `selectBuilding`/`clearSelection` set `chatOpen: false`.

- [ ] **Step 1: Add state**

In the `AppState` interface:

```ts
  chatOpen: boolean;
  closeChat: () => void;
```

Update the initializer:

```ts
      selected: null,
      select: (session) => set({ selected: session, chatOpen: true }),
      selectedBuilding: null,
      selectBuilding: (building) => set({ selectedBuilding: building, chatOpen: false }),
      clearSelection: () => set({ selected: null, selectedBuilding: null, chatOpen: false }),
```

And after `toggleAutoCycle`:

```ts
      chatOpen: false,
      closeChat: () => set({ chatOpen: false }),
```

(Do NOT add chatOpen to `partialize` — it is transient.)

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/store.ts
git commit -m "feat(store): open chat on session selection"
```

---

### Task 5: ChatSidebar component

**Files:**
- Create: `app/src/components/hud/ChatSidebar.tsx`

**Interfaces:**
- Consumes: `useApp` (`selected`, `chatOpen`, `closeChat`), `useMessages(selected?.id)`, `X` from `lucide-react`, `Tooltip`.
- Produces: `<ChatSidebar />` — right-docked paper-card transcript.

- [ ] **Step 1: Create `app/src/components/hud/ChatSidebar.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { animated, useSpring } from "@react-spring/web";
import { X } from "lucide-react";
import { useApp } from "../../store";
import { useMessages } from "../../query";
import { Tooltip } from "../ui/Tooltip";

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ChatSidebar() {
  const selected = useApp((s) => s.selected);
  const chatOpen = useApp((s) => s.chatOpen);
  const closeChat = useApp((s) => s.closeChat);
  const sessionId = selected?.id ?? null;
  const { data, isPending, isError } = useMessages(sessionId);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [data]);

  const { opacity, x } = useSpring({
    from: { opacity: 0, x: 40 },
    to: { opacity: chatOpen ? 1 : 0, x: chatOpen ? 0 : 60 },
    config: { tension: 240, friction: 24 },
  });

  if (!chatOpen || !selected) return null;

  return (
    <animated.aside
      className="absolute right-4 top-20 bottom-16 z-30 flex w-96 max-w-[26rem] flex-col"
      style={{ opacity, transform: x.to((v) => `translateX(${v}px)`) }}
    >
      <div className="paper-card flex min-h-0 flex-1 flex-col overflow-hidden p-3 font-body text-ink">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-lg font-semibold">{selected.title}</h2>
          <Tooltip label="Close chat">
            <button
              type="button"
              onClick={closeChat}
              aria-label="Close chat"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink/50 hover:bg-ink/10"
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        <div ref={scrollRef} className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1">
          {isPending && <p className="py-8 text-center text-sm opacity-60">Loading…</p>}
          {isError && <p className="py-8 text-center text-sm opacity-60">Couldn’t load the chat.</p>}
          {data && data.messages.length === 0 && (
            <p className="py-8 text-center text-sm opacity-60">No messages.</p>
          )}
          {data?.messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl border-2 border-ink/40 px-3 py-2 text-sm ${
                    isUser ? "bg-amber-200" : "bg-cream"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className="mt-1 text-right text-[10px] opacity-50">{clockTime(m.time)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </animated.aside>
  );
}
```

- [ ] **Step 2: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/hud/ChatSidebar.tsx
git commit -m "feat(app): add session chat sidebar"
```

---

### Task 6: Wire into App

**Files:**
- Modify: `app/src/App.tsx`

**Interfaces:**
- Produces: mounts `<ChatSidebar />` with the other HUD panels.

- [ ] **Step 1: Mount `<ChatSidebar />`**

Add import `import { ChatSidebar } from "./components/hud/ChatSidebar";` and render `<ChatSidebar />` after `<NavigatorPanel />`.

- [ ] **Step 2: Verify typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat(app): mount chat sidebar"
```

---

### Task 7: Full verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: PASS (messages + api + all existing).

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Run the production build**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev`. Verify:
- Clicking a house (or a navigator row) opens the chat sidebar on the right.
- Transcript shows user + assistant bubbles, ordered, timestamps.
- A tool-only/everything message is skipped; empty sessions show "No messages".
- Close (✕) hides the panel without deselecting the house.
- The left navigator and right chat can both be open at once.

- [ ] **Step 5: Commit (if smoke found fixes, address them first)**

```bash
git add -A
git commit -m "chore: verify session chat sidebar"
```

---

## Self-Review

**Spec coverage:**
- server `sessionMessages` + transcript shape → Task 1.
- `/messages` route (200 + 404) → Task 2.
- client types/api/query → Task 3.
- store `chatOpen` + select opens chat → Task 4.
- `ChatSidebar` panel → Task 5.
- App wiring → Task 6.
- verify → Task 7.

**Placeholder scan:** no TBD/TODO; real code throughout; the `404` nuance is explicitly handled in Task 2 Step 3.

**Type consistency:** `ChatMessage`/`ChatTranscript` defined in Task 3 and used by api/query/ChatSidebar. `sessionMessages` (Task 1) consumed by the route (Task 2). `chatOpen`/`closeChat`/`select`-change (Task 4) consumed by ChatSidebar (Task 5). `useMessages` (Task 3) consumed by ChatSidebar. `Tooltip`/`X` reused as elsewhere.
