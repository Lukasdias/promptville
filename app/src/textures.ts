import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from "three";
import { mulberry32 } from "./rand";
import { mottleBlobs, shade, stripeBands } from "./texturePatterns";
import { COLORS, LAWN_B, STONE_GROUT } from "./theme";

const TILE = 128;
const GRASS_SEED = 101;
const GRASS_BLOBS = 28;
const GRASS_LOT_SEED = 202;
const GRASS_LOT_BLOBS = 20;
const PARK_SEED = 303;
const LAWN_BANDS = 6;
const ASPHALT_SEED = 404;
const ASPHALT_SPECKLES = 240;
const STONE_SEED = 505;
const STONE_TILES = 4;

// World units one texture tile covers, per surface (fixed world scale).
export const GRASS_TILE_WORLD = 6;
export const BRICK_TILE_X = 1.6;
export const BRICK_TILE_Y = 0.8;
export const ASPHALT_TILE_WORLD = 4;
export const STONE_TILE_WORLD = 3;

export function makeTileableTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  paint(ctx);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function makeMaterial(texture: CanvasTexture): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ map: texture, roughness: 1 });
  material.needsUpdate = true;
  return material;
}

// Draws `draw` at the 3x3 wrapped offsets so edge-crossing shapes tile seamlessly.
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  size: number,
  draw: (dx: number, dy: number) => void,
): void {
  for (let dx = -size; dx <= size; dx += size) {
    for (let dy = -size; dy <= size; dy += size) draw(dx, dy);
  }
}

