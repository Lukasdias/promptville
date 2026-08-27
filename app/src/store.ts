import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionData, BuildingKind } from "./types";
import type { BuildingActivity } from "./activity";

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
  showBuildings: boolean;
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
  showBuildings: true,
};

interface AppState {
  selected: SessionData | null;
  select: (session: SessionData | null) => void;
  selectedBuilding: BuildingKind | null;
  selectBuilding: (building: BuildingKind | null) => void;
  clearSelection: () => void;
  activity: BuildingActivity;
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
      selectedBuilding: null,
      selectBuilding: (building) => set({ selectedBuilding: building }),
      clearSelection: () => set({ selected: null, selectedBuilding: null }),
      activity: {
        hospital: { visitors: 0, cars: 0 },
        police: { visitors: 0, cars: 0 },
        fire: { visitors: 0, cars: 0 },
        mall: { visitors: 0, cars: 0 },
        bakery: { visitors: 0, cars: 0 },
        petshop: { visitors: 0, cars: 0 },
      },
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