import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Street } from "../../layout";
import { traffic } from "../../config";
import { useApp } from "../../store";
import type { Intersection, TrafficController } from "../../traffic";
import { pickDestination } from "../../traffic";
import { planRoute, type RoadGraph, type Curb } from "../../roadgraph";
import { carVoxels, personVoxels, type Voxel } from "../../voxel";
import type { VisitorPath } from "../../civic";
import type { BuildingKind } from "../../types";
import { bumpBuildingActivity } from "../../activity";
import { mulberry32 } from "../../rand";
import { InstancedVoxels } from "./InstancedVoxels";
import { TrafficLights } from "./TrafficLights";

const CAR_COLORS = ["#ff8fa3", "#ffd166", "#7fb6ff", "#b0f2b4", "#ffa86b"];
const RUNNER_COLORS = ["#ffb3ba", "#bae1ff", "#baffc9", "#ffffba", "#d4baff", "#ffd1dc"];
const WALKER_COLORS = ["#f0c4ff", "#e6ffba", "#c9f2ff", "#ffdfba"];

// Center of the sidewalk strip (street edge + half the sidewalk width).
const SIDEWALK_CENTER = 0.35;

const CAR_SIZE = 0.2;
const PUFF_VOXELS: Voxel[] = [{ x: 0, y: 0, z: 0, color: "#dcdcdc" }];
const PUFF_COUNT = 4;

const CAR_ACCEL = 3.5;
const CAR_BRAKE = 7;
// Cars stop this far before the intersection center so they never sit on the
// traffic light or inside the crossing.
const STOP_CLEAR = 2.0;
const END_MARGIN = 0.4;
// Half the road width split per lane: each lane sits at ±LANE_OFFSET from the
// centerline so cars on the same road run side-by-side, one per direction.
const LANE_OFFSET = 0.9;
// Leader-following: a car brakes to hold MIN_GAP behind the car ahead in its own
// lane (same direction), and starts easing off within FOLLOW_RAMP. No collision
// resolution — just spacing so cars never pass through each other.
const MIN_GAP = 1.4;
const TAIL = 0.5;            // how far the leader's rear sits behind its center
const FOLLOW_RAMP = 4.0;     // distance to start slowing to keep the gap
const LANE_DETECT = 0.6;     // lateral tolerance for "same lane" (half a lane)

