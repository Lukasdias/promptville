import { describe, expect, test } from "bun:test";
import { layoutCity, buildStreets } from "./layout";
import { TrafficController, findIntersections, pickDestination } from "./traffic";

const sessions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, tokensIn: 10, tokensOut: 5, timeCreated: i }));

const projects = [
  { id: "a", name: "A", sessions: sessions(8) },
  { id: "b", name: "B", sessions: sessions(8) },
  { id: "c", name: "C", sessions: sessions(8) },
  { id: "d", name: "D", sessions: sessions(8) },
  { id: "e", name: "E", sessions: sessions(8) },
  { id: "f", name: "F", sessions: sessions(8) },
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

  test("merges near-coincident junctions into a single intersection", () => {
    const avenue = { x: 0, z: 0, width: 40, depth: 3.5 };
    const v1 = { x: 5, z: 0, width: 3.5, depth: 12 };
    const v2 = { x: 6.2, z: 0, width: 3.5, depth: 12 };
    const merged = findIntersections([avenue, v1, v2]);
    expect(merged).toHaveLength(1);
    expect(merged[0].x).toBeCloseTo(5.6);

    const far = { x: 15, z: 0, width: 3.5, depth: 12 };
    const kept = findIntersections([avenue, v1, far]);
    expect(kept).toHaveLength(2);
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

describe("pickDestination", () => {
  test("prefers a curb node when the roll is below 0.6", () => {
    const curbs = [10, 20, 30];
    let calls = 0;
    const rand = () => (++calls === 1 ? 0.3 : 0.5);
    const d = pickDestination(curbs, 100, rand);
    expect(curbs).toContain(d);
  });

  test("falls back to a random node when the roll is >= 0.6", () => {
    const d = pickDestination([10], 100, () => 0.9);
    expect(d).not.toBe(10);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThan(100);
  });

  test("returns a random node when no curbs exist", () => {
    expect(pickDestination([], 50, () => 0.1)).toBeGreaterThanOrEqual(0);
  });
});