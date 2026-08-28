import type { BuildingKind } from "./types";
import type { Street } from "./layout";
import { COLORS } from "./theme";

export interface Voxel {
  x: number;
  y: number;
  z: number;
  color: string;
}

export const CROSS_RED = "#ff5252";
export const SIREN_BLUE = "#3a7bd5";
export const GARAGE_DARK = "#222222";
export const BELL_YELLOW = "#ffd24a";
export const AWNING_COLORS = ["#ff8fa3", "#ffd166", "#7fb6ff", "#b0f2b4"];
export const BREAD_TAN = "#d99b58";
export const BREAD_BROWN = "#b8722f";

export interface PublicBuildingOptions {
  kind: BuildingKind;
  body: string;
  accent: string;
  roof: string;
  walls: number;
  width?: number;
  depth?: number;
}

// Generic civic building: hollow walls + roof slab, then a per-kind signature
// mark. Follows the voxel-forms skill (footprint → walls → roof → marks).
export function publicBuildingVoxels(o: PublicBuildingOptions): Voxel[] {
  const W = o.width ?? 7;
  const D = o.depth ?? 7;
  const hw = Math.floor(W / 2);
  const hd = Math.floor(D / 2);
  const voxels: Voxel[] = [];
  const push = (x: number, y: number, z: number, color: string) => voxels.push({ x, y, z, color });

  for (let x = -hw; x <= hw; x++) {
    for (let z = -hd; z <= hd; z++) {
      if (Math.abs(x) === hw || Math.abs(z) === hd) {
        for (let y = 0; y < o.walls; y++) push(x, y, z, o.body);
      }
    }
  }

  for (let x = -hw; x <= hw; x++) {
    for (let z = -hd; z <= hd; z++) push(x, o.walls, z, o.roof);
  }

  if (o.walls >= 3) {
    for (let x = -hw; x <= hw; x++) {
      for (let z = -hd; z <= hd; z++) {
        if (Math.abs(x) === hw || Math.abs(z) === hd) push(x, 2, z, o.accent);
      }
    }
  }

  if (o.walls >= 2) {
    push(0, 0, hd, o.accent);
    push(0, 1, hd, o.accent);
  }
  if (o.walls >= 4) {
    push(-2, 3, hd, WINDOW_COLOR);
    push(2, 3, hd, WINDOW_COLOR);
  } else if (o.walls >= 3) {
    push(-2, 1, hd, WINDOW_COLOR);
    push(2, 1, hd, WINDOW_COLOR);
  }

  switch (o.kind) {
    case "hospital": {
      push(0, o.walls + 1, 0, CROSS_RED);
      push(-1, o.walls + 1, 0, CROSS_RED);
      push(1, o.walls + 1, 0, CROSS_RED);
      push(0, o.walls + 1, -1, CROSS_RED);
      push(0, o.walls + 1, 1, CROSS_RED);
      break;
    }
    case "police": {
      push(0, o.walls + 1, 0, SIREN_BLUE);
      push(0, o.walls + 2, 0, CROSS_RED);
      break;
    }
    case "fire": {
      push(-2, 0, hd, GARAGE_DARK);
      push(-2, 1, hd, GARAGE_DARK);
      push(2, 0, hd, GARAGE_DARK);
      push(2, 1, hd, GARAGE_DARK);
      for (let y = o.walls + 1; y <= o.walls + 3; y++) push(-hw + 1, y, 0, o.accent);
      push(-hw + 1, o.walls + 4, 0, BELL_YELLOW);
      break;
    }
    case "mall": {
      for (let x = -hw; x <= hw; x++) push(x, 1, hd, AWNING_COLORS[(x + hw + 4) % AWNING_COLORS.length]);
      for (let x = -2; x <= 2; x++) {
        push(x, o.walls + 1, 0, BELL_YELLOW);
        push(x, o.walls + 2, 0, CROSS_RED);
      }
      break;
    }
    case "bakery": {
      push(-1, o.walls + 1, 0, BREAD_BROWN);
      push(0, o.walls + 1, 0, BREAD_BROWN);
      push(1, o.walls + 1, 0, BREAD_BROWN);
      push(0, o.walls + 2, 0, BREAD_BROWN);
      for (let x = -hw; x <= hw; x++) push(x, 2, hd, BREAD_TAN);
      break;
    }
    case "petshop": {
      push(0, 2, hd, o.accent);
      push(-1, 2, hd, o.accent);
      push(1, 2, hd, o.accent);
      push(0, 3, hd, o.accent);
      break;
    }
  }

  return voxels;
}

