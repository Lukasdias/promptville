# UI Tweaks Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tweak/settings panel to Promptville that toggles HUD panels, individual stats rows, a roof-color legend, and world dressing. Settings persist to `localStorage`.

**Architecture:** A `tweaks` slice in the existing zustand store, persisted via `persist` middleware. One `TweakPanel` overlay writes to it; every HUD/world component reads its flag and renders `null` when hidden. Access via a gear button in the Header and the `P` key.

**Tech Stack:** Bun, React 19, R3F 9, drei 10, zustand (persist middleware), react-spring, Tailwind 4.

## Global Constraints

- Never use `any`. Avoid `as` unless necessary (the persist `merge` cast is necessary — `persisted` arrives as `unknown`).
- No `setState` inside `useFrame` — mutate refs directly.
- Hooks (`useApp`, `useThree`, `useMemo`) must run unconditionally — early `return null` only AFTER all hooks.
- All UI copy in English; title "Promptville"; fonts Fredoka (display) + Nunito (body) only.
- Do NOT `git commit` — the user's AGENTS.md forbids committing unless explicitly asked. Verify with tests instead.
- Run `bun run typecheck`, `bun test`, and `bun run build` after completing all tasks.

---

### Task 1: Persisted tweaks slice in the store

**Files:**
- Modify: `app/src/store.ts`

**Interfaces:**
- Produces (consumed by Tasks 2–5):
  - `export interface StatsRows { cost; tokens; busiestDay; models; agents; projects: boolean }`
  - `export interface Tweaks { showStats; showHeader; showDetailCard; showHintBar; showLegend; statsRows: StatsRows; showPeople; showTraffic; showScenery; showMountains: boolean }`
  - `export const DEFAULT_TWEAKS: Tweaks`
  - `useApp` gains: `tweaksOpen`, `toggleTweaks`, `tweaks: Tweaks`, `setTweak(key, value)`, `setStatsRow(key, value)`, `resetTweaks`.
- Consumes: existing `create` from zustand, new `persist` from `zustand/middleware`.

- [ ] **Step 1: Replace `app/src/store.ts`**

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionData } from "./types";

export interface StatsRows {
  cost: boolean;
  tokens: boolean;
  busiestDay: boolean;
  models: boolean;
  agents: boolean;
  projects: boolean;
}

export interface Tweaks {
  showStats: boolean;
  showHeader: boolean;
  showDetailCard: boolean;
  showHintBar: boolean;
  showLegend: boolean;
  statsRows: StatsRows;
  showPeople: boolean;
  showTraffic: boolean;
  showScenery: boolean;
  showMountains: boolean;
}

export const DEFAULT_TWEAKS: Tweaks = {
  showStats: true,
  showHeader: true,
  showDetailCard: true,
  showHintBar: true,
  showLegend: false,
  statsRows: {
    cost: true,
    tokens: true,
    busiestDay: true,
    models: true,
    agents: true,
    projects: true,
  },
  showPeople: true,
  showTraffic: true,
  showScenery: true,
  showMountains: true,
};

interface AppState {
  selected: SessionData | null;
  select: (session: SessionData | null) => void;
  clearSelection: () => void;
  helpOpen: boolean;
  toggleHelp: () => void;
  tweaksOpen: boolean;
  toggleTweaks: () => void;
  tweaks: Tweaks;
  setTweak: <K extends Exclude<keyof Tweaks, "statsRows">>(key: K, value: Tweaks[K]) => void;
  setStatsRow: (key: keyof StatsRows, value: boolean) => void;
  resetTweaks: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      selected: null,
      select: (session) => set({ selected: session }),
      clearSelection: () => set({ selected: null }),
      helpOpen: false,
      toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
      tweaksOpen: false,
      toggleTweaks: () => set((s) => ({ tweaksOpen: !s.tweaksOpen })),
      tweaks: DEFAULT_TWEAKS,
      setTweak: (key, value) => set((s) => ({ tweaks: { ...s.tweaks, [key]: value } })),
      setStatsRow: (key, value) =>
        set((s) => ({ tweaks: { ...s.tweaks, statsRows: { ...s.tweaks.statsRows, [key]: value } } })),
      resetTweaks: () => set({ tweaks: DEFAULT_TWEAKS }),
    }),
    {
      name: "promptville-tweaks",
      partialize: (s) => ({ tweaks: s.tweaks }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppState>),
        tweaks: {
          ...DEFAULT_TWEAKS,
          ...((persisted as Partial<AppState> | undefined)?.tweaks ?? {}),
          statsRows: {
            ...DEFAULT_TWEAKS.statsRows,
            ...((persisted as Partial<AppState> | undefined)?.tweaks?.statsRows ?? {}),
          },
        },
      }),
    },
  ),
);
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run --cwd app typecheck`
Expected: no errors.

---

### Task 2: TweakPanel component + gear button + mount

**Files:**
- Create: `app/src/components/hud/TweakPanel.tsx`
- Modify: `app/src/components/hud/Header.tsx`
- Modify: `app/src/App.tsx`

**Interfaces:**
- Consumes: `useApp` fields from Task 1 (`tweaksOpen`, `tweaks`, `setTweak`, `setStatsRow`, `resetTweaks`, `toggleTweaks`).
- Produces: `TweakPanel` component (mounted in App), gear button in Header.

- [ ] **Step 1: Create `app/src/components/hud/TweakPanel.tsx`**

```tsx
import type { ReactNode } from "react";
import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 text-sm"
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border-2 border-ink/60 transition-colors ${
          value ? "bg-amber-300" : "bg-ink/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-ink transition-all ${
            value ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold opacity-70">{title}</h3>
      <div className="mt-1 space-y-1.5">{children}</div>
    </div>
  );
}

