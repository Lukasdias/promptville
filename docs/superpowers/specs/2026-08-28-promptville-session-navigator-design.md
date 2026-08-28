# Promptville — Session Navigator Design Spec

Date: 2026-08-28
Status: Draft

## Overview

Promptville visualizes opencode history as a 3D town, but the primary value — **navigating opencode sessions** — was never its strong point. With ~475 sessions across ~25 projects, findable only by orbiting the town and clicking houses, the 3D canvas became the product and the actual navigation payoff was deprioritized.

This spec adds a **Session Navigator**: a companion panel that makes the town actually usable for finding, reviewing, and resuming sessions. Pick a session anywhere → the camera flies to its house, a cartoon beacon marks it, and a toast acknowledges. Navigation becomes search-driven instead of click-lottery.

Goals (all four, from brainstorming):

1. **Find a specific past session** — search + filters + sort, client-side.
2. **Resume/open a session in opencode** — copy `opencode <dir> --session <id>` to the clipboard (no server spawn).
3. **Browse the timeline chronologically** — list grouped by day.
4. **Understand patterns / high-level review** — aggregate stats remain the StatsPanel; the navigator surfaces per-session context (title + last-message snippet).

## Stack

Unchanged from `2026-08-27-opencode-city-3d-design.md` (Bun + Drizzle read-only server, Vite + React 19 + R3F, TanStack Query v5, Zustand for UI state). This work adds no dependencies.

## Architecture

New/changed files:

```
server/
  db.ts            # + sessionDetail(sessionId): SessionDetail with last-message snippet
  index.ts         # + GET /api/session/:id
app/src/
  types.ts         # + slug, directory, timeUpdated, parentId, snippet
  navigator.ts     # pure filter/sort/group logic (tested), like layout.ts
  store.ts         # + navigatorOpen, search, filters, sort, flyingTo, toasts
  query.ts         # + sessionQueryOptions(id)
  api.ts           # + fetchSession(id)
  components/navigator/
    NavigatorPanel.tsx   # left paper card: search, filters, sort, timeline list
    SessionRow.tsx       # one session entry (title, chips, snippet)
  components/three/
    CameraRig.tsx        # fly-to tween to a selected house (or refactor Scene)
  components/locate/
    BeaconMarker.tsx     # cartoon pin/flag over the selected/flying house
    FloatLabel.tsx       # postage-stamp name tag over houses
    Toasts.tsx           # bottom-center animated toast stack
  components/hud/
    DetailCard.tsx       # + "Open in opencode" button (clipboard)
    Header.tsx           # + "List" (navigator) toggle button
  index.css / tailwind    # toast + label + navigator styles (paper-card family)
```

## Data & API

### Enrich `GET /api/neighborhood`

Add to each `SessionData` (list stays light; no snippet):

- `slug: string`
- `directory: string`
- `timeUpdated: number`   (ms epoch)
- `parentId: string | null`

`ProjectData` gains `worktree` (already its `path`; keep as-is).

### New `GET /api/session/:id`

Returns the full session plus a **last-message snippet** so every session is self-describing:

```ts
{
  ...SessionData,             // incl. slug, directory, timeUpdated, parentId
  snippet: string;            // last assistant/user text, trimmed; "" if none
}
```

Snippet extraction (read-only): query `message` rows for `session_id` ordered by `time_created` desc, take the latest, join its `part` rows, pull the first `data.path` / inline `data.text` string content, trim to ~140 chars. Snippet is display-only; it is never used for search matching.

### Resume — client-side clipboard

Per design decision, resuming is not a server action. The frontend copies `opencode <directory> --session <id>` via `navigator.clipboard.writeText` and shows a toast. The server only exposes `directory` + `id`.

### Search / filters

All client-side — 475 sessions filter trivially in memory. No message-content full-text search. Filter dimensions:

- text (title, slug, project name)
- project (multi-select from loaded projects)
- model (multi-select)
- agent (multi-select)
- date range (from/to)

Sort keys: `timeUpdated` (default desc), `cost` (desc), `tokens` (sum, desc), `title` (a–z).

## Client Data Layer

- `query.ts`: add `sessionQueryOptions(id)` → `['session', id]`, fetched lazily when a session is selected (for the snippet). `staleTime` 5 min, no refetch on window focus.
- `store.ts`: add to `AppState`:
  - `navigatorOpen: boolean` + `toggleNavigator`
  - `search: string` + `setSearch`
  - `filters: { projects: string[]; models: string[]; agents: string[]; dateFrom: number | null; dateTo: number | null }` + `setFilter`
  - `sortKey: SortKey` + `setSortKey`
  - `flyingTo: string | null` (session id) + `setFlyingTo`
  - `toasts: Toast[]` + `pushToast` — `Toast = { id: number; kind: "info" | "success" | "error"; message: string }`; auto-dismiss ~2.5s.
