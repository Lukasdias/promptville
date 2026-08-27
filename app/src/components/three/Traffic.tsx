import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Street } from "../../layout";
import { traffic } from "../../config";
import { useApp } from "../../store";
import type { Intersection, TrafficController } from "../../traffic";
import { planRoute, type RoadGraph } from "../../roadgraph";
import { carVoxels, personVoxels, type Voxel } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { TrafficLights } from "./TrafficLights";

const CAR_COLORS = ["#ff8fa3", "#ffd166", "#7fb6ff", "#b0f2b4", "#ffa86b"];
const RUNNER_COLORS = ["#ffb3ba", "#bae1ff", "#baffc9", "#ffffba", "#d4baff", "#ffd1dc"];
const WALKER_COLORS = ["#f0c4ff", "#e6ffba", "#c9f2ff", "#ffdfba"];

const CAR_SIZE = 0.2;
const PUFF_VOXELS: Voxel[] = [{ x: 0, y: 0, z: 0, color: "#dcdcdc" }];
const PUFF_COUNT = 4;

const CAR_ACCEL = 3.5;
const CAR_BRAKE = 7;
// Cars stop this far before the intersection center so they never sit on the
// traffic light or inside the crossing.
const STOP_CLEAR = 2.0;
const END_MARGIN = 0.4;

// Spawn/despawn lifecycle for foot traffic — no wrapping teleports.
const FADE_OUT = 0.25;
const FADE_IN = 0.35;
const RESPAWN_MIN = 1.2;
const RESPAWN_MAX = 3.0;

type MoverState = "drive" | "fadeOut" | "idle" | "fadeIn";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

type Kind = "runner" | "walker";

interface CarSpec {
  color: string;
  size: number;
  speed: number;
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
      return {
        street,
        kind: "runner",
        color: RUNNER_COLORS[i % RUNNER_COLORS.length],
        size: 0.15,
        speed: 1.6 + rand() * 0.8,
        dir: i % 2 === 0 ? 1 : -1,
        lane: i % 2 === 0 ? 0.5 : -0.5,
      };
    });

    // People walking between houses on the brick sidewalks (guaranteed-clear path).
    const walkers: TrafficSpec[] = Array.from({ length: traffic.walkers }, (_, i) => {
      const street = streets[(i * 5) % streets.length]!;
      const horizontal = street.width >= street.depth;
      const edge = horizontal ? street.depth / 2 + 0.35 : street.width / 2 + 0.35;
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
    if (respawnIn.current <= 0) state.current = "fadeIn";
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
function WaypointCar({
  car,
  graph,
  controller,
}: {
  car: CarSpec;
  graph: RoadGraph;
  controller: TrafficController;
}) {
  const ref = useRef<Group>(null);
  const heading = useRef({ x: 1, z: 0 });
  const smokeOn = useRef(true);

  const route = useRef<number[]>([]);
  const routeIdx = useRef(0);
  const t = useRef(0);
  const speed = useRef(0);

  const voxels = useMemo(() => carVoxels(car.color), [car.color]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;

    // Replan when we arrive at the end of the current route.
    if (route.current.length === 0 || routeIdx.current >= route.current.length) {
      const from = route.current.length > 0 ? route.current[route.current.length - 1] : Math.floor(Math.random() * graph.nodes.length);
      let goal = Math.floor(Math.random() * graph.nodes.length);
      while (goal === from) goal = Math.floor(Math.random() * graph.nodes.length);
      route.current = planRoute(graph, from, goal);
      routeIdx.current = 1;
      t.current = 0;
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

    t.current += (v * delta) / length;
    if (t.current >= 1) {
      routeIdx.current += 1;
      t.current -= 1;
    }
    speed.current = v;

    const x = a.x + (b.x - a.x) * t.current;
    const z = a.z + (b.z - a.z) * t.current;
    const len = length || 1;
    heading.current = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };

    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(b.z - a.z, b.x - a.x);
    g.scale.setScalar(1);
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
  const state = useRef<MoverState>("drive");
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

export function Traffic({
  streets,
  intersections,
  controller,
  graph,
}: {
  streets: Street[];
  intersections: Intersection[];
  controller: TrafficController;
  graph: RoadGraph;
}) {
  const specs = useTrafficSpecs(streets);
  const showTraffic = useApp((s) => s.tweaks.showTraffic);
  if (!showTraffic) return null;
  const cars = useCarSpecs();

  return (
    <group>
      <TrafficLights controller={controller} intersections={intersections} />
      {cars.map((car, i) => (
        <WaypointCar key={i} car={car} graph={graph} controller={controller} />
      ))}
      {specs.map((spec, i) => (
        <FootMover key={`f${i}`} spec={spec} />
      ))}
    </group>
  );
}