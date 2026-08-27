import { describe, expect, test } from "bun:test";
import { layoutCity, buildStreets } from "./layout";
import { TrafficController, findIntersections } from "./traffic";

const projects = [
  { id: "a", name: "A", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "b", name: "B", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "c", name: "C", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "d", name: "D", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "e", name: "E", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
  { id: "f", name: "F", sessions: Array.from({ length: 8 }, () => ({ tokensIn: 10, tokensOut: 5 })) },
];

describe("findIntersections", () => {
  const streets = buildStreets(layoutCity(projects));
  const intersections = findIntersections(streets);

  test("finds crossings between avenues and vertical streets", () => {
    expect(intersections.length).toBeGreaterThan(0);
    for (const it of intersections) {
      const h = streets.find((s) => s.width >= s.depth && Math.abs(s.z - it.z) < 0.01);
      const v = streets.find((s) => s.width < s.depth && Math.abs(s.x - it.x) < 0.01);
      expect(h).toBeDefined();
      expect(v).toBeDefined();
    }
  });

  test("intersections lie inside both streets", () => {
    const h = streets.find((s) => s.width >= s.depth)!;
    const v = streets.find((s) => s.width < s.depth)!;
    const it = intersections.find((i) => Math.abs(i.x - v.x) < 0.01 && Math.abs(i.z - h.z) < 0.01);
    expect(it).toBeDefined();
  });
});

describe("TrafficController", () => {
  test("starts with staggered green axes and flips after the phase elapses", () => {
    const controller = new TrafficController(
      [
        { id: 0, x: 0, z: 0 },
        { id: 1, x: 5, z: 0 },
      ],
      10,
      () => 0.5, // factor (0.7 + 0.3) = 1.0 → x phase 10s, z phase 5s
    );
    expect(controller.greenFor(0, "x")).toBe(true);
    expect(controller.greenFor(1, "z")).toBe(true);

    controller.tick(5);
    expect(controller.greenFor(0, "x")).toBe(true); // not elapsed yet

    controller.tick(5.1);
    expect(controller.greenFor(0, "x")).toBe(false);
    expect(controller.greenFor(0, "z")).toBe(true);
  });

  test("independent per-intersection phases", () => {
    const controller = new TrafficController(
      [
        { id: 0, x: 0, z: 0 },
        { id: 1, x: 5, z: 0 },
      ],
      10,
      () => 0.5,
    );
    controller.tick(19.5);
    // id 0: x→(10)z→(15)x, next 25 → x green
    expect(controller.greenFor(0, "x")).toBe(true);

    // single intersection: x(3s)→z(1.5s)→x… at t=4.0 it is in the z window
    const other = new TrafficController([{ id: 0, x: 0, z: 0 }], 3, () => 0.5);
    other.tick(4.0);
    expect(other.greenFor(0, "x")).toBe(false);
    expect(other.greenFor(0, "z")).toBe(true);
  });
});