- Persist navigator preferences (open/closed, search, filters, sort) in the existing `promptville-tweaks` persisted slice; do not persist `toasts` or `flyingTo`.

## Session Navigator Panel (left)

A `paper-card` panel sliding in from the left; brand styling (cream fill, ink border, soft shadow, Fredoka headings, Nunito body). Header row: search input (autofocused on toggle), filter button, sort select, close. Then a scrollable list grouped by day (`Today`, `Yesterday`, then ISO dates); each day is a small caps header.

`SessionRow` layout (scaled to complexity — compact):

- Line 1: title (Fredoka, truncate) + optional model badge color chip.
- Line 2: project chip, cost, tokens, date — muted Nunito.
- Line 3: snippet when loaded (2 lines clamp, muted).
- Actions on row: click = select + fly-to; a row-level "↗ opencode" ghost button = copy command + toast.

Behavior:

- Clicking a row sets `selected`, sets `flyingTo` to the session id, and (via `CameraRig`) flies the camera to that house; `BeaconMarker` and `DetailCard` react.
- Default list = all sessions sorted by `timeUpdated` desc (recency timeline). Filters/sort narrow/reorder it.
- Empty result → soft in-panel empty state ("No sessions match").

## In-World Locating UI

- **FloatLabel** — selected/focused block only (perf): a drei `Html` postage-stamp tag over each house showing the title (or slug) once the navigator is active; turns on hover. Cartoonish: small cream tag with ink border and a little pole/pointer.
- **BeaconMarker** — a bouncing `Float` pin/balloon + flag over the `flyingTo`/`selected` house, so the eye lands instantly after a fly-to. Brand colors; gentle idle bob; hidden when selection cleared.
- **Toasts** — bottom-center springy paper cards, stacked, auto-dismiss. Copy confirmation, fly-to acknowledgement, and "no results" messaging.
- **CameraRig** — tween the camera to the flying house's block (smooth eased fly-to, not a jump), respecting the existing polar/distance clamps. Reuses/refactors the current select refocus where feasible; never `setState` in `useFrame`.

## Visual Identity

Everything reuses the existing storybook-toytown language: `paper-card` cream fills, thick rounded ink borders, soft drop shadows, Fredoka + Nunito, candy palette, emoji/icon marks. Toasts = rounded paper greeting cards; BeaconMarker = a flag/balloon pin; FloatLabel = a tiny postage-stamp tag. No new fonts, no generic UI kit, no new text outside English.

## Interaction & Keyboard

Keep existing controls. Add:

- Header "List" button and `L` toggle the navigator.
- `/` or `Ctrl/⌘-K` focus the navigator search (open it if closed).
- `Esc` clears selection/beacon (and closes toast stack).
- `F` still focuses selection; `Tab` still toggles help.

Update `HelpPanel.tsx` GROUPS to include the new keys.

## R3F Application Notes

Follow `docs/r3f-reference.md` and the AGENTS.md rules strictly: no `setState` in `useFrame`, hooks only inside `<Canvas>`, shared geometries/materials where new (beacon uses instanced/simple meshes, not many `<mesh>`), ground planes rotated `-90°` on X, keep `frameloop="always"`.

## Testing

- Server (`bun test`): fixture DB verifies `GET /api/session/:id` returns the enriched fields + a trimmed snippet (and empty string when the session has no messages); verifies neighborhood list now carries `slug`/`directory`/`timeUpdated`/`parentId`.
- Pure logic (`navigator.ts`): unit tests for filter, sort, day-grouping, and snippet-clamp behavior (mirrors `layout.ts` test pattern).
- Frontend smoke: select from navigator drives `flyingTo` + beacon + toast; clipboard copy writes the command; empty-filter state renders. Run `bun run typecheck` and `bun test`.

## Scripts

Unchanged: `bun run dev`, `bun run build`, `bun test`.

## Out of Scope

- No message full-text search.
- No session editing / mutations of the opencode DB.
- No spawning opencode from the server (resume = client clipboard).
- No `opencode serve` / web integration.
- No real-time live-updates beyond manual page refresh.
- No changes to the aggregate `StatsPanel` beyond what already exists.
