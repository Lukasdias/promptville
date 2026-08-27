import { describe, expect, test } from "bun:test";
import { createHandler } from "../server/index";
import { makeFixture } from "./fixtures";

describe("createHandler", () => {
  test("returns neighborhood JSON for GET /api/neighborhood", async () => {
    const db = makeFixture();
    const handler = createHandler(() => db);
    const res = await handler(new Request("http://localhost/api/neighborhood"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects.length).toBeGreaterThan(0);
    expect(body.stats.totalSessions).toBe(4);
  });

  test("returns 404 for unknown paths", async () => {
    const handler = createHandler(() => makeFixture());
    const res = await handler(new Request("http://localhost/nope"));
    expect(res.status).toBe(404);
  });

  test("returns 500 with dbPath when the database cannot be opened", async () => {
    const handler = createHandler(() => {
      throw new Error("no such file");
    });
    const res = await handler(new Request("http://localhost/api/neighborhood"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.dbPath).toBeDefined();
  });
});