export const DOOR_COLOR = "#7a5230";
export const WINDOW_COLOR = "#aee6ff";
export const CHIMNEY_COLOR = "#c96f6f";
export const TRUNK_COLOR = "#8b5a2b";
export const POLE_COLOR = "#5a5a5a";
export const GLOW_COLOR = "#ffd98a";
export const SKIN_COLOR = "#f0c8a0";
export const PANT_COLOR = "#4a4453";
export const ANTENNA_COLOR = "#8b8b8b";
export const ANTENNA_TIP_COLOR = "#ff5252";
export const MOUNTAIN_COLOR = "#8a9b6e";
export const SNOW_COLOR = "#f4f1e6";
export const BUSH_COLOR = "#6fb05e";
export const FLOWER_COLORS = ["#ff9fc0", "#ffd166", "#b0e0ff", "#d4baff"];
export const FLOWER_GROUND = "#86c255";
export const MAILBOX_COLOR = "#7fb6ff";
export const MAILBOX_POST = "#5a4a3a";
export const SIGN_POLE = "#3c3a42";
export const SIGN_BOARD = "#f7f3e8";
export const BENCH_WOOD = "#c97b4a";
export const FOUNTAIN_STONE = "#d8d4c8";
export const FOUNTAIN_WATER = "#7fc9ff";
export const HYDRANT_COLOR = "#e8503a";
export const CONE_COLOR = "#ff9f1c";
export const TRAFFIC_POLE = "#3c3a42";
export const TRAFFIC_BOX = "#222222";
export const TRAFFIC_GREEN = "#3ddc64";
export const TRAFFIC_YELLOW = "#ffd24a";
export const TRAFFIC_RED = "#ff5252";

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
  windows?: boolean;
  sideWindows?: boolean;
  antenna?: boolean;
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

  // Front windows
  if (o.windows !== false && o.walls >= 4) {
    push(-2, 2, hd, window);
    push(2, 2, hd, window);
  }

  // Side window columns (mansion / skyscraper)
  if (o.sideWindows) {
    for (let y = 2; y < o.walls - 1; y += 2) {
      push(hw, y, -1, window);
      push(hw, y, 1, window);
      push(-hw, y, -1, window);
      push(-hw, y, 1, window);
    }
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
    if (o.antenna) {
      push(0, o.walls + 1, 0, ANTENNA_COLOR);
      push(0, o.walls + 2, 0, ANTENNA_TIP_COLOR);
    }
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

export function personVoxels(shirt: string, skin: string = SKIN_COLOR): Voxel[] {
  const voxels: Voxel[] = [];
  voxels.push({ x: 0, y: 0, z: 0, color: PANT_COLOR });
  voxels.push({ x: 0, y: 1, z: 0, color: shirt });
  voxels.push({ x: 0, y: 2, z: 0, color: shirt });
  voxels.push({ x: 0, y: 3, z: 0, color: skin });
  return voxels;
}

export function bushVoxels(color: string = BUSH_COLOR): Voxel[] {
  const voxels: Voxel[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) voxels.push({ x, y: 0, z, color });
  }
  for (let x = -1; x <= 1; x++) voxels.push({ x, y: 1, z: 0, color });
  voxels.push({ x: 0, y: 1, z: -1, color });
  voxels.push({ x: 0, y: 1, z: 1, color });
  voxels.push({ x: 0, y: 2, z: 0, color });
  return voxels;
}

export function flowersVoxels(
  colors: string[] = FLOWER_COLORS,
  ground: string = FLOWER_GROUND,
): Voxel[] {
  const voxels: Voxel[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) voxels.push({ x, y: 0, z, color: ground });
  }
  voxels.push({ x: -1, y: 1, z: -1, color: colors[0] });
  voxels.push({ x: 1, y: 1, z: -1, color: colors[1] });
  voxels.push({ x: 0, y: 1, z: 1, color: colors[2] });
  voxels.push({ x: 0, y: 1, z: 0, color: colors[3] });
  return voxels;
}