function paintGrass(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, TILE, TILE);
  const rand = mulberry32(GRASS_SEED);
  for (const blob of mottleBlobs(TILE, GRASS_BLOBS, rand)) {
    ctx.fillStyle = shade(COLORS.grass, blob.lighten);
    ctx.globalAlpha = 0.45;
    drawWrapped(ctx, TILE, (dx, dy) => {
      ctx.beginPath();
      ctx.arc(blob.x + dx, blob.y + dy, blob.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

function paintGrassLot(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.grassLot;
  ctx.fillRect(0, 0, TILE, TILE);
  const rand = mulberry32(GRASS_LOT_SEED);
  for (const blob of mottleBlobs(TILE, GRASS_LOT_BLOBS, rand)) {
    ctx.fillStyle = shade(COLORS.grassLot, blob.lighten);
    ctx.globalAlpha = 0.45;
    drawWrapped(ctx, TILE, (dx, dy) => {
      ctx.beginPath();
      ctx.arc(blob.x + dx, blob.y + dy, blob.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  // Faint vertical mow stripes (axis-aligned so the tile wraps seamlessly).
  ctx.globalAlpha = 0.5;
  const step = 16;
  for (let i = 1; i * step < TILE; i += 2) {
    ctx.fillStyle = shade(COLORS.grassLot, -0.05);
    ctx.fillRect(i * step, 0, step, TILE);
  }
  ctx.globalAlpha = 1;
}

function paintPark(ctx: CanvasRenderingContext2D): void {
  const rand = mulberry32(PARK_SEED);
  for (const band of stripeBands(TILE, LAWN_BANDS)) {
    ctx.fillStyle = band.tone === 0 ? COLORS.grassDark : LAWN_B;
    ctx.fillRect(0, band.y, TILE, band.h);
  }
  for (const blob of mottleBlobs(TILE, 10, rand)) {
    ctx.fillStyle = shade(COLORS.grassDark, blob.lighten);
    ctx.globalAlpha = 0.25;
    drawWrapped(ctx, TILE, (dx, dy) => {
      ctx.beginPath();
      ctx.arc(blob.x + dx, blob.y + dy, blob.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

function paintAsphalt(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.road;
  ctx.fillRect(0, 0, TILE, TILE);
  const rand = mulberry32(ASPHALT_SEED);
  for (let i = 0; i < ASPHALT_SPECKLES; i++) {
    const x = rand() * TILE;
    const y = rand() * TILE;
    ctx.fillStyle = rand() < 0.5 ? shade(COLORS.road, 0.05) : shade(COLORS.road, -0.07);
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

function paintStone(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, TILE, TILE);
  const rand = mulberry32(STONE_SEED);
  const t = TILE / STONE_TILES;
  for (let i = 0; i < STONE_TILES; i++) {
    for (let j = 0; j < STONE_TILES; j++) {
      ctx.fillStyle = shade(COLORS.cream, (rand() - 0.5) * 0.08);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
    }
  }
  ctx.globalAlpha = 1;
  // Grout lines: interior jittered for a natural look, edges fixed so the tile wraps.
  ctx.strokeStyle = STONE_GROUT;
  ctx.lineWidth = 2;
  for (let i = 1; i < STONE_TILES; i++) {
    const x = i * t + (rand() - 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, TILE);
    ctx.stroke();
  }
  for (let j = 1; j < STONE_TILES; j++) {
    const y = j * t + (rand() - 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TILE, y);
    ctx.stroke();
  }
}

function paintBrick(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.mortar;
  ctx.fillRect(0, 0, 96, 48);
  const rows = 2;
  const cols = 3;
  const brickH = 48 / rows;
  const brickW = 96 / cols;
  const mortar = 3;
  ctx.fillStyle = COLORS.brick;
  for (let r = 0; r < rows; r++) {
    const y = r * brickH;
    const off = r % 2 === 0 ? 0 : brickW / 2;
    for (let c = 0; c < cols; c++) {
      const x = c * brickW + off;
      ctx.fillRect(x, y + mortar / 2, brickW - mortar, brickH - mortar);
    }
  }
}

export const grassTexture = makeTileableTexture(TILE, TILE, paintGrass);
export const grassMaterial = makeMaterial(grassTexture);
export const grassLotTexture = makeTileableTexture(TILE, TILE, paintGrassLot);
export const grassLotMaterial = makeMaterial(grassLotTexture);
export const parkTexture = makeTileableTexture(TILE, TILE, paintPark);
export const parkMaterial = makeMaterial(parkTexture);
export const asphaltTexture = makeTileableTexture(TILE, TILE, paintAsphalt);
export const asphaltMaterial = makeMaterial(asphaltTexture);
export const plazaTexture = makeTileableTexture(TILE, TILE, paintStone);
export const plazaMaterial = makeMaterial(plazaTexture);

// Brick sidewalk: one shared canvas; per-strip clones carry only their own
// repeat so brick world-scale stays constant on varying-length strips.
export const sidewalkTexture = makeTileableTexture(96, 48, paintBrick);

export function sidewalkMaterialFor(width: number, depth: number): MeshStandardMaterial {
  const tex = sidewalkTexture.clone();
  tex.repeat.set(Math.max(1, width / BRICK_TILE_X), Math.max(1, depth / BRICK_TILE_Y));
  tex.needsUpdate = true;
  const material = new MeshStandardMaterial({ map: tex, roughness: 1 });
  material.needsUpdate = true;
  return material;
}

// Per-surface materials that keep the base texture at a constant world scale
// (repeat = size / tileWorld) and use polygonOffset so near-coplanar surfaces
// resolve deterministically instead of z-fighting. One per lot/street/plaza/park.
function tiledSurfaceMaterial(
  base: CanvasTexture,
  width: number,
  depth: number,
  tileWorld: number,
): MeshStandardMaterial {
  const tex = base.clone();
  tex.repeat.set(Math.max(1, width / tileWorld), Math.max(1, depth / tileWorld));
  tex.needsUpdate = true;
  const material = new MeshStandardMaterial({
    map: tex,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.needsUpdate = true;
  return material;
}

export function asphaltMaterialFor(width: number, depth: number): MeshStandardMaterial {
  return tiledSurfaceMaterial(asphaltTexture, width, depth, ASPHALT_TILE_WORLD);
}

export function grassLotMaterialFor(width: number, depth: number): MeshStandardMaterial {
  return tiledSurfaceMaterial(grassLotTexture, width, depth, GRASS_TILE_WORLD);
}

export function plazaMaterialFor(width: number, depth: number): MeshStandardMaterial {
  return tiledSurfaceMaterial(plazaTexture, width, depth, STONE_TILE_WORLD);
}

export function parkMaterialFor(size: number): MeshStandardMaterial {
  return tiledSurfaceMaterial(parkTexture, size, size, GRASS_TILE_WORLD);
}