import { describe, expect, test } from "bun:test";
import {
  toolNameFromPart,
  countByTool,
  countPartType,
  topToolNames,
} from "./parts";

describe("part data extraction", () => {
  const tool = JSON.stringify({ type: "tool", tool: "edit", state: {} });
  const toolBash = JSON.stringify({ type: "tool", tool: "bash", state: {} });
  const patch = JSON.stringify({ type: "patch", files: ["/a.ts"] });
  const text = JSON.stringify({ type: "text", text: "hi" });

  test("extracts the tool name from a tool part", () => {
    expect(toolNameFromPart(tool)).toBe("edit");
    expect(toolNameFromPart(text)).toBeNull();
    expect(toolNameFromPart("not-json")).toBeNull();
  });

  test("counts tools per session", () => {
    const rows = [
      { sessionId: "s1", data: tool },
      { sessionId: "s1", data: toolBash },
      { sessionId: "s1", data: tool },
      { sessionId: "s2", data: toolBash },
    ];
    expect(countByTool(rows, "s1")).toEqual({ edit: 2, bash: 1 });
    expect(countByTool(rows, "s2")).toEqual({ bash: 1 });
  });

  test("counts parts of a type per session", () => {
    const rows = [
      { sessionId: "s1", data: patch },
      { sessionId: "s1", data: patch },
      { sessionId: "s1", data: tool },
    ];
    expect(countPartType(rows, "s1", "patch")).toBe(2);
    expect(countPartType(rows, "s1", "tool")).toBe(1);
  });

  test("returns top tool names sorted by count then name", () => {
    const counts = { bash: 5, edit: 3, read: 3, grep: 1 };
    expect(topToolNames(counts)).toEqual(["bash", "edit", "read"]);
    expect(topToolNames(counts, 2)).toEqual(["bash", "edit"]);
  });
});
