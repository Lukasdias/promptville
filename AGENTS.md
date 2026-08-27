# Agent Instructions

## Commands

- `bun run dev` - Start API server (:4100) + Vite (:5173)
- `bun run build` - Typecheck + production build
- `bun run typecheck` - Typecheck both workspaces (server + app)
- `bun test` - Run tests (server db/api + app layout)

## Architecture

Monorepo with two Bun workspaces:
- `server/` - Bun.serve API, reads `~/.local/share/opencode/opencode.db` **read-only** via `bun:sqlite` + Drizzle ORM (`drizzle-orm/bun-sqlite`). Endpoint: `GET /api/neighborhood`.
- `app/` - Vite + React 19 + React Three Fiber (R3F) 9 + drei 10 + three. Async data via TanStack Query v5 (`app/src/query.ts`); Zustand only for UI selection state.

Key files:
- `server/schema.ts` - Drizzle table definitions mirroring the opencode DB (session, project) — read-only model, opencode owns the schema.
- `server/db.ts` - Drizzle queries + stats aggregation. `openDb` returns a `bun:sqlite` `Database`; `queryNeighborhood` wraps it via `createDb`.
- `app/src/layout.ts` - city layout + street graph (pure, tested).
- `app/src/components/three/` - scene components (Scene, City, Block, House, Ground, World, Mountains, SelectedBanner).
- `app/src/components/hud/` - HUD overlay (Header, StatsPanel, DetailCard, HintBar, MissingState).

## Code Style

- Never use `any`. Avoid `as` unless necessary.
- Follow existing patterns; check neighboring files before editing.
- R3F rules (see `docs/r3f-reference.md`):
  - Hooks (`useThree`, `useFrame`, `useLoader`) only inside `<Canvas>`.
  - Never `setState` in `useFrame` - mutate refs directly, use `delta`.
  - Share geometries/materials via module-level constants (`House.tsx`).
  - `frameloop="always"` on Canvas (the town has continuous animation: drifting clouds, hover, bob). Do not switch to `demand` — clouds would freeze.
  - Ground planes must be rotated `rotation-x={-Math.PI/2}` (they default to +Z-facing).
- Server reads the opencode DB **read-only** - never mutate it.
- All UI copy in English, title "Promptville". Fonts Fredoka + Nunito only.

## Workflow

1. Read the design spec: `docs/superpowers/specs/2026-08-27-opencode-city-3d-design.md`
2. Check the implementation plan: `docs/superpowers/plans/2026-08-27-promptville.md`
3. Add tests for new pure logic (`layout.ts` patterns).
4. Run `bun run typecheck` and `bun test` after changes.
5. Never commit unless the user explicitly asks.