export function TweakPanel() {
  const open = useApp((s) => s.tweaksOpen);
  const t = useApp((s) => s.tweaks);
  const setTweak = useApp((s) => s.setTweak);
  const setStatsRow = useApp((s) => s.setStatsRow);
  const resetTweaks = useApp((s) => s.resetTweaks);

  const { opacity, x } = useSpring({
    from: { opacity: 0, x: -16 },
    opacity: open ? 1 : 0,
    x: open ? 0 : -16,
    config: { tension: 220, friction: 24 },
  });
  if (!open) return null;

  return (
    <animated.div
      className="absolute left-4 top-1/2 w-72 -translate-y-1/2"
      style={{ opacity, transform: x.to((v) => `translateX(${v}px)`) }}
    >
      <div className="paper-card p-4 font-body text-ink">
        <h2 className="font-display text-lg font-semibold">Tweak display</h2>
        <div className="mt-3 space-y-3">
          <Group title="Panels">
            <Toggle label="City stats" value={t.showStats} onChange={(v) => setTweak("showStats", v)} />
            <Toggle label="Header" value={t.showHeader} onChange={(v) => setTweak("showHeader", v)} />
            <Toggle label="Detail card" value={t.showDetailCard} onChange={(v) => setTweak("showDetailCard", v)} />
            <Toggle label="Hint bar" value={t.showHintBar} onChange={(v) => setTweak("showHintBar", v)} />
            <Toggle label="Roof legend" value={t.showLegend} onChange={(v) => setTweak("showLegend", v)} />
          </Group>
          <Group title="Stats rows">
            <Toggle label="Cost" value={t.statsRows.cost} onChange={(v) => setStatsRow("cost", v)} />
            <Toggle label="Tokens" value={t.statsRows.tokens} onChange={(v) => setStatsRow("tokens", v)} />
            <Toggle label="Busiest day" value={t.statsRows.busiestDay} onChange={(v) => setStatsRow("busiestDay", v)} />
            <Toggle label="Top models" value={t.statsRows.models} onChange={(v) => setStatsRow("models", v)} />
            <Toggle label="Top agents" value={t.statsRows.agents} onChange={(v) => setStatsRow("agents", v)} />
            <Toggle label="Top projects" value={t.statsRows.projects} onChange={(v) => setStatsRow("projects", v)} />
          </Group>
          <Group title="World">
            <Toggle label="People" value={t.showPeople} onChange={(v) => setTweak("showPeople", v)} />
            <Toggle label="Traffic" value={t.showTraffic} onChange={(v) => setTweak("showTraffic", v)} />
            <Toggle label="Scenery" value={t.showScenery} onChange={(v) => setTweak("showScenery", v)} />
            <Toggle label="Mountains" value={t.showMountains} onChange={(v) => setTweak("showMountains", v)} />
          </Group>
          <button
            type="button"
            onClick={resetTweaks}
            className="w-full rounded-lg border-2 border-ink/60 py-1.5 text-sm font-bold hover:bg-ink/10"
          >
            Reset defaults
          </button>
        </div>
      </div>
    </animated.div>
  );
}
```

- [ ] **Step 2: Add the gear button to `app/src/components/hud/Header.tsx`**

Replace the whole file:

```tsx
import { animated, useSpring } from "@react-spring/web";
import { useApp } from "../../store";

