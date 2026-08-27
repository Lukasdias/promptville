export interface Voxel {
  x: number;
  y: number;
  z: number;
  color: string;
}

export const DOOR_COLOR = "#7a5230";
export const WINDOW_COLOR = "#aee6ff";
export const CHIMNEY_COLOR = "#c96f6f";
export const TRUNK_COLOR = "#8b5a2b";
export const POLE_COLOR = "#5a5a5a";
export const GLOW_COLOR = "#ffd98a";

export interface HouseVoxelOptions {
  body: string;
  roof: string;
  door?: string;
  window?: string;
  width?: number;
  depth?: number;
  walls: number;
  pitched?: boolean;
  chimney?: boolean;
}

export function houseVoxels(o: HouseVoxelOptions): Voxel[] {
  const W = o.width ?? 7;
  const D = o.depth ?? 7;
  const hw = Math.floor(W / 2);
  const hd = Math.floor(D / 2);
  const door = o.door ?? DOOR_COLOR;
  const window = o.window ?? WINDOW_COLOR;
  const pitched = o.pitched !== false;
  const voxels: Voxel[] = [];

  const push = (x: number, y: number, z: number, color: string) => {
    voxels.push({ x, y, z, color });
  };

  // Hollow walls
  for (let x = -hw; x <= hw; x++) {
    for (let z = -hd; z <= hd; z++) {
      if (Math.abs(x) === hw || Math.abs(z) === hd) {
        for (let y = 0; y < o.walls; y++) push(x, y, z, o.body);
      }
    }
  }

  // Door on the front face (+z)
  if (o.walls >= 2) {
    push(0, 0, hd, door);
    push(0, 1, hd, door);
  }

  // Windows
  if (o.walls >= 4) {
    push(-2, 2, hd, window);
    push(2, 2, hd, window);
  }

  if (pitched) {
    // Solid stepped pyramid roof
    for (let layer = 0; layer <= hw; layer++) {
      const r = hw - layer;
      const y = o.walls + layer;
      for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
          push(x, y, z, o.roof);
        }
      }
    }
    if (o.chimney) push(2, o.walls + hw + 1, 0, CHIMNEY_COLOR);
  } else {
    // Flat slab roof
    for (let x = -hw; x <= hw; x++) {
      for (let z = -hd; z <= hd; z++) {
        push(x, o.walls, z, o.roof);
      }
    }
    if (o.chimney) push(2, o.walls + 1, 0, CHIMNEY_COLOR);
  }

  return voxels;
}

export function treeVoxels(foliage: string, trunk: string = TRUNK_COLOR): Voxel[] {
  const voxels: Voxel[] = [];
  for (let y = 0; y < 2; y++) voxels.push({ x: 0, y, z: 0, color: trunk });
  for (let y = 2; y < 5; y++) {
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        if (y === 4 && Math.abs(x) === 1 && Math.abs(z) === 1) continue;
        voxels.push({ x, y, z, color: foliage });
      }
    }
  }
  voxels.push({ x: 0, y: 5, z: 0, color: foliage });
  return voxels;
}

export function lampVoxels(pole: string = POLE_COLOR, glow: string = GLOW_COLOR): Voxel[] {
  const voxels: Voxel[] = [];
  for (let y = 0; y < 3; y++) voxels.push({ x: 0, y, z: 0, color: pole });
  voxels.push({ x: 0, y: 3, z: 0, color: glow });
  return voxels;
}

export function mountainVoxels(
  height: number,
  base: string = "#8a9b6e",
  snow: string = "#f4f1e6",
): Voxel[] {
  const voxels: Voxel[] = [];
  for (let y = 0; y < height; y++) {
    const r = height - 1 - y;
    const isSnow = y >= height - 2;
    const color = isSnow ? snow : base;
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        voxels.push({ x, y, z, color });
      }
    }
  }
  return voxels;
}