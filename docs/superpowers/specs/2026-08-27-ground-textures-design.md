# Promptville — Ground Texture Design

Date: 2026-08-27
Status: Draft

## Overview

Add subtle procedural textures to the town's ground surfaces — streets, crosswalks, and grass — to give the scene depth while keeping the flat pastel, low-poly toy-town identity. All textures are generated deterministically at runtime via canvas (no image assets), using the same mechanism the sidewalk brick already uses (`CanvasTexture`).

Visual direction: **visible but tasteful** — mottled two-tone grass, asphalt with grain + faint wear lanes, lawn-striped park, stone plaza, brick-tone crosswalks. Markings stay crisp geometry.

## Texture System (`app/src/textures.ts`)

New browser-only module (needs DOM canvas; not unit-tested under `bun test`).

- `makeTileableTexture(size, paint): CanvasTexture` — creates a `size × size` canvas, runs `paint(ctx)` (a seeded callback), sets `wrapS`/`wrapT` to `RepeatWrapping`.
- All painters use seeded `mulberry32` from `app/src/rand.ts` → deterministic grain (consistent with the deterministic layout).
- **6 shared singletons** (1 texture + 1 `MeshStandardMaterial` each), fixed `texture.repeat` (uniform scale across all rects — no per-street materials):

| Export | Surface | Base | Pattern |
|---|---|---|---|
| `grassTexture` / `grassMaterial` | field | `#9bd46a` | soft two-tone mottling (pastel blobs) |
| `grassLotTexture` / `grassLotMaterial` | block lots | `#8fbf5c` | mottling + faint 45° mow stripes |
| `parkTexture` / `parkMaterial` | park pad | `#86c255` | alternating lawn stripes |
| `asphaltTexture` / `asphaltMaterial` | streets | `#3c3a42` | fine speckle grain + 2 faint darker wear lanes |
| `plazaTexture` / `plazaMaterial` | plaza pad | cream `#f7efe0` | warm stone tiles with soft grout grid |
| `sidewalkTexture` / `sidewalkMaterial` | sidewalks | brick | existing brick pattern, consolidated |

Color constants live in `app/src/theme.ts` (e.g. `GRASS_DARK`, `GRASS_LIGHT`, `ASPHALT_GRAIN`, `WEAR_LANE`, `STONE_LINE`, `STONE_BASE`, `MOW_STRIPE`, `LAWN_A`, `LAWN_B`).

Shared singletons replace:
- `Ground.tsx` per-street flat asphalt materials (one per street mesh) → shared `asphaltMaterial`. Centerline dashes keep their own flat `COLORS.roadLine` materials — unchanged.
- `Sidewalks.tsx` per-sidewalk `CanvasTexture` + `MeshStandardMaterial` creation (the known duplication) → one shared `sidewalkMaterial`.

## Ground component changes

### `Ground.tsx`

- Grass field plane → `grassMaterial` (repeat covers the plane: `repeat = extent*2 / TILE`).
- Each street mesh → `asphaltMaterial` (uniform repeat).
- Grass lot per block → `grassLotMaterial`.
- Park circle → `parkMaterial`.
- Plaza pad → `plazaMaterial` (stone). Water circle + plaza outline unchanged.
- Centerline dashes unchanged (flat `COLORS.roadLine` meshes).

### `Sidewalks.tsx`

- Sidewalk strips → shared `sidewalkMaterial` (one brick texture + material; per-rect UV handled by the existing per-rect repeat? No — shared material means a single repeat. Sidewalk width is constant, so a fixed repeat looks uniform and correct). Remove per-strip `makeBrickTexture`/material allocation; keep the single shared brick texture.
- **Crosswalks restyled** to brick-tone zebra: each stripe is a main stripe (`COLORS.crosswalk`-light brick) plus a thin darker edge strip offset on one side ("paper shadow", matching the paper-card HUD). Keep ~4 stripes crossing the avenue.
- **Both directions**: at each intersection, render crossings over the avenue (stripes perpendicular to the avenue, as today) **and** over the side street (stripes along the avenue axis) when a vertical street exists at the intersection — completes the crossing.

## Determinism & performance

- Texture painters deterministic (seeded PRNG); same data → identical scene.
- GPU footprint: ~6 shared textures/materials replace dozens of per-street and per-sidewalk materials.
- Geometry/draw calls for streets, lots, dashes unchanged (markings stay meshes).

## Files

- Create: `app/src/textures.ts`
- Modify: `app/src/components/three/Ground.tsx`
- Modify: `app/src/components/three/Sidewalks.tsx`
- Modify: `app/src/theme.ts` (texture color constants)
- Untouched: layout/voxel/traffic/roadgraph; all 3D building, people, car, tree rendering.

## Testing

No new unit tests (painters are DOM-bound). Verification:

- `bun run typecheck` (both workspaces)
- `bun test` (no regressions — 96 existing tests stay green)
- `bun run build`
- Manual smoke (dev server): grass shows mottling, lots show mow stripes, park shows lawn stripes, streets show grain, plaza shows stone, crosswalks are brick-tone with edge shadow in both directions, sidewalk brick unchanged visually.

## Out of Scope

- No bump/normal mapping, no photoreal textures.
- No per-street texture alignment (markings stay separate geometry).
- No texture changes to mountains, buildings, voxels, or HUD.