import { describe, expect, test } from "bun:test";
import { createHandler } from "../server/index";
import { sessionDetail } from "../server/db";
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

  test("neighborhood list carries navigation fields", async () => {
    const handler = createHandler(() => makeFixture());
    const res = await handler(new Request("http://localhost/api/neighborhood"));
    const body = await res.json();
    const s = body.projects[0].sessions[0];
    expect(typeof s.slug).toBe("string");
    expect(typeof s.directory).toBe("string");
    expect(typeof s.timeUpdated).toBe("number");
    expect(s.parentId).toBeNull();
  });

  test("GET /api/session/:id returns session with trimmed snippet", async () => {
    const handler = createHandler(() => makeFixture());
    const res = await handler(new Request("http://localhost/api/session/s1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("s1");
    expect(body.snippet).toBe("I want a a demo line for the snippet test");
  });

  test("GET /api/session/:id returns empty snippet when no text", async () => {
    const handler = createHandler(() => makeFixture());
    const res = await handler(new Request("http://localhost/api/session/s3"));
    expect(res.status).toBe(200);
    expect((await res.json()).snippet).toBe("");
  });

  test("sessionDetail returns null for unknown id", () => {
    expect(sessionDetail(makeFixture(), "nope")).toBeNull();
  });
});