interface SharedCar {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

// Spawn/despawn lifecycle for foot traffic — no wrapping teleports.
const FADE_OUT = 0.25;
const FADE_IN = 0.35;
const RESPAWN_MIN = 1.2;
const RESPAWN_MAX = 3.0;
// Cars grow in over this long after spawning, so they never "pop" into view.
const CAR_FADE = 0.6;

type MoverState = "drive" | "fadeOut" | "idle" | "fadeIn";

function smooth(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

type Kind = "runner" | "walker";

interface CarSpec {
  color: string;
  size: number;
  speed: number;
  // The lane the car holds: ±1. Combined with its direction of travel this keeps
  // it on a fixed side of the centerline, so opposing traffic runs side-by-side
  // instead of sharing the same line.
  lane: 1 | -1;
}

interface TrafficSpec {
  street: Street;
  kind: Kind;
  color: string;
  size: number;
  speed: number;
  dir: 1 | -1;
  lane: number;
}

function useCarSpecs(): CarSpec[] {
  return useMemo(() => {
    const rand = mulberry32(777);
    return Array.from({ length: traffic.cars }, (_, i) => ({
      color: CAR_COLORS[i % CAR_COLORS.length],
      size: CAR_SIZE,
      speed: 2.4 + rand() * 1.6,
      // Steady lane assignment: half the cars take each side.
      lane: i % 2 === 0 ? 1 : -1,
    }));
  }, []);
}

function useTrafficSpecs(streets: Street[]): TrafficSpec[] {
  return useMemo(() => {
    if (streets.length === 0) return [];
    const rand = mulberry32(777);
    const horizontals = streets.filter((s) => s.width >= s.depth);

    const runners: TrafficSpec[] = Array.from({ length: traffic.runners }, (_, i) => {
      const street = streets[(i * 7) % streets.length]!;
      const horizontal = street.width >= street.depth;
      const edge = horizontal ? street.depth / 2 + SIDEWALK_CENTER : street.width / 2 + SIDEWALK_CENTER;
      return {
        street,
        kind: "runner",
        color: RUNNER_COLORS[i % RUNNER_COLORS.length],
        size: 0.15,
        speed: 1.6 + rand() * 0.8,
        dir: i % 2 === 0 ? 1 : -1,
        lane: i % 2 === 0 ? edge : -edge,
      };
    });

    // People walking between houses on the brick sidewalks (guaranteed-clear path).
    const walkers: TrafficSpec[] = Array.from({ length: traffic.walkers }, (_, i) => {
      const street = streets[(i * 5) % streets.length]!;
      const horizontal = street.width >= street.depth;
      const edge = horizontal ? street.depth / 2 + SIDEWALK_CENTER : street.width / 2 + SIDEWALK_CENTER;
      return {
        street,
        kind: "walker",
        color: WALKER_COLORS[i % WALKER_COLORS.length],
        size: 0.15,
        speed: 0.9 + rand() * 0.4,
        dir: i % 2 === 0 ? 1 : -1,
        lane: i % 2 === 0 ? edge : -edge,
      };
    });

    return [...runners, ...walkers];
  }, [streets]);
}

interface Puff {
  active: boolean;
  age: number;
  life: number;
  ox: number;
  oz: number;
}

// Random smoke puffs that trail behind a moving car, oriented along its heading.
function VehicleSmoke({
  carRef,
  headingRef,
  enabledRef,
}: {
  carRef: { current: Group | null };
  headingRef: { current: { x: number; z: number } };
  enabledRef: { current: boolean };
}) {
  const puffs = useRef<Puff[]>(
    Array.from({ length: PUFF_COUNT }, () => ({ active: false, age: 0, life: 0, ox: 0, oz: 0 })),
  );
  const refs = useRef<(Group | null)[]>([]);
  const emitIn = useRef(0);

  useFrame((_, delta) => {
    const car = carRef.current;
    if (!car) return;
    emitIn.current -= delta;

    if (enabledRef.current) {
      const idle = puffs.current.find((p) => !p.active);
      if (emitIn.current <= 0 && idle) {
        idle.active = true;
        idle.age = 0;
        idle.life = 0.5 + Math.random() * 0.5;
        idle.ox = -headingRef.current.x * 0.5;
        idle.oz = -headingRef.current.z * 0.5;
        emitIn.current = 0.5 + Math.random() * 1.0;
      }
    }

    for (let i = 0; i < puffs.current.length; i++) {
      const p = puffs.current[i];
      const g = refs.current[i];
      if (!g) continue;
      if (!p.active) {
        g.visible = false;
        continue;
      }
      p.age += delta;
      if (p.age >= p.life) {
        p.active = false;
        g.visible = false;
        continue;
      }
      const h = headingRef.current;
      const t = p.age / p.life;
      const perpX = -h.z;
      const perpZ = h.x;
      const wobble = Math.sin(p.age * 3) * 0.15;
      const x = car.position.x + p.ox - h.x * t * 0.7 + perpX * wobble;
      const z = car.position.z + p.oz - h.z * t * 0.7 + perpZ * wobble;
      const y = car.position.y + 0.3 + t * 0.9;
      g.position.set(x, y, z);
      g.scale.setScalar(0.15 + t * 0.6);
      g.visible = true;
    }
  });

  return (
    <>
      {Array.from({ length: PUFF_COUNT }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
        >
          <InstancedVoxels voxels={PUFF_VOXELS} voxelSize={0.07} />
        </group>
      ))}
    </>
  );
}

// Shared fade lifecycle for foot traffic. Returns the scale to apply.
function stepLifecycle(
  state: { current: MoverState },
  stateT: { current: number },
  respawnIn: { current: number },
  delta: number,
): { scale: number; driving: boolean } {
  let scale = 1;
  let driving = false;
  if (state.current === "idle") {
    scale = 0;
    respawnIn.current -= delta;
    if (respawnIn.current <= 0) {
      state.current = "fadeIn";
      stateT.current = 0;
    }
  } else if (state.current === "fadeIn") {
    stateT.current += delta;
    scale = smooth(stateT.current / FADE_IN);
    if (stateT.current >= FADE_IN) {
      state.current = "drive";
      scale = 1;
    }
  } else if (state.current === "fadeOut") {
    stateT.current += delta;
    scale = 1 - smooth(stateT.current / FADE_OUT);
    if (stateT.current >= FADE_OUT) {
      state.current = "idle";
      respawnIn.current = RESPAWN_MIN + Math.random() * (RESPAWN_MAX - RESPAWN_MIN);
      scale = 0;
    }
  } else {
    driving = true;
  }
  return { scale, driving };
}

// Cars drive planned shortest-path routes across the road graph: pick a destination,
// follow the route node by node (braking at red lights), then choose a new one.
// `cars` is a shared registry of all car positions so each car can keep a gap to
// the car ahead in its lane (leader-following) instead of overlapping.
function WaypointCar({
  car,
  index,
  cars,
  graph,
  controller,
  curbs,
}: {
  car: CarSpec;
  index: number;
  cars: { current: SharedCar[] };
  graph: RoadGraph;
  controller: TrafficController;
  curbs: Curb[];
}) {
  const ref = useRef<Group>(null);
  const heading = useRef({ x: 1, z: 0 });
  const smokeOn = useRef(true);

  const route = useRef<number[]>([]);
  const routeIdx = useRef(0);
  const t = useRef(0);
  const speed = useRef(0);
  // The car's actual road-graph node, kept in sync as it crosses each node. Used
  // as the start of the next plan so a replan never teleports the car across the
  // map (the old code picked the stale last route node, or a random node after a
  // drop-off cleared the route).
  const currentNode = useRef<number>(Math.floor(Math.random() * graph.nodes.length));

  const curbByNode = useMemo(() => new Map(curbs.map((c) => [c.nodeId, c])), [curbs]);
  const curbNodeIds = useMemo(() => curbs.map((c) => c.nodeId), [curbs]);
  const dropOff = useRef(0);
  const dropOffCurb = useRef<Curb | null>(null);
  // Fades the car in on spawn so it doesn't "pop" into existence at a random
  // node. Runs once; after FADE_IN the car is full scale.
  const spawnT = useRef(0);

  const voxels = useMemo(() => carVoxels(car.color), [car.color]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;

    // Advance the spawn fade timer so the car grows in over FADE_OUT.
    spawnT.current += delta;

    // Drop-off idle at a building curb: sit still, then leave.
    if (dropOff.current > 0) {
      dropOff.current -= delta;
      speed.current = 0;
      if (dropOff.current <= 0) {
        if (dropOffCurb.current) bumpBuildingActivity(dropOffCurb.current.buildingId, "cars", -1);
        dropOffCurb.current = null;
        route.current = [];
      }
      return;
    }

    // Replan when we arrive at the end of the current route. Always start from
    // the car's actual node so the next leg is contiguous. planRoute can return a
    // single-node route when start === goal or no path exists — that has no
    // second node to drive to, so re-pick a destination until we get a real edge.
    if (route.current.length === 0 || routeIdx.current >= route.current.length) {
      let attempt = 0;
      do {
        const goal = pickDestination(curbNodeIds, graph.nodes.length, Math.random);
        route.current = planRoute(graph, currentNode.current, goal);
        attempt++;
      } while (route.current.length < 2 && attempt < 16);
      routeIdx.current = 1;
      t.current = 0;
      // Still no path this iteration: nothing to drive to, wait a frame.
      if (route.current.length < 2) return;
    }

    const a = graph.nodes[route.current[routeIdx.current - 1]];
    const b = graph.nodes[route.current[routeIdx.current]];
    const axis: "x" | "z" = a.x === b.x ? "z" : "x";
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;

    let v = speed.current;
    const remaining = (1 - t.current) * length;
    if (b.intersectionId !== null && !controller.greenFor(b.intersectionId, axis)) {
      if (remaining > STOP_CLEAR) {
        v = Math.max(0, Math.min(v, Math.sqrt(2 * CAR_BRAKE * (remaining - STOP_CLEAR))));
      } else {
        v = 0;
      }
    } else {
      v = Math.min(car.speed, v + CAR_ACCEL * delta);
    }

    // Leader-following: hold a gap to the nearest car ahead in the same lane
    // (same direction of travel on the same road line). No collision math — just
    // ease off when we're closing too fast, so cars never pass through each other.
    const hx = (b.x - a.x) / length;
    const hz = (b.z - a.z) / length;
    for (let j = 0; j < cars.current.length; j++) {
      if (j === index) continue;
      const o = cars.current[j]!;
      // Relative position projected onto my heading. Positive = ahead of me.
      const rx = o.x - (a.x + (b.x - a.x) * t.current);
      const rz = o.z - (a.z + (b.z - a.z) * t.current);
      const ahead = rx * hx + rz * hz;
      // Perpendicular offset from my lane line; side-by-side lanes are far apart.
      const lateral = Math.abs(rx * hz - rz * hx);
      // Same direction of travel (dot of headings) and same lane → a follower.
      const sameDir = o.dx * hx + o.dz * hz > 0.5;
      if (!sameDir || lateral > LANE_DETECT || ahead <= TAIL) continue;
      const gap = ahead - TAIL;
      if (gap < MIN_GAP) {
        v = 0;
        break;
      } else if (gap < MIN_GAP + FOLLOW_RAMP) {
        // A safe closing speed that reaches 0 exactly at MIN_GAP.
        v = Math.min(v, Math.sqrt(2 * CAR_BRAKE * (gap - MIN_GAP)));
      }
    }

    t.current += (v * delta) / length;
    if (t.current >= 1) {
      routeIdx.current += 1;
      t.current -= 1;
      // A fast car on a short segment can overshoot more than one node; clamp so
      // the position interpolator never extrapolates beyond the segment.
      t.current = Math.min(t.current, 0.999);
      // We just arrived at node b of the current segment — track it so the next
      // plan starts here (no teleport).
      currentNode.current = b.id;
      if (routeIdx.current >= route.current.length) {
        const lastId = route.current[route.current.length - 1];
        const curb = curbByNode.get(lastId);
        if (curb) {
          dropOff.current = 2 + Math.random() * 2;
          dropOffCurb.current = curb;
          bumpBuildingActivity(curb.buildingId, "cars", 1);
        }
      }
    }
    speed.current = v;

    const x = a.x + (b.x - a.x) * t.current;
    const z = a.z + (b.z - a.z) * t.current;
    const len = length || 1;
    heading.current = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };

    // Lane offset, perpendicular to travel. Each car keeps its own lane side, so
    // on any given road opposing traffic runs in a tight parallel pair.
    let px = x;
    let pz = z;
    if (axis === "x") pz += car.lane * LANE_OFFSET;
    else px += car.lane * LANE_OFFSET;

    g.position.set(px, 0, pz);
    // Publish this frame's position + heading so other cars can keep lane gaps.
    cars.current[index] = { x: px, z: pz, dx: hx, dz: hz };

    // Rotate the car to face its travel direction. In three.js (y-up), R_y maps
    // local +x to (cosθ, 0, -sinθ), and the car's long axis is local x. So to
    // point at (dx, dz) we need θ where cosθ = dx and -sinθ = dz, i.e.
    // θ = atan2(-dz, dx). The naive atan2(dz, dx) left cars side-on (~90° off)
    // on north-south segments.
    g.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);