export function mailboxVoxels(body: string = MAILBOX_COLOR, post: string = MAILBOX_POST): Voxel[] {
  const voxels: Voxel[] = [];
  voxels.push({ x: 0, y: 0, z: 0, color: post });
  voxels.push({ x: 0, y: 1, z: 0, color: post });
  voxels.push({ x: 0, y: 2, z: 0, color: body });
  voxels.push({ x: 1, y: 2, z: 0, color: body });
  return voxels;
}

export function signVoxels(pole: string = SIGN_POLE, board: string = SIGN_BOARD): Voxel[] {
  const voxels: Voxel[] = [];
  for (let y = 0; y < 3; y++) voxels.push({ x: 0, y, z: 0, color: pole });
  voxels.push({ x: -1, y: 3, z: 0, color: board });
  voxels.push({ x: 0, y: 3, z: 0, color: board });
  voxels.push({ x: 1, y: 3, z: 0, color: board });
  return voxels;
}

export function benchVoxels(wood: string = BENCH_WOOD): Voxel[] {
  const voxels: Voxel[] = [];
  voxels.push({ x: -1, y: 0, z: -1, color: wood });
  voxels.push({ x: 1, y: 0, z: -1, color: wood });
  voxels.push({ x: -1, y: 0, z: 1, color: wood });
  voxels.push({ x: 1, y: 0, z: 1, color: wood });
  voxels.push({ x: -1, y: 1, z: 0, color: wood });
  voxels.push({ x: 0, y: 1, z: 0, color: wood });
  voxels.push({ x: 1, y: 1, z: 0, color: wood });
  voxels.push({ x: -1, y: 2, z: -1, color: wood });
  voxels.push({ x: 0, y: 2, z: -1, color: wood });
  voxels.push({ x: 1, y: 2, z: -1, color: wood });
  return voxels;
}

export function fountainVoxels(
  stone: string = FOUNTAIN_STONE,
  water: string = FOUNTAIN_WATER,
): Voxel[] {
  const voxels: Voxel[] = [];
  voxels.push({ x: -1, y: 0, z: 0, color: stone });
  voxels.push({ x: 1, y: 0, z: 0, color: stone });
  voxels.push({ x: 0, y: 0, z: -1, color: stone });
  voxels.push({ x: 0, y: 0, z: 1, color: stone });
  voxels.push({ x: 0, y: 1, z: 0, color: water });
  voxels.push({ x: 0, y: 2, z: 0, color: stone });
  voxels.push({ x: 0, y: 3, z: 0, color: stone });
  return voxels;
}

export function hydrantVoxels(color: string = HYDRANT_COLOR): Voxel[] {
  const voxels: Voxel[] = [];
  voxels.push({ x: 0, y: 0, z: 0, color });
  voxels.push({ x: 0, y: 1, z: 0, color });
  voxels.push({ x: 0, y: 2, z: 0, color });
  voxels.push({ x: 1, y: 2, z: 0, color });
  voxels.push({ x: -1, y: 2, z: 0, color });
  return voxels;
}

export function coneVoxels(color: string = CONE_COLOR): Voxel[] {
  const voxels: Voxel[] = [];
  voxels.push({ x: 0, y: 0, z: 0, color });
  voxels.push({ x: 0, y: 1, z: 0, color });
  voxels.push({ x: 0, y: 2, z: 0, color });
  return voxels;
}

export function trafficLightVoxels(pole: string = TRAFFIC_POLE): Voxel[] {
  const voxels: Voxel[] = [];
  for (let y = 0; y <= 2; y++) voxels.push({ x: 0, y, z: 0, color: pole });
  voxels.push({ x: 0, y: 3, z: 0, color: TRAFFIC_GREEN });
  voxels.push({ x: 0, y: 4, z: 0, color: TRAFFIC_YELLOW });
  voxels.push({ x: 0, y: 5, z: 0, color: TRAFFIC_RED });
  return voxels;
}

export const WHEEL_COLOR = "#2b2b2b";

