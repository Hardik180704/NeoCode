import { describe, expect, test } from "bun:test";
import {
  createNeoLensActivityTracker,
  extractFilePaths,
  isVerificationCommand,
} from "./activity";

describe("NeoLens activity tracking", () => {
  test("normalizes project paths and rejects paths outside the project", () => {
    expect(extractFilePaths("/repo", "readFile", {
      path: "src/index.ts",
      nested: { filePath: "/repo/src/app.tsx" },
      paths: ["../secret.ts", "/tmp/unrelated.ts"],
    })).toEqual(["src/app.tsx", "src/index.ts"]);
  });

  test("tracks modified files and verifies them with a project check", () => {
    const tracker = createNeoLensActivityTracker("/repo", Date.now());
    const modified = tracker.start({
      toolCallId: "edit-1",
      toolName: "editFile",
      args: { path: "src/auth.ts" },
    });
    expect(modified.status).toBe("modified");

    tracker.complete("edit-1", JSON.stringify({ success: true }));
    const verification = tracker.start({
      toolCallId: "test-1",
      toolName: "bash",
      args: { command: "bun test" },
    });
    expect(verification.filePaths).toEqual([]);
    expect(tracker.complete("test-1", JSON.stringify({ exitCode: 0 }))).toMatchObject({
      status: "verified",
      filePaths: ["src/auth.ts"],
    });
  });

  test("marks a failed tool result", () => {
    const tracker = createNeoLensActivityTracker("/repo", Date.now());
    tracker.start({
      toolCallId: "read-1",
      toolName: "readFile",
      args: { path: "src/missing.ts" },
    });
    expect(tracker.complete("read-1", JSON.stringify({ error: "not found" }))).toMatchObject({
      status: "failed",
      filePaths: ["src/missing.ts"],
    });
  });

  test("recognizes common verification commands", () => {
    expect(isVerificationCommand("bun run typecheck")).toBe(true);
    expect(isVerificationCommand("pnpm lint")).toBe(true);
    expect(isVerificationCommand("git status --short")).toBe(false);
  });
});
