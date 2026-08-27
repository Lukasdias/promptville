# Promptville — UI Tweaks Panel Design

Date: 2026-08-27
Status: Draft

## Overview

Add a tweak/settings panel to Promptville giving the user control over what information the HUD and world display. The panel toggles HUD panels, individual stats rows, a roof-color legend, and world dressing elements. Settings persist to `localStorage` so tweaks survive reloads.

Access: a gear button in the Header plus the `P` keyboard key. The panel matches the paper-card HUD identity.

## State (store)

Extend `app/src/store.ts` with a `tweaks` slice, persisted via zustand `persist` middleware.

```ts
interface Tweaks {
  showStats: boolean;      // StatsPanel visibility
  showHeader: boolean;     // Header + gear button
  showDetailCard: boolean; // DetailCard on selection
  showHintBar: boolean;    // HintBar
  showLegend: boolean;     // roof-color legend card
  statsRows: {
    cost: boolean;         // total cost row
    tokens: boolean;       // tokens in/out rows
    busiestDay: boolean;   // busiest day row
    models: boolean;       // top models list
    agents: boolean;       // top agents list
    projects: boolean;     // top projects list
  };
  showPeople: boolean;     // People
  showTraffic: boolean;    // Traffic, TrafficLights, Crossers
  showScenery: boolean;    // World (trees/lamps/clouds) + Details
  showMountains: boolean;  // Mountains
}
```

Defaults: everything `true` except `showLegend: false`.

Store additions: `tweaksOpen` + `toggleTweaks`, `setTweak(key, value)` (top-level), `setStatsRow(key, value)` (nested), `resetTweaks()`.

Persistence:
- `persist` with name `"promptville-tweaks"`.
- `partialize` → persist only `tweaks` (never selection/help state).
- `merge` → deep-merge saved `tweaks` over `DEFAULT_TWEAKS` so older saved values missing newer keys don't break the UI.

## Components

### TweakPanel (`app/src/components/hud/TweakPanel.tsx`)

Paper-card drawer on the left edge, vertically centered (`left-4 top-1/2 -translate-y-1/2`, `w-72`). Title "Tweak display". Grouped toggle rows with a cartoon pill switch. Groups:

- **Panels** — Stats, Header, Detail card, Hint bar, Roof legend
- **Stats rows** — Cost, Tokens, Busiest day, Top models, Top agents, Top projects
- **World** — People, Traffic, Scenery, Mountains
- **Reset** button (restores defaults, persists)

Switch: small pill button (amber when on, dim when off) with a sliding knob.

### Gear button (Header)

`Header.tsx`: add a `pointer-events-auto` cream circle button (⚙️) next to the logotype that calls `toggleTweaks`. The Header container keeps `pointer-events-none` except the button.

### LegendCard (`app/src/components/hud/LegendCard.tsx`)

Paper-card, bottom-right (`bottom-4 right-4`, `w-56`), `pointer-events-none`. Title "Roof colors". Rows = color chip (small rounded swatch with `MODEL_ROOF`/`UNKNOWN_ROOF` fill) + model name for each `MODEL_ROOF` entry, plus an "other" row for `UNKNOWN_ROOF`. Renders `null` when `showLegend` is off; spring fade-in.

### HUD row filtering

- `StatsPanel` — return `null` when `showStats` off. Always show the "Sessions" count. Rows gated by `statsRows`: cost row, tokens rows, busiest day row. Lists gated: top models, top agents (newly added — data already served by `/api/neighborhood`), top projects.
- `Header` — return `null` when `showHeader` off.
- `DetailCard` — return `null` when `showDetailCard` off.
- `HintBar` — return `null` when `showHintBar` off.

### World toggles

Each component reads its flag from the store and returns `null` when hidden:

- `People.tsx` → `showPeople`
- `Traffic.tsx`, `TrafficLights.tsx`, `Crossers.tsx` → `showTraffic`
- `World.tsx`, `Details.tsx` → `showScenery`
- `Mountains.tsx` → `showMountains`

No props threaded through `Scene`. `frameloop="always"` unchanged.

## Keyboard

`CivCamera.tsx` key handler additions:

- `P` → `toggleTweaks`.
- Esc priority chain becomes: close help if open → close tweaks if open → clear selection.

## Help panel copy

Add to the **General** group: "P — Tweak display" and "Gear — Tweak display".

## Edge Cases

- `showHeader` off → gear hidden; `P` still opens the panel (documented in help).
- Old persisted `tweaks` missing keys → `merge` fills defaults.
- Detail card hidden while a house is selected → selection persists; re-enabling shows the card.
- Reset button restores + persists defaults.

## Testing

No new pure math (UI state only). Verification:

- `bun run typecheck` (both workspaces)
- `bun test` (no regressions)
- `bun run build`
- Manual smoke: gear + P toggle panel; each toggle hides/shows its target; legend appears/disappears; tweaks survive reload; Esc closes help → tweaks → clears selection.

## Out of Scope

- No per-model color customization.
- No density sliders (tree/car counts) — only on/off.
- No rearrangement of HUD panels.