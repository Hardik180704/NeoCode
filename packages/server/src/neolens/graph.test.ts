import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTypeScriptDependencyGraph,
  assertSafeGraphRoot,
  extractTypeScriptImports,
  resolveImportPath,
} from "./graph";

describe("TypeScript dependency graph", () => {
  test("rejects broad user and filesystem roots", () => {
    expect(() => assertSafeGraphRoot(homedir())).toThrow("project directory");
    expect(() => assertSafeGraphRoot("/")).toThrow("project directory");
  });

  test("extracts static, dynamic, re-export, and CommonJS imports", () => {
    const imports = extractTypeScriptImports(`
      import type { User } from "./types";
      export { login } from './auth';
      const screen = import("./screen");
      const legacy = require('./legacy');
    `);
    expect(imports.toSorted()).toEqual([
      "./auth",
      "./legacy",
      "./screen",
      "./types",
    ]);
  });

  test("resolves extensionless and directory imports inside the graph", () => {
    const files = new Set([
      "src/auth.ts",
      "src/components/index.tsx",
      "src/session.ts",
    ]);
    expect(resolveImportPath("src/session.ts", "./auth", files)).toBe("src/auth.ts");
    expect(resolveImportPath("src/session.ts", "./components", files)).toBe(
      "src/components/index.tsx",
    );
    expect(resolveImportPath("src/session.ts", "../outside", files)).toBeNull();
    expect(resolveImportPath("src/session.ts", "react", files)).toBeNull();
  });

  test("builds the dependency graph from the CLI-visible working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "neolens-graph-"));
    try {
      await mkdir(join(cwd, "src"));
      await mkdir(join(cwd, "node_modules", "ignored"), { recursive: true });
      await writeFile(join(cwd, "src", "index.ts"), 'import { value } from "./value";');
      await writeFile(join(cwd, "src", "value.ts"), "export const value = 1;");
      await writeFile(join(cwd, "node_modules", "ignored", "index.ts"), "export {};");

      const graph = await buildTypeScriptDependencyGraph(cwd);

      expect(graph.nodes.map((node) => node.id)).toEqual(["src/index.ts", "src/value.ts"]);
      expect(graph.edges).toEqual([
        { source: "src/index.ts", target: "src/value.ts", kind: "import" },
      ]);
      expect(graph.truncated).toBeFalse();
    } finally {
      await rm(cwd, { recursive: true });
    }
  });
});
