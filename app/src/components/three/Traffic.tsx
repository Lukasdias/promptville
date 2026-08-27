import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Street } from "../../layout";
import { traffic } from "../../config";
import type { Intersection, TrafficController } from "../../traffic";
import type { RoadGraph } from "../../roadgraph";
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
const STOP_CLEAR = 0.18;
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

type Kind = "car" | "runner" | "walker";

interface TrafficSpec {
  street: Street;
  kind: Kind;
  color: string;
  size: number;
  speed: number;
  dir: 1 | -1;
  lane: number;
}

function useTrafficSpecs(streets: Street[]): TrafficSpec[] {
  return useMemo(() => {
    if (streets.length === 0) return [];
    const rand = mulberry32(777);
    const horizontals = streets.filter((s) => s.width >= s.depth);

    const cars: TrafficSpec[] = Array.from({ length: traffic.cars }, (_, i) => {
      const street = (horizontals[i % horizontals.length] ?? streets[i % streets.length])!;
      return {
        street,
        kind: "car",
        color: CAR_COLORS[i % CAR_COLORS.length],
        size: CAR_SIZE,
        speed: 2.4 + rand() * 1.6,
        dir: i % 2 === 0 ? 1 : -1,
        lane: 0,
      };
    });

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

    return [...cars, ...runners, ...walkers];
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

// Cars drive the road graph forever: follow a directed edge, brake at red lights,
// and pick the next edge at each node (straight-through preferred, no U-turns).
function WaypointCar({
  spec,
  graph,
  controller,
}: {
  spec: TrafficSpec;
  graph: RoadGraph;
  controller: TrafficController;
}) {
  const ref = useRef<Group>(null);
  const heading = useRef({ x: 1, z: 0 });
  const smokeOn = useRef(true);

  const { edgeIdx, t, speed } = useMemo(() => {
    const startEdge = Math.floor(Math.random() * Math.max(1, graph.edges.length));
    return { edgeIdx: { current: startEdge }, t: { current: Math.random() }, speed: { current: 0 } };
  }, [graph]);

  const voxels = useMemo(() => carVoxels(spec.color), [spec.color]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const edge = graph.edges[edgeIdx.current];
    const a = graph.nodes[edge.from];
    const b = graph.nodes[edge.to];

    let v = speed.current;
    const remaining = (1 - t.current) * edge.length;
    const target = graph.nodes[edge.to];

    if (target.intersectionId !== null && !controller.greenFor(target.intersectionId, edge.axis)) {
      if (remaining > STOP_CLEAR) {
        v = Math.max(0, Math.min(v, Math.sqrt(2 * CAR_BRAKE * (remaining - STOP_CLEAR))));
      } else {
        v = 0;
      }
    } else {
      v = Math.min(spec.speed, v + CAR_ACCEL * delta);
    }

    t.current += (v * delta) / edge.length;
    if (t.current >= 1) {
      const at = b.id;
      const cameFrom = a.id;
      const candidates = graph.adjacency[at].filter((eid) => graph.edges[eid].to !== cameFrom);
      let next = candidates[0] ?? edge.id;
      if (candidates.length > 1) {
        const straight = candidates.filter((eid) => {
          const e = graph.edges[eid];
          if (e.axis !== edge.axis) return false;
          const other = graph.nodes[e.to];
          if (edge.axis === "x") return Math.sign(b.x - a.x) === Math.sign(other.x - b.x);
          return Math.sign(b.z - a.z) === Math.sign(other.z - b.z);
        });
        if (straight.length > 0 && Math.random() < 0.65) {
          next = straight[0];
        } else {
          next = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
      edgeIdx.current = next;
      t.current -= 1;
    }
    speed.current = v;

    const x = a.x + (b.x - a.x) * t.current;
    const z = a.z + (b.z - a.z) * t.current;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    heading.current = { x: dx / len, z: dz / len };

    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(dz, dx);
    g.scale.setScalar(1);
    smokeOn.current = v > 0.5;
  });

  return (
    <>
      <group ref={ref}>
        <InstancedVoxels voxels={voxels} voxelSize={spec.size} />
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

  return (
    <group>
      <TrafficLights controller={controller} intersections={intersections} />
      {specs.map((spec, i) =>
        spec.kind === "car" ? (
          <WaypointCar key={i} spec={spec} graph={graph} controller={controller} />
        ) : (
          <FootMover key={i} spec={spec} />
        ),
      )}
    </group>
  );
}