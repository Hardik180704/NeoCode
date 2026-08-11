import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildWorkspaceIndex,
  readWorkspaceFile,
  searchWorkspace,
} from "./neolens-workspace";

async function withWorkspace(run: (cwd: string) => Promise<void>) {
  const cwd = await mkdtemp(join(tmpdir(), "neolens-workspace-"));
  try {
    await run(cwd);
  } finally {
    await rm(cwd, { recursive: true });
  }
}

describe("NeoLens workspace explorer", () => {
  test("indexes source files while respecting built-in and git ignores", async () => {
    await withWorkspace(async (cwd) => {
      await mkdir(join(cwd, "src"));
      await mkdir(join(cwd, "node_modules", "package"), { recursive: true });
      await mkdir(join(cwd, "generated"));
      await writeFile(join(cwd, ".gitignore"), "generated/\n*.log\n");
      await writeFile(join(cwd, "src", "index.ts"), "export const value = 1;\n");
      await writeFile(join(cwd, "debug.log"), "ignored\n");
      await writeFile(join(cwd, "generated", "api.ts"), "ignored\n");
      await writeFile(join(cwd, "node_modules", "package", "index.js"), "ignored\n");
      await writeFile(join(cwd, ".env.local"), "SECRET=value\n");

      const index = await buildWorkspaceIndex(cwd);

      expect(index.files).toEqual(["src/index.ts", ".gitignore"]);
      expect(index.ignoredCount).toBeGreaterThanOrEqual(4);
      expect(index.truncated).toBeFalse();
    });
  });

  test("reads text locally and rejects traversal, secrets, binaries, and symlinks", async () => {
    await withWorkspace(async (cwd) => {
      await mkdir(join(cwd, "src"));
      await writeFile(join(cwd, "src", "app.ts"), "export const app = true;\n");
      await writeFile(join(cwd, ".env"), "SECRET=value\n");
      await writeFile(join(cwd, "image.bin"), new Uint8Array([0, 1, 2]));
      await symlink(join(cwd, "src", "app.ts"), join(cwd, "linked.ts"));

      await expect(readWorkspaceFile(cwd, "src/app.ts")).resolves.toMatchObject({
        language: "typescript",
        content: "export const app = true;\n",
      });
      await expect(readWorkspaceFile(cwd, "../outside.ts")).rejects.toThrow("outside");
      await expect(readWorkspaceFile(cwd, ".env")).rejects.toThrow("sensitive");
      await expect(readWorkspaceFile(cwd, "image.bin")).rejects.toThrow("Binary");
      await expect(readWorkspaceFile(cwd, "linked.ts")).rejects.toThrow("symbolic links");
    });
  });

  test("searches file paths and contents with line locations", async () => {
    await withWorkspace(async (cwd) => {
      await mkdir(join(cwd, "src"));
      await writeFile(join(cwd, "src", "auth.ts"), "const token = createToken();\nexport { token };\n");
      await writeFile(join(cwd, "src", "index.ts"), "export * from './auth';\n");
      const index = await buildWorkspaceIndex(cwd);

      const content = await searchWorkspace(cwd, index.files, "createToken");
      expect(content.matches).toContainEqual({
        path: "src/auth.ts",
        line: 1,
        column: 15,
        preview: "const token = createToken();",
        kind: "content",
      });

      const path = await searchWorkspace(cwd, index.files, "auth");
      expect(path.matches.some((match) => match.path === "src/auth.ts" && match.kind === "path")).toBeTrue();
    });
  });

  test("caps previews without loading an entire large file into the result", async () => {
    await withWorkspace(async (cwd) => {
      await writeFile(join(cwd, "large.txt"), Buffer.alloc(600_000, "a"));

      const preview = await readWorkspaceFile(cwd, "large.txt");

      expect(preview.bytes).toBe(600_000);
      expect(preview.content.length).toBe(512_000);
      expect(preview.truncated).toBeTrue();
    });
  });
});
