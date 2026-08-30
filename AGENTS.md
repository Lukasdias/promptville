# Agent Instructions

## Commands

- `bun run dev` - Start API server (:4100) + Vite (:5173) via concurrently
- `bun run build` - Typecheck + production build of the `app` workspace
- `bun run typecheck` - Typecheck both workspaces (server + app)
- `bun test` - Run tests (server db/parts/API + app logic)

## Architecture

Monorepo with two Bun workspaces:

- `server/` - `Bun.serve` API, reads the opencode DB **read-only** via `bun:sqlite` + Drizzle ORM (`drizzle-orm/bun-sqlite`). Endpoints: `GET /api/neighborhood`, `GET /api/session/:id`, `GET /api/session/:id/messages`. DB path is `~/.local/share/opencode/opencode.db` (falls back to `~/.opencode/opencode.db`), overridable with `OPENCODE_DB_PATH`.
- `app/` - Vite + React 19 + React Three Fiber (R3F) 9 + drei 10 + three 0.185. Async data via TanStack Query v5 (`app/src/query.ts`); Zustand (`app/src/store.ts`) only for UI selection/tweaks state, persisted.

Key files:

- `server/schema.ts` - Drizzle table definitions mirroring the opencode DB (project, session, todo, message, part) — read-only model, opencode owns the schema.
- `server/db.ts` - Drizzle queries + stats aggregation, session detail/messages, and `crowdChatter` (real chat lines for NPC bubbles). `openDb` returns a `bun:sqlite` `Database`; `queryNeighborhood` wraps it via `createDb`.
- `server/parts.ts` - part-data helpers: `countByTool`, `countPartType`, `topToolNames`.
- `app/src/layout.ts` - deterministic city layout + street graph (pure, tested). Companions: `roadgraph.ts`, `layered.ts`, `sidewalk.ts`, `ground.ts`, `crosswalk.ts`, `civic.ts`.
- `app/src/voxel.ts` - voxel blueprints + `InstancedVoxels` helper for scene props.
- `app/src/components/three/` - scene components (Scene, City, Block, House, Ground, Terrain, Streets, Sidewalks, World, Mountains, Sky, CloudField, Rain, DustMotes, GroundFog, LightingRig, LitWindows, HouseNightLights, Traffic, TrafficLights, Crossers, People, Crowd, CivicDistrict, ServiceRing, Signals, MusicPlayer, SelectedBanner, CivCamera).
- `app/src/components/hud/` - HUD overlay (Header, Clock, StatsPanel, DetailCard, HintBar, HelpPanel, TweakPanel, SoundInfo, LegendCard, Splash, Toasts, MissingState, ChatSidebar).
- `app/src/components/navigator/` - session search/filter/sort panel (NavigatorPanel, SessionRow, FilterCombobox).
- `app/src/store.ts` - Zustand UI state (selection, tweaks, navigator filters, time-of-day, audio, toasts).
- `app/src/config.ts` - tuning knobs: `environment`, `traffic`, `crowd` counts.
- `app/src/theme.ts` - palette, model→roof map, building colors, day/night atmosphere constants.

## Code Style

- Never use `any`. Avoid `as` unless necessary.
- Follow existing patterns; check neighboring files before editing.
- R3F rules (see `docs/r3f-reference.md`):
  - Hooks (`useThree`, `useFrame`, `useLoader`) only inside `<Canvas>`.
  - Never `setState` in `useFrame` - mutate refs directly, use `delta`.
  - Share geometries/materials via module-level constants (`House.tsx`).
- `frameloop="always"` on Canvas (the town has continuous animation: day/night cycle, traffic, clouds, hover, crowd). Do not switch to `demand` — the animations would freeze.
- Ground planes must be rotated `rotation-x={-Math.PI/2}` (they default to +Z-facing).
- All scene props are **voxel-based** (`app/src/voxel.ts` blueprints + `InstancedVoxels`): one `InstancedMesh` of unit cubes per object, per-instance color for tinting. Never hand-build houses/trees/mountains from many `<mesh>` elements — that was ~2300 draw calls.
- Server reads the opencode DB **read-only** - never mutate it.
- All UI copy in English, title "Promptville". Fonts Fredoka + Nunito only (via `@fontsource`).
- New pure logic should live in a `.ts` module with its own `*.test.ts` (see `layout.ts` pattern). Scene components should stay thin and read state from `store.ts` / pure modules.

## Workflow

1. Read the relevant design spec(s) in `docs/superpowers/specs/` for the feature you're touching.
2. Check the matching implementation plan in `docs/superpowers/plans/`.
3. Add tests for new pure logic (`.test.ts` alongside the module).
4. Run `bun run typecheck` and `bun test` after changes.
5. Never commit unless the user explicitly asks.