export function carVoxels(body: string, window: string = WINDOW_COLOR, wheel: string = WHEEL_COLOR): Voxel[] {
  const voxels: Voxel[] = [];
  // Base chassis 3×3, leaving the four corners for the wheels
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      if (Math.abs(x) === 1 && Math.abs(z) === 1) continue;
      voxels.push({ x, y: 0, z, color: body });
    }
  }
  // Visible wheels at the four corners
  voxels.push({ x: -1, y: 0, z: -1, color: wheel });
  voxels.push({ x: 1, y: 0, z: -1, color: wheel });
  voxels.push({ x: -1, y: 0, z: 1, color: wheel });
  voxels.push({ x: 1, y: 0, z: 1, color: wheel });
  // Cabin with windshield and rear window
  voxels.push({ x: -1, y: 1, z: 0, color: window });
  voxels.push({ x: 0, y: 1, z: 0, color: body });
  voxels.push({ x: 1, y: 1, z: 0, color: window });
  return voxels;
}

// Translates a unit-grid pattern onto an absolute position for a given voxel size.
export function placeVoxels(pattern: Voxel[], bx: number, bz: number, size: number): Voxel[] {
  return pattern.map((v) => ({
    x: bx / size - 0.5 + v.x,
    y: v.y,
    z: bz / size - 0.5 + v.z,
    color: v.color,
  }));
}

export const SIDEWALK_SIZE = 0.4;
export const SIDEWALK_CELLS = 2;

// Raised voxel sidewalks flanking every street, with a curb row on the
// street-facing edge. Cells are emitted at world-relative grid positions
// (x = wx / size - 0.5 so InstancedVoxels centers them at wx). Cells that
// fall inside any street's road paving (a crossing street) are culled.
export function streetSidewalkVoxels(
  streets: Street[],
  size: number = SIDEWALK_SIZE,
  walk: string = COLORS.brick,
  curb: string = COLORS.curb,
): Voxel[] {
  const insideRoad = (wx: number, wz: number) =>
    streets.some((s) => Math.abs(wx - s.x) < s.width / 2 && Math.abs(wz - s.z) < s.depth / 2);

  const voxels: Voxel[] = [];
  const emit = (wx: number, wz: number, color: string) => {
    if (insideRoad(wx, wz)) return;
    voxels.push({ x: wx / size - 0.5, y: 0, z: wz / size - 0.5, color });
  };

  for (const s of streets) {
    const horizontal = s.width >= s.depth;
    const half = horizontal ? s.width / 2 : s.depth / 2;
    const roadHalf = horizontal ? s.depth / 2 : s.width / 2;
    const cOff = roadHalf + size / 2;
    const wOff = roadHalf + size + size / 2;

    for (let p = 0; p < Math.ceil((2 * half) / size); p++) {
      const ac = -half + (p + 0.5) * size;
      for (const sign of [-1, 1]) {
        if (horizontal) {
          emit(s.x + ac, s.z + sign * cOff, curb);
          emit(s.x + ac, s.z + sign * wOff, walk);
        } else {
          emit(s.x + sign * cOff, s.z + ac, curb);
          emit(s.x + sign * wOff, s.z + ac, walk);
        }
      }
    }
  }

  return voxels;
}

// A continuous ridge ring around (cx, cz): columns of voxels whose height follows
// smooth sinusoidal peaks around the ring, with a falloff away from the centerline.
// No angular gaps — adjacent angle samples blend into a closed wall.
export function mountainRingVoxels(
  cx: number,
  cz: number,
  radius: number,
  halfWidth: number,
  base: string = MOUNTAIN_COLOR,
  snow: string = SNOW_COLOR,
): Voxel[] {
  const voxels: Voxel[] = [];
  const min = Math.floor(-radius - halfWidth);
  const max = Math.ceil(radius + halfWidth);

  for (let x = min; x <= max; x++) {
    for (let z = min; z <= max; z++) {
      const dx = x - cx;
      const dz = z - cz;
      const d = Math.sqrt(dx * dx + dz * dz);
      const t = Math.abs(d - radius);
      if (t >= halfWidth) continue;
      const falloff = 1 - t / halfWidth;
      const angle = Math.atan2(dz, dx);
      const peak = 11 + Math.sin(angle * 2 + 1.3) * 3.2 + Math.sin(angle * 5 + 0.7) * 2.6;
      const h = Math.round(peak * falloff);
      if (h <= 0) continue;
      const isSnowy = h >= 13;
      const snowDepth = isSnowy ? 2 : 0;
      for (let y = 0; y < h; y++) {
        voxels.push({ x, y, z, color: y >= h - snowDepth ? snow : base });
      }
    }
  }

  return voxels;
}