    // Fade the car in on spawn (smooth 0→1) so it never pops into existence at
    // a road node. Opaque voxel, so scale doubles as the fade.
    const fade = smooth(spawnT.current / CAR_FADE);
    g.scale.setScalar(Math.max(0.0001, fade));
    smokeOn.current = v > 0.5;
  });

  return (
    <>
      <group ref={ref}>
        <InstancedVoxels voxels={voxels} voxelSize={car.size} />
      </group>
      <VehicleSmoke carRef={ref} headingRef={heading} enabledRef={smokeOn} />
    </>
  );
}

function FootMover({ spec }: { spec: TrafficSpec }) {
  const ref = useRef<Group>(null);
  const pos = useRef((Math.random() - 0.5) * (spec.street.width - 2));
  // Start fading IN so the person grows in at the sidewalk instead of popping.
  const state = useRef<MoverState>("fadeIn");
  const stateT = useRef(0);
  const respawnIn = useRef(0);

  const horizontal = spec.street.width >= spec.street.depth;
  const length = horizontal ? spec.street.width : spec.street.depth;
  const startPos = spec.dir === 1 ? -length / 2 : length / 2;
  const endPos = spec.dir === 1 ? length / 2 : -length / 2;

  const voxels = useMemo(() => personVoxels(spec.color), [spec.color]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const { scale, driving } = stepLifecycle(state, stateT, respawnIn, delta);

    if (state.current === "fadeIn") {
      pos.current = startPos;
    } else if (driving) {
      pos.current += spec.speed * spec.dir * delta;
      const reachedEnd =
        (spec.dir === 1 && pos.current >= endPos - END_MARGIN) ||
        (spec.dir === -1 && pos.current <= endPos + END_MARGIN);
      if (reachedEnd) {
        state.current = "fadeOut";
        stateT.current = 0;
      }
    }

    g.scale.setScalar(scale);
    if (horizontal) {
      g.position.x = spec.street.x + pos.current;
      g.position.z = spec.street.z + spec.lane;
      g.rotation.y = spec.dir > 0 ? 0 : Math.PI;
    } else {
      g.position.z = spec.street.z + pos.current;
      g.position.x = spec.street.x + spec.lane;
      g.rotation.y = spec.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  });

  return (
    <group ref={ref}>
      <InstancedVoxels voxels={voxels} voxelSize={spec.size} />
    </group>
  );
}

