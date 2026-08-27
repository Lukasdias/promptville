import { create } from "zustand";
import type { SessionData } from "./types";

interface AppState {
  selected: SessionData | null;
  select: (session: SessionData | null) => void;
  clearSelection: () => void;
}

export const useApp = create<AppState>((set) => ({
  selected: null,
  select: (session) => set({ selected: session }),
  clearSelection: () => set({ selected: null }),
}));