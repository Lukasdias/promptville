# Promptville Layered City — Design

Date: 2026-08-29
Status: Draft

## Summary

Extend the Promptville scene so the richer session data already present in the
opencode database is expressed in the city. The current scene maps projects → city
blocks and sessions → houses, sized by token count. This design adds an aggregate
"service ring" per block, enriches houses with two sub-details, and adds an
in-city signaling layer (floating markers, glows, labels) so the data announces
itself in the world. People become data-driven active-session citizens.

The DB is read-only. All changes are read-side aggregation and scene rendering —
there is no mutation of opencode-owned data.

## Existing Idiom (must be preserved)

- Projects = city blocks (`layout.ts`), sessions = houses.
- Everything is **voxel-based**: one `InstancedMesh` per object via
  `InstancedVoxels`, using blueprints in `app/src/voxel.ts`. `InstancedVoxels`
  now accepts a shared `material` prop (used for lamp/night glow).
- Geometry derives from a single source of truth: `app/src/city.ts`
  `useCity()`. New scene pieces read from it, never duplicate layout.
- House anatomy is centralized in `app/src/house.ts`: `houseParams`,
  `houseVoxelsFor`, `houseWindowCells`, `houseWindowGlows`. House **windows are
  separate glow quads** owned by `LitWindows.tsx`, not baked into the body mesh.
- **Day-night system**: `nightRef`/`clockRef` in `app/src/night.ts`, driven by
  `LightingRig`. Night glow for windows/lamps/signs rolls up via `nightRef *
  GLOW_MAX`. `frameloop="always"`.
- `frameloop="always"` on Canvas. Never `setState` in `useFrame` — mutate refs.
- All scene glass panels paper-card style, Fonts Fredoka + Nunito only.
- Server opens the opencode DB read-only (`readonly: true`), never mutates.

## Approach Selected

**A — per-block service ring.** Each project block gains a perimeter set of small
civic voxels (workshops, parks, landmark) sized/counted by that project's
aggregates. Ships with the block, stays deterministic, does not disturb the grid.

## 1. Data Model (server)

Extend `server/db.ts`. No new route is needed — extend `GET /api/neighborhood`
so the client keeps a single fetch.

### New per-project aggregates (added to `ProjectData`)

| Field | Type | Source |
|-------|------|--------|
| `toolCounts` | `Record<string, number>` | `part.data.type = "tool"` (name from tool payload), grouped by project |
| `todoCount` | `number` | `todo` table count for that project's sessions |
| `totalCost` | `number` | session cost, surfaced per block |
| `reasoningTokens` | `number` | `session.tokens_reasoning` |
| `topModels` | `{ model: string; count: number }[]` | reuse existing stats |

### New per-session sub-details (added to `SessionData`)

| Field | Type | Source |
|-------|------|--------|
| `messageCount` | `number` | count of `message` rows |
| `toolNames` | `string[]` | top 3 tool names for the session |
| `patchCount` | `number` | `part.data.type = "patch"` count |
| `diffAdditions` / `diffDeletions` | `number` | `session.summary_additions/deletions` |

### New global stats (extend `Stats`)

- `totalTodoCount: number`
- `activeSessions: number` — sessions with `timeUpdated` within `ACTIVE_WINDOW_MS`.

## 2. Scene Mapping (per block, voxel-based)

| Data | Scene element | Encoding |
|------|---------------|----------|
| Tool calls | **Workshops** | one small service building per top tool (bash/edit/write/read/grep; colors from existing `tool`-ish palette) along the block's inner edge; tool count drives how many appear |
| Todos | **Parks** | green voxel patch (trees + bench + fountain) per block with active todos; todo count → park size |
| Project cost | **Landmark tower** | one tower per block, height = cost (clamped), rises above the houses |
| Per-session messages | **House windows** | `messageCount` → window rows/columns in `house.ts` `houseWindowGlows` (so `LitWindows` picks them up for night glow) |
| Per-session patches | **Roof accent** | `patchCount`/`diffAdditions` → a colored roof stripe / extra chimney marking heavy-change sessions |

