import { SKY, SUN_COLOR_DAY } from "./theme";

// t is a fraction of 24h in [0,1): 0 = midnight, 0.5 = noon.
const TAU = Math.PI * 2;
const HORIZON_HALF = 0.35;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function daylight(t: number): number {
  const e = Math.sin((t - 0.25) * TAU);
  return clamp01(0.5 * e + 0.5);
}

export function nightAmount(t: number): number {
  return 1 - daylight(t);
}

export function sunDirection(t: number): { x: number; y: number; z: number } {
  const az = t * TAU - Math.PI;
  const el = (t - 0.25) * TAU;
  const y = Math.sin(el);
  const r = Math.cos(el);
  return { x: Math.cos(az) * r, y, z: Math.sin(az) * r };
}

export function moonDirection(t: number): { x: number; y: number; z: number } {
  return sunDirection((t + 0.5) % 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexLerp(a: string, b: string, t: number): string {
  const parse = (h: string): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(lerp(ar, br, t))}${h(lerp(ag, bg, t))}${h(lerp(ab, bb, t))}`;
}

// Sky color transition weight: full day midnight->... Simplifies to a smooth
// day↔night blend driven by daylight, staying near the day palette around noon.
function phaseWeight(t: number): number {
  return clamp01((daylight(t) - 0.5) * 2 + HORIZON_HALF);
}

export function skyPalette(t: number): {
  top: string;
  horizon: string;
  fog: string;
  sunColor: string;
} {
  const w = phaseWeight(t);
  const top = hexLerp(SKY.nightTop, hexLerp(SKY.dawnTop, SKY.dayTop, w), 0.5 + w * 0.5);
  const horizon = hexLerp(SKY.nightHorizon, hexLerp(SKY.dawnHorizon, SKY.dayHorizon, w), 0.5 + w * 0.5);
  const fog = hexLerp(SKY.nightHorizon, SKY.fog, clamp01(w));
  const sunColor = w < 0.25 ? SKY.duskHorizon : w > 0.75 ? SUN_COLOR_DAY : SKY.dawnHorizon;
  return { top, horizon, fog, sunColor };
}
