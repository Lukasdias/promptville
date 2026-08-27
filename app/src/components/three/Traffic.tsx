import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Street } from "../../layout";
import { traffic } from "../../config";
import type { Intersection, TrafficController } from "../../traffic";
import { carVoxels, personVoxels, type Voxel } from "../../voxel";
import { InstancedVoxels } from "./InstancedVoxels";
import { TrafficLights } from "./TrafficLights";

const CAR_COLORS = ["#ff8fa3", "#ffd166", "#7fb6ff", "#b0f2b4", "#ffa86b"];
const RUNNER_COLORS = ["#ffb3ba", "#bae1ff", "#baffc9", "#ffffba", "#d4baff", "#ffd1dc"];

const CAR_SIZE = 0.2;
const PUFF_VOXELS: Voxel[] = [{ x: 0, y: 0, z: 0, color: "#dcdcdc" }];
const PUFF_COUNT = 4;

const CAR_ACCEL = 3.5;
const CAR_BRAKE = 7;
const STOP_CLEAR = 0.18;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TrafficSpec {
  street: Street;
  kind: "car" | "runner";
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

    return [...cars, ...runners];
  }, [streets]);
}

interface Puff {
  active: boolean;
  age: number;
  life: number;
  ox: number;
  oz: number;
}

// Random smoke puffs that trail behind a moving car (world space).
function VehicleSmoke({
  carRef,
  dir,
  axis,
}: {
  carRef: { current: Group | null };
  dir: 1 | -1;
  axis: "x" | "z";
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

    const idle = puffs.current.find((p) => !p.active);
    if (emitIn.current <= 0 && idle) {
      idle.active = true;
      idle.age = 0;
      idle.life = 0.5 + Math.random() * 0.5;
      idle.ox = axis === "x" ? -dir * 0.5 : 0;
      idle.oz = axis === "z" ? -dir * 0.5 : 0;
      emitIn.current = 0.5 + Math.random() * 1.0;
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
      const t = p.age / p.life;
      const back = axis === "x" ? -dir : 0;
      const sideways = axis === "z" ? -dir : 0;
      const wobble = Math.sin(p.age * 3) * 0.15;
      const x = car.position.x + p.ox + back * t * 0.7 + (axis === "z" ? wobble : 0);
      const z = car.position.z + p.oz + sideways * t * 0.7 + (axis === "x" ? wobble : 0);
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

function CarMover({
  spec,
  controller,
  lights,
}: {
  spec: TrafficSpec;
  controller: TrafficController;
  lights: { x: number; id: number }[];
}) {
  const ref = useRef<Group>(null);
  const pos = useRef((Math.random() - 0.5) * (spec.street.width - 2));
  const speed = useRef(0);
  const horizontal = spec.street.width >= spec.street.depth;
  const length = horizontal ? spec.street.width : spec.street.depth;

  const voxels = useMemo(() => carVoxels(spec.color), [spec.color]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const dir = spec.dir;

    const next = lights.find((l) => (l.x - pos.current) * dir > 0.05);
    let v = speed.current;
    if (next && !controller.greenFor(next.id, "x")) {
      const dist = (next.x - pos.current) * dir;
      if (dist > STOP_CLEAR) {
        v = Math.max(0, Math.min(v, Math.sqrt(2 * CAR_BRAKE * (dist - STOP_CLEAR))));
      } else {
        v = 0;
      }
    } else {
      v = Math.min(spec.speed, v + CAR_ACCEL * delta);
    }

    pos.current += v * dir * delta;
    if (pos.current > length / 2) pos.current -= length;
    if (pos.current < -length / 2) pos.current += length;
    speed.current = v;

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
    <>
      <group ref={ref}>
        <InstancedVoxels voxels={voxels} voxelSize={spec.size} />
      </group>
      <VehicleSmoke carRef={ref} dir={spec.dir} axis={horizontal ? "x" : "z"} />
    </>
  );
}

function RunnerMover({ spec }: { spec: TrafficSpec }) {
  const ref = useRef<Group>(null);
  const t = useRef(Math.random() * 100);
  const horizontal = spec.street.width >= spec.street.depth;
  const length = horizontal ? spec.street.width : spec.street.depth;
  const voxels = useMemo(() => personVoxels(spec.color), [spec.color]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    t.current += delta * spec.speed * spec.dir;
    const pos = ((t.current % length) + length) % length - length / 2;
    if (horizontal) {
      g.position.x = spec.street.x + pos;
      g.position.z = spec.street.z + spec.lane;
      g.rotation.y = spec.dir > 0 ? 0 : Math.PI;
    } else {
      g.position.z = spec.street.z + pos;
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
}: {
  streets: Street[];
  intersections: Intersection[];
  controller: TrafficController;
}) {
  const specs = useTrafficSpecs(streets);

  const lightsByStreet = useMemo(() => {
    const map = new Map<number, { x: number; id: number }[]>();
    for (const spec of specs) {
      if (spec.kind !== "car") continue;
      const horizontal = spec.street.width >= spec.street.depth;
      const onStreet = intersections.filter((it) =>
        horizontal ? Math.abs(it.z - spec.street.z) < 0.01 : Math.abs(it.x - spec.street.x) < 0.01,
      );
      map.set(
        spec.street.x * 1000 + spec.street.z,
        onStreet
          .map((it) => ({ x: it.x, id: it.id }))
          .sort((a, b) => a.x - b.x),
      );
    }
    return map;
  }, [specs, intersections]);

  return (
    <group>
      <TrafficLights controller={controller} intersections={intersections} />
      {specs.map((spec, i) =>
        spec.kind === "car" ? (
          <CarMover
            key={i}
            spec={spec}
            controller={controller}
            lights={lightsByStreet.get(spec.street.x * 1000 + spec.street.z) ?? []}
          />
        ) : (
          <RunnerMover key={i} spec={spec} />
        ),
      )}
    </group>
  );
}