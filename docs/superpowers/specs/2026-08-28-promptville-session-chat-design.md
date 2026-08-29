# Promptville — Session Chat Sidebar Design Spec

Date: 2026-08-28
Status: Draft
Branch: feat/session-chat

## Overview

Clicking a house (session) opens a right-side chat panel that shows the full back-and-forth between the user and the agent for that session, as message bubbles. The transcript is fetched on demand per session and styled to match the paper-card HUD.

## Goals

1. A clean right-side chat transcript for each session's conversation.
2. User prompts + assistant text responses only (no tool/reasoning/step noise).
3. Lazy per-session load; auto-scroll to latest; easy close.
4. Reuse the existing paper-card look, fonts, and custom scrollbar.

## Architecture

```
server/
  db.ts          # + sessionMessages(db, sessionId): ChatMessage[]  (pure, reads message/part)
  index.ts       # + GET /api/session/:id/messages
app/src/
  types.ts       # + ChatMessage
  api.ts         # + fetchMessages(id)
  query.ts       # + messagesQueryOptions(id) + useMessages(id)
  store.ts       # + chatOpen, closeChat; select opens chat
  components/hud/
    ChatSidebar.tsx  # NEW: right-docked transcript panel
  App.tsx        # + mount <ChatSidebar />
tests/
  api.test.ts    # + transcript tests (fixture message/part)
```

## Data & API

### `GET /api/session/:id/messages`

Response:

```ts
{
  messages: {
    id: string;
    role: "user" | "assistant";
    text: string;
    time: number;   // ms epoch
  }[];
}
```

Ordered by `message.time_created` ascending. For each `message`, its `part` rows (ordered by `part.time_created` asc) are scanned; the `text`-type parts' `text` strings are joined into one `text`. Messages whose joined text is empty (tool/reasoning/step-only) are dropped. Unknown session → `404 { error: "not found" }`. Read-only on the opencode DB.

`sessionMessages(db, sessionId)` is a pure helper in `server/db.ts` using the existing read-only `message`/`part` tables.

## Client Data

- `types.ts`: `export interface ChatMessage { id: string; role: "user" | "assistant"; text: string; time: number }`.
- `api.ts`: `fetchMessages(id: string): Promise<{ messages: ChatMessage[] }>`.
- `query.ts`: `messagesQueryOptions(id)` (`queryKey: ["messages", id]`, `staleTime` 10 min, no refetch on window focus) and `useMessages(id: string | null | undefined)` (enabled when `id` set).

## Store

- Add `chatOpen: boolean` and `closeChat: () => void`.
- `select(session)` also sets `chatOpen: true`; `selectBuilding` and `clearSelection` set `chatOpen: false`.
- Not persisted (transient).

## ChatSidebar

`app/src/components/hud/ChatSidebar.tsx`:

- Renders a right-docked paper-card panel when `selected` is a session and `chatOpen` is true.
- Header: session title + close (✕) button (calls `closeChat`).
- Body: scrollable transcript (custom scrollbar). Messages are bubbles:
  - user → right-aligned, amber background;
  - assistant → left-aligned, cream background;
  - a small muted timestamp (HH:MM) under each; consecutive same-role messages grouped.
- Auto-scroll to bottom on first load / session change.
- States: loading (skeleton/hint), empty ("No messages"), error (small notice), success (transcript).
- Reuses `paper-card`, Fredoka/Nunito, `Tooltip` on the close button.

## Wiring

- `App.tsx`: mount `<ChatSidebar />` alongside the other HUD (right side; coexists with the left navigator).
- Selecting a session (house click or navigator row) opens it; the detail card is unchanged.

## Testing

- Server (`bun test`): extend the fixture with `message`/`part` rows; assert `GET /api/session/:id/messages` returns only user/assistant text turns ordered ascending, joins multi-part text, drops tool/reasoning/step-only messages, and 404s an unknown id.
- Client: manual smoke — click a house/navigator row opens the chat, bubbles render, close works.

## Scripts

Unchanged: `bun run dev`, `bun run build`, `bun test`.

## Out of Scope

- No editing/sending messages; read-only transcript.
- No streaming/real-time; static fetch per selection.
- No tool/patch/reasoning display (user/assistant text only).
- No change to the traffic/road graph or scene.
