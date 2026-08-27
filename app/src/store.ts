import { create } from "zustand";
import type { Neighborhood, SessionData } from "./types";
import { fetchNeighborhood } from "./api";

interface AppState {
  data: Neighborhood | null;
  loading: boolean;
  error: string | null;
  selected: SessionData | null;
  load: () => Promise<void>;
  select: (session: SessionData | null) => void;
  clearSelection: () => void;
}

export const useApp = create<AppState>((set) => ({
  data: null,
  loading: false,
  error: null,
  selected: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchNeighborhood();
      set({ data, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },
  select: (session) => set({ selected: session }),
  clearSelection: () => set({ selected: null }),
}));