export function Header() {
  const toggleTweaks = useApp((s) => s.toggleTweaks);
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: -18 },
    to: { opacity: 1, y: 0 },
    config: { tension: 220, friction: 24 },
  });

  return (
    <animated.header
      className="pointer-events-none absolute left-4 top-4 flex items-center gap-2"
      style={{ opacity, transform: y.to((v) => `translateY(${v}px)`) }}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-amber-300 text-xl">
        ☀️
      </span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink drop-shadow-[2px_2px_0_rgba(255,255,255,0.8)]">
        Promptville
      </h1>
      <button
        type="button"
        onClick={toggleTweaks}
        aria-label="Tweak display"
        className="pointer-events-auto ml-1 grid h-10 w-10 place-items-center rounded-full border-[3px] border-ink bg-cream text-lg transition-colors hover:bg-ink/10"
      >
        ⚙️
      </button>
    </animated.header>
  );
}
```

- [ ] **Step 3: Mount TweakPanel in `app/src/App.tsx`**

Add import:

```tsx
import { TweakPanel } from "./components/hud/TweakPanel";
```

and after `<HelpPanel />`:

```tsx
      <HelpPanel />
      <TweakPanel />
```

- [ ] **Step 4: Verify typecheck**

Run: `bun run --cwd app typecheck`
Expected: no errors.

---

### Task 3: HUD row filtering, top agents, and the legend card

**Files:**
- Modify: `app/src/components/hud/StatsPanel.tsx`
- Modify: `app/src/components/hud/Header.tsx`
- Modify: `app/src/components/hud/DetailCard.tsx`
- Modify: `app/src/components/hud/HintBar.tsx`
- Create: `app/src/components/hud/LegendCard.tsx`
- Modify: `app/src/App.tsx` (mount LegendCard)

**Interfaces:**
- Consumes: `useApp` tweaks fields from Task 1; `MODEL_ROOF`, `UNKNOWN_ROOF` from `../../theme`.
- Produces: `LegendCard` component.

- [ ] **Step 1: Rewrite `app/src/components/hud/StatsPanel.tsx`**

```tsx
import { animated, useSpring } from "@react-spring/web";
import { useNeighborhood } from "../../query";
import { useApp } from "../../store";

