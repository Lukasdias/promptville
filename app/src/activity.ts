import { useEffect } from "react";
import { useApp } from "./store";
import type { BuildingKind } from "./types";

export type BuildingActivity = Record<BuildingKind, { visitors: number; cars: number }>;

const ZERO: BuildingActivity = {
  hospital: { visitors: 0, cars: 0 },
  police: { visitors: 0, cars: 0 },
  fire: { visitors: 0, cars: 0 },
  mall: { visitors: 0, cars: 0 },
  bakery: { visitors: 0, cars: 0 },
  petshop: { visitors: 0, cars: 0 },
};

const counters: BuildingActivity = structuredClone(ZERO);

export function resetBuildingActivity(): void {
  for (const k of Object.keys(counters) as BuildingKind[]) {
    counters[k].visitors = 0;
    counters[k].cars = 0;
  }
}

export function bumpBuildingActivity(
  kind: BuildingKind,
  metric: "visitors" | "cars",
  delta: number,
): void {
  counters[kind][metric] = Math.max(0, counters[kind][metric] + delta);
}

export function snapshotBuildingActivity(): BuildingActivity {
  return structuredClone(counters);
}

// Flushes the mutable counters into the zustand store once per second so the
// HUD sees live counts without any setState inside useFrame.
export function useActivityPump(): void {
  useEffect(() => {
    const id = setInterval(() => {
      useApp.setState({ activity: snapshotBuildingActivity() });
    }, 1000);
    return () => clearInterval(id);
  }, []);
}