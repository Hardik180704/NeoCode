import { describe, expect, test } from "bun:test";
import { extractTypeScriptImports, resolveImportPath } from "./graph";

describe("TypeScript dependency graph", () => {
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
});
