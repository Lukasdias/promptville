import { describe, expect, test } from "bun:test";
import {
  layoutCity,
  buildStreets,
  houseScale,
  HOUSE_SPACING,
  HOUSE_PAD,
  ROAD_WIDTH,
  CIVIC_PLAZA,
  CELL_PITCH,
  HOUSE_COLS,
  spiralCell,
  rankProjects,
} from "./layout";

describe("layoutCity", () => {
  const s = (id: string, timeCreated: number) => ({ id, tokensIn: 10, tokensOut: 5, timeCreated });
  const projects = [
    { id: "a", name: "A", sessions: [s("s1", 1), s("s2", 2)] },
    { id: "b", name: "B", sessions: Array.from({ length: 20 }, (_, i) => s(`b${i}`, i)) },
    { id: "c", name: "C", sessions: [s("c1", 1), s("c2", 2), s("c3", 3)] },
  ];

  test("places the plaza at the origin first", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    const plaza = blocks[0]!;
    expect(plaza.kind).toBe("plaza");
    expect(plaza.x).toBe(0);
    expect(plaza.z).toBe(0);
    expect(plaza.houses).toHaveLength(0);
  });

  test("project blocks are in ranked order (by session count)", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    expect(blocks.map((b) => b.projectId)).toEqual(["b", "c", "a"]);
  });

  test("rank 0 sits north of the plaza, rank 1 east, rank 2 south", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    expect(blocks[0]!.z).toBeLessThan(0);
    expect(Math.abs(blocks[0]!.x)).toBeLessThan(CELL_PITCH / 2);
    expect(blocks[1]!.x).toBeGreaterThan(0);
    expect(Math.abs(blocks[1]!.z)).toBeLessThan(CELL_PITCH / 2);
    expect(blocks[2]!.z).toBeGreaterThan(0);
    expect(Math.abs(blocks[2]!.x)).toBeLessThan(CELL_PITCH / 2);
  });

  test("cardinal blocks sit CELL_PITCH from the plaza center", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    for (const b of blocks.slice(0, 3)) {
      expect(Math.hypot(b.x, b.z)).toBeCloseTo(CELL_PITCH);
    }
  });

  test("every house lands inside its block bounds and uses fixed columns", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    const bBlock = blocks.find((b) => b.projectId === "b")!;
    expect(bBlock.houses).toHaveLength(20);
    for (const b of blocks) {
      for (const h of b.houses) {
        expect(h.x).toBeGreaterThanOrEqual(b.x - b.width / 2);
        expect(h.x).toBeLessThanOrEqual(b.x + b.width / 2);
        expect(h.z).toBeGreaterThanOrEqual(b.z - b.depth / 2);
        expect(h.z).toBeLessThanOrEqual(b.z + b.depth / 2);
        const left = b.x - b.width / 2 + HOUSE_PAD + HOUSE_SPACING / 2;
        expect(Math.round((h.x - left) / HOUSE_SPACING)).toBe(h.index % HOUSE_COLS);
      }
    }
  });

  test("appending a session to the top project moves no other block", () => {
    const before = layoutCity(projects, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    const grown = [
      { ...projects[1]!, sessions: [...projects[1]!.sessions, s("b20", 20)] },
      projects[0]!,
      projects[2]!,
    ];
    const after = layoutCity(grown, { plaza: CIVIC_PLAZA }).filter((b) => b.kind !== "plaza");
    for (const b of after) {
      const prev = before.find((p) => p.projectId === b.projectId)!;
      expect(b.x).toBe(prev.x);
      expect(b.z).toBe(prev.z);
      expect(b.width).toBe(prev.width);
      expect(b.depth).toBe(prev.depth);
    }
    const grownBlock = after.find((b) => b.projectId === "b")!;
    const prevBlock = before.find((b) => b.projectId === "b")!;
    expect(grownBlock.houses.length).toBe(prevBlock.houses.length + 1);
    for (let i = 0; i < prevBlock.houses.length; i++) {
      expect(grownBlock.houses[i]!.x).toBe(prevBlock.houses[i]!.x);
      expect(grownBlock.houses[i]!.z).toBe(prevBlock.houses[i]!.z);
    }
  });
});

