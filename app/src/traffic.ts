import type { Street } from "./layout";

export interface Intersection {
  id: number;
  x: number;
  z: number;
}

export type Axis = "x" | "z";
export type SignalColor = "green" | "yellow" | "red";

const YELLOW_DURATION = 1.5;

// Finds every junction where a vertical street meets a horizontal avenue.
export function findIntersections(streets: Street[]): Intersection[] {
  const horizontals = streets.filter((s) => s.width >= s.depth);
  const verticals = streets.filter((s) => s.width < s.depth);
  const out: Intersection[] = [];
  let id = 0;
  for (const h of horizontals) {
    for (const v of verticals) {
      const inX = v.x > h.x - h.width / 2 && v.x < h.x + h.width / 2;
      const inZ = h.z - h.depth / 2 <= v.z + v.depth / 2 && h.z + h.depth / 2 >= v.z - v.depth / 2;
      if (inX && inZ) out.push({ id: id++, x: v.x, z: h.z });
    }
  }
  return out;
}

// Adaptive-style traffic light controller. Avenues (x) stay green ~2/3 of the time
// and side streets (z) get a short window; each phase ends with a fixed yellow
// clearance. Phase durations vary per cycle instead of a rigid timer, loosely
// modeled on density-adaptive signal control.
export class TrafficController {
  private axis: Axis[] = [];
  private color: ("green" | "yellow")[] = [];
  private until: number[] = [];
  private time = 0;

  constructor(
    private readonly intersections: Intersection[],
    private readonly cycle = 8,
    private readonly rng: () => number = Math.random,
  ) {
    for (let i = 0; i < intersections.length; i++) {
      this.axis.push(i % 2 === 0 ? "x" : "z");
      this.color.push("green");
      this.until.push(this.greenDuration(this.axis[i]));
    }
  }

  private greenDuration(axis: Axis): number {
    const base = axis === "x" ? this.cycle : this.cycle * 0.5;
    return base * (0.7 + this.rng() * 0.6);
  }

  tick(delta: number): void {
    this.time += delta;
    for (let i = 0; i < this.intersections.length; i++) {
      while (this.time >= this.until[i]) {
        if (this.color[i] === "green") {
          this.color[i] = "yellow";
          this.until[i] += YELLOW_DURATION;
        } else {
          this.color[i] = "green";
          this.axis[i] = this.axis[i] === "x" ? "z" : "x";
          this.until[i] += this.greenDuration(this.axis[i]);
        }
      }
    }
  }

  greenFor(id: number, axis: Axis): boolean {
    return this.color[id] === "green" && this.axis[id] === axis;
  }

  yellowFor(id: number): boolean {
    return this.color[id] === "yellow";
  }

  // The signal the avenue (x-axis) traffic sees at this intersection.
  signalColorFor(id: number): SignalColor {
    if (this.color[id] === "green") return this.axis[id] === "x" ? "green" : "red";
    return this.axis[id] === "x" ? "yellow" : "red";
  }
}