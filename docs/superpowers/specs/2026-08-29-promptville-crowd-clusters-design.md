# Crowd Clusters with NPC Chatter — Design

**Date:** 2026-08-29
**Status:** approved

## Problem

The town reads empty: a handful of active citizens, crossers, and sidewalk
pedestrians, each occupying its own draw call. We want a visibly larger crowd that
stands together in groups, where some groups carry a short NPC conversation
bubble — without collapsing the frame rate.

## Constraints

- **Perf:** every person that is its own `<Group>`/`InstancedVoxels` is a draw
  call. A "massive" crowd therefore cannot be one-mesh-per-person. People with a
  shared shirt colour must be **batched into a single `InstancedVoxels`**.
- **Determinism:** the town is reproducible. No `Math.random()` in layout — seed
  with `mulberry32` from `app/src/rand.ts`.
- **Never in roads:** people must not stand on street/sidewalk/intersection
  geometry they would clip with.
- **Existing layers stay:** this adds a crowd layer; it does not replace
  `People`, `Crossers`, or the `Traffic` foot/visitor movers.

## Architecture

Two new pieces, mirroring the existing `layout.ts`/`sidewalk.ts` + component
split.

### 1. `app/src/crowd.ts` — pure, deterministic layout

```
crowdLayout(blocks, streets, counts, seed?) → CrowdLayout

interface CrowdCluster {
  anchor: { x: number; z: number };   // the group's center point
  heading: number;                    // facing axis (bubble faces outward)
  members: { x: number; z: number; shirt: string }[];
  talking: boolean;                   // whether this cluster shows a bubble
}

interface CrowdLayout {
  clusters: CrowdCluster[];
}
```

- **Anchors:** a handful of gather spots chosen from real geometry — the plaza
  block edges, the park circle, and a couple of main-avenue corners. Each anchor
  is validated with the same clear-spot logic used elsewhere so it never lands in
  a road or block lot.
- **Members:** `3–6` per cluster, fanned in a small circle around the anchor with
  per-member jitter, each facing roughly inward (toward the anchor). Shirt colours
  drawn from the `PROJECT_PALETTE` palette.
- **Talking:** a deterministic subset (≈ a quarter of clusters, capped at a few)
  is flagged `talking`; the rest just stand and bob.
- **Pure + seeded:** identical inputs produce identical output — tested.

### 2. `app/src/components/three/Crowd.tsx` — renderer + bubbles

- Group members by shirt colour → **one `InstancedVoxels` per colour**, so the
  whole crowd is ~2–3 draw calls regardless of cluster count.
- Each cluster gets a subtle idle bob (reuse the `smooth`/scale idiom) so the
  group feels alive without per-person pathing.
- For `talking` clusters, render a `drei` `<Html>` speech bubble above the anchor
  (same styling as `SelectedBanner`/`BuildingSign`): 1–2 short lines from a small
  template pool, rotating on a timer, then auto-hiding for a few seconds. At most
  **2–3 concurrent bubbles** (a low cap), so DOM cost stays flat.
- Mounted in `Scene.tsx` next to `<People />`.

## Data flow

```
useCity() (blocks, streets, civic) ──▶ crowdLayout(blocks, streets, counts, seed)
                                          │
                                          ▼
                                  CrowdLayout (pure)
                                          │ colours grouped → InstancedVoxels
                                          ▼
                                    Crowd.tsx renders
                                    + Html bubbles for talking clusters
```

## Perf guardrails

- **Batching by colour** → ~2–3 draw calls for the whole crowd.
- **Bubble cap** → ≤ 3 concurrent `<Html>` nodes (DOM is the expensive part).
- **Counts in config** (`config.ts` `crowd` block) → low hundreds of voxels,
  capped, tunable.
- **Deterministic** — no `Math.random()`.

## Error handling / edge cases

- Empty city (`blocks.length === 0`) → empty crowd, no crash.
- A cluster whose anchor fails the clear-spot check is skipped; if it has too few
  members it is dropped.
- Bubble timer is cheap (a `useFrame` accumulator or interval); no per-frame
  state churn beyond the bob scale.

## Testing

- `app/src/crowd.test.ts`:
  - `crowdLayout` is deterministic (same input → deep-equal output).
  - cluster count respects the requested count (and caps).
  - every member stays within the cluster radius of its anchor.
  - no member sits inside a street/sidewalk/intersection (same clear check).
  - plaza/empty edge cases return no overlapping-in-road members.

## Out of scope (YAGNI)

- No per-NPC pathfinding or AI. People stand and talk.
- No audio.
- Bubble text is a small template pool, purely visual; no CMS/content source.
- Does not replace the existing `People`/`Crossers`/`Traffic` movers.

## File map

- `app/src/crowd.ts` (new) — pure layout.
- `app/src/components/three/Crowd.tsx` (new) — renderer + bubbles.
- `app/src/config.ts` — add a `crowd` counts block.
- `app/src/components/three/Scene.tsx` — mount `<Crowd />`.
- `app/src/crowd.test.ts` (new) — unit tests.
