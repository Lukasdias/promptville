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
  test("green → yellow → other axis green, with avenue signal colors", () => {
    const controller = new TrafficController([{ id: 0, x: 0, z: 0 }], 10, () => 0.5);
    // factor (0.7 + 0.3) = 1.0 → x green 10s, yellow 1.5s, z green 5s
    expect(controller.greenFor(0, "x")).toBe(true);
    expect(controller.signalColorFor(0)).toBe("green");

    controller.tick(5);
    expect(controller.signalColorFor(0)).toBe("green");

    controller.tick(5.1); // t=10.1 → x yellow
    expect(controller.greenFor(0, "x")).toBe(false);
    expect(controller.signalColorFor(0)).toBe("yellow");

    controller.tick(1.5); // t=11.6 → axis flips to z, avenue red
    expect(controller.signalColorFor(0)).toBe("red");
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
    // id 0: x→(10)y→(11.5)z→(16.5)y→(18)x, next 28 → x green
    expect(controller.greenFor(0, "x")).toBe(true);
    expect(controller.signalColorFor(0)).toBe("green");
    // id 1: z→(5)y→(6.5)x→(16.5)y→(18)z, next 23 → z green → avenue red
    expect(controller.greenFor(1, "z")).toBe(true);
    expect(controller.signalColorFor(1)).toBe("red");
  });
});