const VISIT_LINGER = 3.5;

interface VisitorSpec {
  path: VisitorPath;
  building: BuildingKind;
  color: string;
  speed: number;
}

function segLen(points: { x: number; z: number }[], i: number): number {
  const a = points[Math.max(0, Math.min(points.length - 1, i))];
  const b = points[Math.max(0, Math.min(points.length - 1, i + 1))];
  return Math.hypot(b.x - a.x, b.z - a.z) || 1;
}

// A person walking a VisitorPath: start → sidewalk → entrance, lingers at the
// entrance, then walks back and despawns (same fade lifecycle as foot traffic).
function VisitorMover({ spec }: { spec: VisitorSpec }) {
  const ref = useRef<Group>(null);
  const points = useMemo<{ x: number; z: number }[]>(
    () => [spec.path.from, ...spec.path.waypoints],
    [spec.path],
  );
  const seg = useRef(0);
  const t = useRef(0);
  const linger = useRef(0);
  const reverse = useRef(false);
  // Start fading IN so the visitor grows in at the start point instead of popping.
  const state = useRef<MoverState>("fadeIn");
  const stateT = useRef(0);
  const respawnIn = useRef(0);
  const entered = useRef(false);

  const voxels = useMemo(() => personVoxels(spec.color), [spec.color]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const { scale, driving } = stepLifecycle(state, stateT, respawnIn, delta);

    if (driving) {
      if (reverse.current) {
        t.current -= (spec.speed * delta) / segLen(points, seg.current);
        if (t.current <= 0) {
          seg.current -= 1;
          t.current = 1;
          if (seg.current < 0) {
            state.current = "fadeOut";
            stateT.current = 0;
            seg.current = 0;
            t.current = 0;
            reverse.current = false;
          }
        }
      } else if (linger.current > 0) {
        linger.current -= delta;
        if (linger.current <= 0) {
          reverse.current = true;
          bumpBuildingActivity(spec.building, "visitors", -1);
        }
      } else {
        t.current += (spec.speed * delta) / segLen(points, seg.current);
        if (t.current >= 1) {
          seg.current += 1;
          t.current -= 1;
          if (seg.current >= points.length - 1) {
            seg.current = points.length - 1;
            t.current = 1;
            if (!entered.current) {
              entered.current = true;
              bumpBuildingActivity(spec.building, "visitors", 1);
            }
            linger.current = VISIT_LINGER + Math.random();
          }
        }
      }
    }

    const a = points[Math.max(0, Math.min(points.length - 1, seg.current))];
    const b = points[Math.max(0, Math.min(points.length - 1, seg.current + (reverse.current ? -1 : 1)))];
    if (!a) return;
    const nx = (b?.x ?? a.x) - a.x;
    const nz = (b?.z ?? a.z) - a.z;
    const cx = a.x + nx * t.current;
    const cz = a.z + nz * t.current;
    g.position.set(cx, 0, cz);
    g.rotation.y = Math.atan2(nz, nx);
    g.scale.setScalar(scale);
  });

  return (
    <group ref={ref}>
      <InstancedVoxels voxels={voxels} voxelSize={0.15} />
    </group>
  );
}

