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

// A minimal reified path context: maps to what roundedRectPath needs. Any real
// CanvasRenderingContext2D satisfies this structurally.
interface PathCtx {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  closePath(): void;
}

// Draw a rounded rectangle path. `r` is the corner radius; clamped to half the
// smaller side so a large radius never inverts the shape. Pure geometry — the
// caller fills/strokes. Kept here (DOM-free) so its math is unit-testable.
export function roundedRectPath(ctx: PathCtx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
  ctx.lineTo(x + rr, y + h);
  ctx.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + rr);
  ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

// Cartoon outline constants: bold enough to read as "drawn" but not heavy enough
// to smell like a technical diagram.
export const OUTLINE_WIDTH_REL = 0.06;
export const CORNER_RADIUS_REL = 0.12;

// A rounded "sticker" with a bold darker outline drawn first, so it reads as a
// flat cartoon shape with a clear edge. Returns the inset used for the fill.
export function outlinedSticker(
  ctx: PathCtx & { fillStyle: string; beginPath(): void; fill(): void },
  x: number,
  y: number,
  w: number,
  h: number,
  outline: string,
  fill: string,
  radius: number,
  outlineWidth: number,
): void {
  // Outline pass: a slightly larger rounded rect in `outline`.
  ctx.fillStyle = outline;
  ctx.beginPath();
  roundedRectPath(ctx, x - outlineWidth, y - outlineWidth, w + outlineWidth * 2, h + outlineWidth * 2, radius + outlineWidth);
  ctx.fill();
  // Fill pass: the inset rounded rect in `fill`.
  ctx.fillStyle = fill;
  ctx.beginPath();
  roundedRectPath(ctx, x, y, w, h, radius);
  ctx.fill();
}