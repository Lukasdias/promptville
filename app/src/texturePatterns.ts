// Pure pattern math for the ground canvas textures. DOM-free so it runs under
// bun test; the painters in textures.ts consume these descriptors.

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = f >= 0 ? 255 : 0;
  const a = Math.min(1, Math.abs(f));
  const c = (v: number) => Math.round(v + (mix - v) * a);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export interface Blob {
  x: number;
  y: number;
  r: number;
  lighten: number;
}

export function mottleBlobs(size: number, count: number, rand: () => number): Blob[] {
  return Array.from({ length: count }, () => ({
    x: rand() * size,
    y: rand() * size,
    r: size * (0.05 + rand() * 0.15),
    lighten: -0.06 + rand() * 0.12,
  }));
}

export interface StripeBand {
  y: number;
  h: number;
  tone: number;
}

export function stripeBands(size: number, bands: number): StripeBand[] {
  const h = size / bands;
  return Array.from({ length: bands }, (_, i) => ({ y: i * h, h, tone: i % 2 }));
}