describe("buildStreets", () => {
  const s = (id: string, timeCreated: number) => ({ id, tokensIn: 10, tokensOut: 5, timeCreated });
  const projects = [
    { id: "a", name: "A", sessions: [s("s1", 1)] },
    { id: "b", name: "B", sessions: [s("s2", 1)] },
    { id: "c", name: "C", sessions: [s("s3", 1)] },
    { id: "d", name: "D", sessions: [s("s4", 1)] },
  ];

  test("the plaza is surrounded by four streets", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    const streets = buildStreets(blocks);
    const near = streets.filter(
      (st) => Math.abs(st.x) <= CELL_PITCH && Math.abs(st.z) <= CELL_PITCH,
    );
    expect(near.length).toBeGreaterThanOrEqual(4);
  });

  test("no street overlaps a block", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    const streets = buildStreets(blocks);
    const eps = 0.001;
    for (const s2 of streets) {
      for (const b of blocks) {
        const overlap =
          s2.x + s2.width / 2 > b.x - b.width / 2 + eps &&
          s2.x - s2.width / 2 < b.x + b.width / 2 - eps &&
          s2.z + s2.depth / 2 > b.z - b.depth / 2 + eps &&
          s2.z - s2.depth / 2 < b.z + b.depth / 2 - eps;
        expect(overlap).toBe(false);
      }
    }
  });

  test("all streets lie within the city bounds", () => {
    const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
    const streets = buildStreets(blocks);
    const minX = Math.min(...blocks.map((b) => b.x - b.width / 2));
    const maxX = Math.max(...blocks.map((b) => b.x + b.width / 2));
    const minZ = Math.min(...blocks.map((b) => b.z - b.depth / 2));
    const maxZ = Math.max(...blocks.map((b) => b.z + b.depth / 2));
    for (const s2 of streets) {
      expect(s2.x - s2.width / 2).toBeGreaterThanOrEqual(minX);
      expect(s2.x + s2.width / 2).toBeLessThanOrEqual(maxX);
      expect(s2.z - s2.depth / 2).toBeGreaterThanOrEqual(minZ);
      expect(s2.z + s2.depth / 2).toBeLessThanOrEqual(maxZ);
    }
  });
});

describe("houseScale", () => {
  test("maps token counts logarithmically with clamp", () => {
    expect(houseScale(0, 0)).toBeCloseTo(1);
    expect(houseScale(100, 100)).toBeGreaterThan(1);
    expect(houseScale(1_000_000, 1_000_000)).toBeLessThanOrEqual(6);
  });
});

describe("spiralCell", () => {
  test("first four ranks are the cardinal lanes N,E,S,W", () => {
    expect(spiralCell(0)).toEqual({ cx: 0, cz: -1 }); // N
    expect(spiralCell(1)).toEqual({ cx: 1, cz: 0 });  // E
    expect(spiralCell(2)).toEqual({ cx: 0, cz: 1 });  // S
    expect(spiralCell(3)).toEqual({ cx: -1, cz: 0 }); // W
  });

  test("ranks 4-7 are the diagonal corners", () => {
    expect(spiralCell(4)).toEqual({ cx: 1, cz: -1 }); // NE
    expect(spiralCell(5)).toEqual({ cx: 1, cz: 1 });  // SE
    expect(spiralCell(6)).toEqual({ cx: -1, cz: 1 }); // SW
    expect(spiralCell(7)).toEqual({ cx: -1, cz: -1 }); // NW
  });

  test("ranks 8+ are unique ring-2 cells", () => {
    const cells = Array.from({ length: 40 }, (_, i) => spiralCell(i));
    const keys = new Set(cells.map((c) => `${c.cx}:${c.cz}`));
    expect(keys.size).toBe(40);
    for (let i = 8; i < 40; i++) {
      expect(Math.max(Math.abs(cells[i]!.cx), Math.abs(cells[i]!.cz))).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("rankProjects", () => {
  const s = (id: string, timeCreated: number) => ({ id, tokensIn: 1, tokensOut: 1, timeCreated });
  const projects = [
    { id: "a", name: "A", sessions: [s("s1", 2), s("s2", 5)] },
    { id: "b", name: "B", sessions: [s("s3", 9)] },
    { id: "c", name: "C", sessions: [s("s4", 4), s("s5", 1), s("s6", 3)] },
  ];

  test("sorts by session count desc, then recency desc", () => {
    expect(rankProjects(projects).map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  test("ties on count and recency break by name asc", () => {
    const t = (id: string, name: string) => ({ id, name, sessions: [s("x", 1)] });
    expect(rankProjects([t("2", "beta"), t("1", "alpha")]).map((p) => p.id)).toEqual(["1", "2"]);
  });

  test("does not mutate the input array", () => {
    const before = projects.map((p) => p.id);
    rankProjects(projects);
    expect(projects.map((p) => p.id)).toEqual(before);
  });
});