function fmtCost(c: number): string {
  return `$${c.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function StatsPanel() {
  const { data } = useNeighborhood();
  const show = useApp((s) => s.tweaks.showStats);
  const rows = useApp((s) => s.tweaks.statsRows);
  const spring = useSpring({
    opacity: data && show ? 1 : 0,
    transform: data && show ? "translateX(0px)" : "translateX(44px)",
    config: { tension: 220, friction: 26 },
  });
  if (!data || !show) return null;
  const { stats } = data;

  return (
    <animated.aside
      className="paper-card absolute right-4 top-4 w-64 p-4 font-body text-ink"
      style={{ opacity: spring.opacity, transform: spring.transform }}
    >
      <h2 className="font-display text-lg font-semibold">City Stats</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <Row k="Sessions" v={String(stats.totalSessions)} />
        {rows.cost && <Row k="Total cost" v={fmtCost(stats.totalCost)} />}
        {rows.tokens && (
          <>
            <Row k="Tokens in" v={fmtTokens(stats.totalTokensIn)} />
            <Row k="Tokens out" v={fmtTokens(stats.totalTokensOut)} />
          </>
        )}
        {rows.busiestDay && <Row k="Busiest day" v={stats.busiestDay ?? "—"} />}
      </dl>
      {rows.models && (
        <>
          <h3 className="mt-3 font-display text-base font-semibold">Top models</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            {stats.topModels.slice(0, 4).map((m) => (
              <li key={m.model} className="flex justify-between gap-2">
                <span className="truncate">{m.model}</span>
                <span className="shrink-0 font-bold">{m.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {rows.agents && (
        <>
          <h3 className="mt-3 font-display text-base font-semibold">Top agents</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            {stats.topAgents.slice(0, 4).map((a) => (
              <li key={a.model} className="flex justify-between gap-2">
                <span className="truncate">{a.model}</span>
                <span className="shrink-0 font-bold">{a.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {rows.projects && (
        <>
          <h3 className="mt-3 font-display text-base font-semibold">Top projects</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            {stats.topProjects.slice(0, 4).map((p) => (
              <li key={p.name} className="flex justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 font-bold">{p.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </animated.aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="opacity-70">{k}</dt>
      <dd className="font-bold">{v}</dd>
    </div>
  );
}
```

Note: `stats.topAgents` items use the key `model` (per `app/src/types.ts`), so iterate with `a.model`/`a.count`.

- [ ] **Step 2: Gate Header on `showHeader`**

In `app/src/components/hud/Header.tsx`, after the `useSpring` call add:

```tsx
  const showHeader = useApp((s) => s.tweaks.showHeader);
```

and change the early hook order so all hooks run first, then:

```tsx
  if (!showHeader) return null;
```

placed right before the `return` statement (the `useApp` selector and `useSpring` both run above it).

- [ ] **Step 3: Gate DetailCard on `showDetailCard`**

In `app/src/components/hud/DetailCard.tsx` add:

```tsx
  const showDetailCard = useApp((s) => s.tweaks.showDetailCard);
```

and change the guard to:

```tsx
  if (!selected || !showDetailCard) return null;
```

- [ ] **Step 4: Gate HintBar on `showHintBar`**

In `app/src/components/hud/HintBar.tsx`, add:

```tsx
import { useApp } from "../../store";
```

inside the component, after the `useSpring` call:

```tsx
  const showHintBar = useApp((s) => s.tweaks.showHintBar);
```

and before the `return`:

```tsx
  if (!showHintBar) return null;
```

- [ ] **Step 5: Create `app/src/components/hud/LegendCard.tsx`**

```tsx
import { animated, useSpring } from "@react-spring/web";
import { MODEL_ROOF, UNKNOWN_ROOF } from "../../theme";
import { useApp } from "../../store";

export function LegendCard() {
  const show = useApp((s) => s.tweaks.showLegend);
  const { opacity, y } = useSpring({
    from: { opacity: 0, y: 10 },
    opacity: show ? 1 : 0,
    y: show ? 0 : 10,
    config: { tension: 220, friction: 24 },
  });
  if (!show) return null;

  return (
    <animated.div
      className="pointer-events-none absolute bottom-4 right-4 w-56"
      style={{ opacity, transform: y.to((v) => `translateY(${v}px)`) }}
    >
      <div className="paper-card p-3 font-body text-ink">
        <h3 className="font-display text-sm font-semibold">Roof colors</h3>
        <ul className="mt-1 space-y-1 text-xs">
          {Object.entries(MODEL_ROOF).map(([model, color]) => (
            <li key={model} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full border border-ink/30" style={{ background: color }} />
              <span className="truncate">{model}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full border border-ink/30" style={{ background: UNKNOWN_ROOF }} />
            <span>other</span>
          </li>
        </ul>
      </div>
    </animated.div>
  );
}
```

- [ ] **Step 6: Mount LegendCard in `app/src/App.tsx`**

Add import:

```tsx
import { LegendCard } from "./components/hud/LegendCard";
```

and after `<TweakPanel />`:

```tsx
      <TweakPanel />
      <LegendCard />
```

- [ ] **Step 7: Verify typecheck**

Run: `bun run --cwd app typecheck`
Expected: no errors.

---

### Task 4: World dressing toggles

**Files:**
- Modify: `app/src/components/three/People.tsx`
- Modify: `app/src/components/three/Traffic.tsx`
- Modify: `app/src/components/three/Crossers.tsx`
- Modify: `app/src/components/three/World.tsx`
- Modify: `app/src/components/three/Details.tsx`
- Modify: `app/src/components/three/Mountains.tsx`

**Interfaces:**
- Consumes: `useApp` tweaks flags from Task 1. `TrafficLights` is rendered inside `Traffic`, so gating `Traffic` covers it — no separate edit needed.

- [ ] **Step 1: Gate People on `showPeople`**

In `app/src/components/three/People.tsx`, add `import { useApp } from "../../store";` and inside the component after the `useNeighborhood`/`layoutCity`/`useMemo` hooks:

```tsx
  const showPeople = useApp((s) => s.tweaks.showPeople);
```

then change the return guard to:

```tsx
  if (voxels.length === 0 || !showPeople) return null;
```

- [ ] **Step 2: Gate Traffic on `showTraffic`**

In `app/src/components/three/Traffic.tsx`, add `import { useApp } from "../../store";` and inside `export function Traffic(...)`, after `const specs = useTrafficSpecs(streets);`:

```tsx
  const showTraffic = useApp((s) => s.tweaks.showTraffic);
  if (!showTraffic) return null;
```

- [ ] **Step 3: Gate Crossers on `showTraffic`**

In `app/src/components/three/Crossers.tsx`, add `import { useApp } from "../../store";` and inside `export function Crossers(...)`, after `const specs = useCrosserSpecs(intersections, streets);`:

```tsx
  const showTraffic = useApp((s) => s.tweaks.showTraffic);
  if (!showTraffic) return null;
```

- [ ] **Step 4: Gate World on `showScenery`**

In `app/src/components/three/World.tsx`, add `import { useApp } from "../../store";` and inside the component after the `lamps` `useMemo` (all hooks):

```tsx
  const showScenery = useApp((s) => s.tweaks.showScenery);
  if (!showScenery) return null;
```

- [ ] **Step 5: Gate Details on `showScenery`**

In `app/src/components/three/Details.tsx`, add `import { useApp } from "../../store";` and inside the component after the `sets` `useMemo`:

```tsx
  const showScenery = useApp((s) => s.tweaks.showScenery);
  if (!showScenery) return null;
```

- [ ] **Step 6: Gate Mountains on `showMountains`**

In `app/src/components/three/Mountains.tsx`, add `import { useApp } from "../../store";` and inside `export function Mountains(...)`, after the `voxels` `useMemo`:

```tsx
  const showMountains = useApp((s) => s.tweaks.showMountains);
  if (voxels.length === 0 || !showMountains) return null;
```

- [ ] **Step 7: Verify typecheck**

Run: `bun run --cwd app typecheck`
Expected: no errors.

---

### Task 5: P key + Esc priority chain + help copy + full verification

**Files:**
- Modify: `app/src/components/three/CivCamera.tsx`
- Modify: `app/src/components/hud/HelpPanel.tsx`

**Interfaces:**
- Consumes: `toggleTweaks` from Task 1.

- [ ] **Step 1: Add P key and tweaks to the Esc chain in CivCamera**

In `app/src/components/three/CivCamera.tsx`:

1. Add to the store subscriptions:

```tsx
  const tweaksOpen = useApp((s) => s.tweaksOpen);
  const toggleTweaks = useApp((s) => s.toggleTweaks);
```

2. Add a ref mirror after the `helpOpenRef` effect:

```tsx
  const tweaksOpenRef = useRef(tweaksOpen);
  useEffect(() => {
    tweaksOpenRef.current = tweaksOpen;
  }, [tweaksOpen]);
```

3. Add `"p"` to `HANDLED_KEYS`:

```tsx
  "q", "e", "r", "+", "-", "f", "home", "escape", "tab", "m", "p",
```

4. Update the key handler — insert the `p` branch and the tweaks-aware Esc:

```tsx
      } else if (k === "p") {
        toggleTweaks();
      } else if (k === "tab") {
        toggleHelp();
      } else if (k === "escape") {
        if (helpOpenRef.current) toggleHelp();
        else if (tweaksOpenRef.current) toggleTweaks();
        else clearSelection();
      } else if (k === "m") {
```

5. Add `toggleTweaks` to the keydown effect deps:

```tsx
  }, [gl, blocks, projects, toggleHelp, toggleTweaks, clearSelection]);
```

- [ ] **Step 2: Add tweak rows to the HelpPanel General group**

In `app/src/components/hud/HelpPanel.tsx`, change the General group to:

```tsx
  {
    title: "General",
    rows: [
      { keys: ["P"], label: "Tweak display" },
      { keys: ["Gear"], label: "Tweak display" },
      { keys: ["Tab"], label: "Toggle help" },
    ],
  },
```

- [ ] **Step 3: Run the full test suite**

Run: `bun test`
Expected: all existing tests pass (no regression).

- [ ] **Step 4: Run typecheck in both workspaces**

Run: `bun run typecheck`
Expected: no errors in either workspace.

- [ ] **Step 5: Run the production build**

Run: `bun run build`
Expected: builds successfully.

- [ ] **Step 6: Manual smoke check**

Run: `bun run dev`, open the app, and verify:
1. Gear button (Header) and `P` open/close the TweakPanel.
2. Each Panels toggle hides/shows its target (Stats, Header, Detail card, Hint bar, Roof legend).
3. Each Stats-row toggle hides/shows its row/list, including the new Top agents list.
4. World toggles hide/show People, Traffic (cars, pedestrians, lights), Scenery (trees/lamps/clouds/bushes), Mountains.
5. Reload keeps tweaks (localStorage).
6. Esc closes help → then tweaks → then clears selection.
7. Reset defaults restores all toggles and persists.