New voxel blueprint functions go in `app/src/voxel.ts` following the
`voxel-forms` skill (declarative primitives → `Voxel[]`), rendered via
`InstancedVoxels`. The **house window** change must flow through `house.ts`
(`houseParams`/`houseWindowGlows`) and `LitWindows.tsx` — not by adding windows
to the body mesh, which `LitWindows` now strips out.

## 3. In-City Signaling Layer (new)

| Signal | Element | Behavior |
|--------|---------|----------|
| **Block beacon** | Floating `Html` card above each block's landmark tower | Paper-card style (matches `DetailCard`, Nunito). Shows project name, session count, cost, top tools, todos. Reveal on hover/dwell; full when selected. |
| **Activity glow** | Additive glow mesh on the landmark (like `LitWindows`/lamps) | `useFrame`-driven, rolled up by `nightRef * GLOW_MAX`, so it comes alive at night. Color coded by top model (reuse `MODEL_ROOF` palette). Alpha-pulse via a shared ref — never `setState`. |
| **Heavy-change marker** | Over a house | Sessions with many patches or high diffs get a small animated chevron/`!` sign floating above the roof. |
| **Todo park sign** | Over the park | Small labeled sign (`TODOS`) + count. |

Reuse the drei `<Html>` + `Float` idiom from `House.tsx`, the additive-glow
shader pattern from `LitWindows.tsx`, paper-card styling from HUD, and the
`nightRef`/`GLOW_MAX` night integration. Add a shared `material`-based glow
component so beacons/signs glow at night without re-rendering.

## 4. People = Active-Session Citizens

Replace the current one-person-outside-every-house in `People.tsx` with
**data-driven citizens**:

- A person appears only for a house whose session is **active**
  (`timeUpdated` within `ACTIVE_WINDOW_MS`, ~48h) or the **currently selected**
  session. All other blocks are quiet.
- `People.tsx` currently reads only `useCity()` blocks; it must also read the
  session data (via `useNeighborhood()` / the `selected` session) to know each
  block's `timeUpdated`, and slice the map of `block.houses` accordingly.
- The citizen sits by the house door / nudges toward the plaza.
- Optional subtle motion: a short walk loop driven by `useFrame` on a ref (no
  `setState`), so a citizen feels alive rather than planted.

This turns people from static decoration into a "who is working now" signal.

## 5. Behavior & Boundaries

- All aggregate → scene mapping stays **pure and deterministic**. Pass raw
  aggregates into the existing pure `layoutCity`/`houseScale` pattern; add pure
  helper functions for workshop placement, park size, landmark height,
  window/diff encoding, and citizen filtering.
- Interaction unchanged: click a house → `DetailCard`; click a workshop,
  landmark, or park → select that project's block.
- `block beacon` / `park sign` / `heavy-change marker` are informational
  (pointer-events:none where appropriate) — they do not steal clicks from the
  underlying house.
- People and signaling must respect the existing `tweaks` toggles. Add a new
  `showSignals` boolean. Because `store.ts` uses `zustand persist` with a
  `merge`/`partialize`, `showSignals` must be added to all three places: the
  `Tweaks` interface, `DEFAULT_TWEAKS`, and the `merge` spread so persisted
  state can't wipe the default.

## 6. Testing

- Pure-logic tests for the new mapping, following `app/src/layout.test.ts`
  patterns:
  - workshop placement (deterministic, no overlap, respects block bounds)
  - park size from todo count
  - landmark height clamp from cost
  - window / roof-accent encoding from messageCount / patchCount
  - active-session citizen filtering (`ACTIVE_WINDOW_MS` boundary)
- `bun run typecheck` and `bun test` after changes.

## 7. Out of Scope (this pass)

- No DB mutation, no write-back to opencode.
- No write/save of layout state (city is derived every render).
- No per-message playback / step timeline animation (future work).
- No user-configurable mapping of data → scene element (future work).