export function Traffic({
  streets,
  intersections,
  controller,
  graph,
  curbs = [],
  visitorPaths = [],
  visitorBuildings = [],
}: {
  streets: Street[];
  intersections: Intersection[];
  controller: TrafficController;
  graph: RoadGraph;
  curbs?: Curb[];
  visitorPaths?: VisitorPath[];
  visitorBuildings?: BuildingKind[];
}) {
  const specs = useTrafficSpecs(streets);
  const cars = useCarSpecs();
  // Shared registry of live car positions so WaypointCar can keep lane gaps.
  const carPositions = useRef<SharedCar[]>(
    Array.from({ length: cars.length }, () => ({ x: 0, z: 0, dx: 1, dz: 0 })),
  );
  const visitorSpecs = useMemo(() => {
    if (visitorPaths.length === 0) return [];
    const rand = mulberry32(999);
    const colors = ["#ffb3ba", "#bae1ff", "#baffc9", "#ffffba", "#d4baff", "#ffd1dc"];
    return Array.from({ length: traffic.visitors }, (_, i) => ({
      path: visitorPaths[i % visitorPaths.length],
      building: visitorBuildings[i % visitorBuildings.length],
      color: colors[i % colors.length],
      speed: 0.8 + rand() * 0.5,
    }));
  }, [visitorPaths, visitorBuildings]);

  const showTraffic = useApp((s) => s.tweaks.showTraffic);
  if (!showTraffic) return null;

  return (
    <group>
      <TrafficLights controller={controller} intersections={intersections} streets={streets} />
      {cars.map((car, i) => (
        <WaypointCar key={i} car={car} index={i} cars={carPositions} graph={graph} controller={controller} curbs={curbs} />
      ))}
      {specs.map((spec, i) => (
        <FootMover key={`f${i}`} spec={spec} />
      ))}
      {visitorSpecs.map((spec, i) => (
        <VisitorMover key={`v${i}`} spec={spec} />
      ))}
    </group>
  );
}