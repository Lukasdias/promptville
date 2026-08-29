import type { BuildingKind } from "./types";

export const PROJECT_PALETTE = [
  "#ffb3ba", "#ffdfba", "#ffffba", "#baffc9",
  "#bae1ff", "#d4baff", "#ffd1dc", "#c9f2ff",
  "#e6ffba", "#ffc9de", "#c1e1c1", "#f0c4ff",
];

export const MODEL_ROOF: Record<string, string> = {
  "deepseek-v4-flash": "#ff7f50",
  "minimax-m3": "#3cb371",
  "kimi-k2.7-code": "#9370db",
  "gpt-5.6-luna": "#ffd700",
};

export const UNKNOWN_ROOF = "#b0a89a";

export const COLORS = {
  sky: "#aee6ff",
  grass: "#9bd46a",
  grassLot: "#8fbf5c",
  grassDark: "#86c255",
  road: "#3c3a42",
  roadLine: "#f7f3e8",
  brick: "#c9744f",
  mortar: "#a85a3d",
  crosswalk: "#f7f3e8",
  curb: "#b8623f",
  cream: "#fff6e5",
  ink: "#4a4453",
  mountain: "#8a9b6e",
  snow: "#f4f1e6",
};

// Ground texture palette (bases reuse COLORS; painters derive tones via shade()).
export const LAWN_B = "#7ab34a";
export const STONE_GROUT = "#e6d6bc";
export const CROSSWALK_BRICK = "#f2c9a8";

export const BUILDING_COLORS: Record<BuildingKind, { body: string; accent: string; roof: string }> = {
  hospital: { body: "#ffffff", accent: "#ff5252", roof: "#eef2f5" },
  police: { body: "#7fb6ff", accent: "#f7f3e8", roof: "#5a8fd4" },
  fire: { body: "#ff6b6b", accent: "#f7f3e8", roof: "#d9534f" },
  mall: { body: "#ffb3ba", accent: "#ffd166", roof: "#f3e3c0" },
  bakery: { body: "#f3d9b1", accent: "#b8722f", roof: "#e8c79a" },
  petshop: { body: "#ffc9de", accent: "#4fd1c5", roof: "#f0c4ff" },
};

// Sky / atmosphere palette for the day-night cycle.
export const SKY = {
  dayTop: "#5fa8ff",
  dayHorizon: "#bfe6ff",
  dawnTop: "#7d7bd0",
  dawnHorizon: "#ffb36b",
  duskTop: "#6a5aa8",
  duskHorizon: "#ff8c5a",
  nightTop: "#0d1230",
  nightHorizon: "#1b2350",
  fog: "#aee6ff",
} as const;

export const SUN_COLOR_DAY = "#fff4d6";
export const SUN_INTENSITY_DAY = 1.4;
export const HEMI_INTENSITY_DAY = 0.9;
export const MOON_INTENSITY_NIGHT = 0.35;
export const AMBIENT_NIGHT = 0.12;

export const LAMP_GLOW = "#ffd98a";
export const WINDOW_GLOW = "#ffcf7a";
export const SIGN_GLOW = "#ffe1a6";
export const GLOW_MAX = 1.6;