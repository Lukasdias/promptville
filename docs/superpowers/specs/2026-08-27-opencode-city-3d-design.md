# Promptville — Design Spec

Date: 2026-08-27
Status: Draft

## Overview

**Promptville** — a local-only 3D web app that visualizes the user's opencode history as a low-poly cartoon toy town. Each opencode **project** is a city block; each **session** is a house. Houses encode model, agent, cost, and token usage. A paper-style HUD shows aggregate user stats. Data is read live from the opencode sqlite database via a small Bun API server.

## Stack

- **Runtime**: Bun (`bun:sqlite`, `Bun.serve`)
- **Frontend**: Vite + React 19 + TypeScript
- **3D**: `@react-three/fiber`, `@react-three/drei`, `three`
- **State**: TanStack Query (v5) for async data (`/api/neighborhood`); Zustand only for UI selection state.
- **Styling**: Tailwind CSS (HUD only; the 3D scene is Three.js)
- **Fonts**: Fredoka (display) + Nunito (body) via Google Fonts
- **Reference**: R3F patterns applied throughout — see `docs/r3f-reference.md`

## Architecture

```
opencode-city/
  server/
    index.ts        # Bun.serve API
    db.ts           # bun:sqlite read-only access + queries
  app/
    index.html
    src/
      main.tsx              # QueryClientProvider + fonts
      App.tsx               # canvas + HUD layout
      store.ts              # zustand: selected session only
      query.ts              # tanstack-query: neighborhoodQueryOptions + useNeighborhood
      api.ts                # fetch /api/neighborhood
      types.ts
      components/
        three/
          Scene.tsx         # sky, lights, camera, ground, blocks
          City.tsx          # block layout grid + streets
          Block.tsx         # one project block of houses
          House.tsx         # procedural low-poly house
          World.tsx         # trees, lamps, cars, clouds
          SelectedBanner.tsx# drei Html title banner + flag
        hud/
          StatsPanel.tsx
          DetailCard.tsx
          Header.tsx
          HintBar.tsx
          MissingState.tsx  # DB-missing fallback
  package.json             # workspaces: server + app; scripts: dev/build/test
  tests/
    api.test.ts
  docs/
    r3f-reference.md
    superpowers/specs/2026-08-27-opencode-city-3d-design.md
```

## Data & API

Source: `~/.local/share/opencode/opencode.db`, opened **read-only** via `bun:sqlite` (path configurable via `OPENCODE_DB_PATH` env). ~462 sessions, ~25 projects.

**Endpoint** — `GET /api/neighborhood`:

```ts
{
  stats: {
    totalSessions: number;
    totalCost: number;
    totalTokensIn: number; totalTokensOut: number;
    topModels: { model: string; count: number }[];
    topAgents: { agent: string; count: number }[];
    topProjects: { name: string; count: number }[];
    busiestDay: string | null;
  },
  projects: {
    id: string;
    name: string;          // worktree basename, fallback to path
    path: string;
    iconColor: string | null;
    sessions: {
      id: string;
      title: string;
      model: string | null;   // parsed from JSON model.id; null if empty
      agent: string | null;
      cost: number;
      tokensIn: number;
      tokensOut: number;
      timeCreated: number;    // ms epoch
    }[];
  }[]
}
```

Queries: join `session` → `project` (via `project_id`), parse `model` JSON. `tokens` = `tokens_input + tokens_output`. Sessions with empty title default to `(untitled)`.

**Client data fetching**: the frontend fetches once through TanStack Query (`useNeighborhood`, query key `['neighborhood']`, `staleTime` 5 min, no refetch on window focus) and shares the result across the scene and HUD. A manual page refresh re-fetches.

**Error handling**: DB missing/unreadable → `500` with `{ error }`; the query surfaces `isError`/`error` and the frontend renders a cartoon "map not found" state with the resolved DB path.

## 3D Scene

- **Ground**: flat low-poly plane, grass green, with a street grid. Roads = dark cream slabs with dashed lane markings between blocks.
- **Blocks**: one per project, arranged left-to-right by session count (biggest projects first). Block layout: `session grid W×N` with padding; block footprint sized to its session count.
- **Houses** (procedural):
  - **Body color**: project identity — hue derived from project index spread across a candy palette.
  - **Roof color**: model when known — deepseek-v4-flash / minimax-m3 / kimi-k2.7-code / gpt-5.6-luna each get an accent; unknown/legacy → warm neutral gray. (432/462 sessions have empty model — mostly neutral roofs, keeps the town cohesive.)
  - **Height**: `log-scaled(tokensIn + tokensOut)`, clamped; 0-token sessions → tiny cottage.
  - **Roof**: cone/pyramid; chimney on some; tiny door + window inset on the facade.
- **World dressing**: soft gradient sky, drei `Float` clouds (billboards), low-poly trees, street lamps, a few small cars, one park in the center.
- **Lighting**: flat, cartoonish — hemisphere + directional with low shadow, no bloom.

## Cartoonish Visual Identity ("Storybook Toytown")

- **Palette**: pastel sky `#aee6ff → #fdf6e3`; grass greens; candy block colors; cream roads. UI cards: cream fill, thick rounded borders, soft drop shadows (children's-book look).
- **Typography**: Fredoka for the "Promptville" logotype + headings; Nunito for body. No Inter/Roboto/Space Grotesk.
- **HUD**:
  - Top-left: "Promptville" logotype with a sun/cloud mark.
  - Right: **StatsPanel** paper card — total sessions, total cost, total tokens, top models, top projects, busiest day.
  - Bottom: hint bar "Drag to orbit · Click a house".
- **Detail card**: postcard-style card popping open (spring) with session title, model badge, agent, cost, tokens, date, project name.
- **Motion**: staggered house pop-in on load; camera pan-in intro; hover scale on houses; bouncy card entrance; gentle idle bob on selected house via drei `Float`.

## Interaction

- drei `OrbitControls` (orbit, zoom; min/max polar + distance clamped above ground).
- Hover: highlight + pointer cursor.
- Click: select session → detail card + title banner (drei `Html` with small flag) above the house.

## R3F Application Notes

Concrete R3F decisions from `docs/r3f-reference.md`:

- `frameloop="demand"` + OrbitControls (drei auto-invalidates) so the static town is GPU-idle.
- Shared `BoxGeometry` + `useMemo` materials across houses; instancing for trees/lamps if draw calls exceed a few hundred.
- `flat` (no ACES tonemapping) for the cartoon look; soft shadows; hemisphere + directional lights.
- House selection via `onClick`/`onPointerOver`/`onPointerOut`; `e.stopPropagation()` so ground clicks clear selection.
- Animation in `useFrame` with `delta` and refs; never `setState` in the loop.
- `startTransition` when selecting heavy blocks to keep the frame stable.

## Testing

- `bun test` — API tests: fixture DB (temp sqlite) verifies endpoint shape, empty-model parsing, stats aggregation, DB-missing error.
- Frontend: manual smoke check — render scene with fetched data; no unit test framework added (YAGNI).

## Scripts

- `bun run dev` — runs server + Vite concurrently.
- `bun run build` — `tsc` + Vite build.
- `bun test` — API tests.

## Out of Scope

- No deployment/hosting (local only).
- No auth/user accounts (account table is empty).
- No editing/mutations of the opencode DB.
- No real-time live-updates beyond manual page refresh.