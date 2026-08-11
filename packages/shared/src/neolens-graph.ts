import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, parse, posix, resolve } from "node:path";

const MAX_GRAPH_FILES = 500;
const MAX_SOURCE_BYTES = 1_000_000;
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const IGNORED_SEGMENTS = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

export type NeoLensFileNode = {
  id: string;
  kind: "file";
  path: string;
  label: string;
};

export type NeoLensExternalNode = {
  id: string;
  kind: "mcp";
  label: string;
  status: "disabled" | "connected" | "failed";
  transport: "stdio" | "http";
};

export type NeoLensGraphEdge = {
  source: string;
  target: string;
  kind: "import" | "mcp";
};

export type NeoLensGraph = {
  nodes: NeoLensFileNode[];
  edges: NeoLensGraphEdge[];
  truncated: boolean;
};

export async function buildTypeScriptDependencyGraph(cwd: string): Promise<NeoLensGraph> {
  assertSafeGraphRoot(cwd);
  const paths = await collectTypeScriptPaths(cwd);

  paths.sort();
  const truncated = paths.length > MAX_GRAPH_FILES;
  const includedPaths = paths.slice(0, MAX_GRAPH_FILES);
  const pathSet = new Set(includedPaths);
  const edges: NeoLensGraphEdge[] = [];

  await Promise.all(
    includedPaths.map(async (projectPath) => {
      try {
        const source = await readFile(resolve(cwd, projectPath), "utf8");
        if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) return;

        for (const specifier of extractTypeScriptImports(source)) {
          const target = resolveImportPath(projectPath, specifier, pathSet);
          if (!target) continue;
          edges.push({ source: projectPath, target, kind: "import" });
        }
      } catch {
        // Files can disappear during edits; refresh will reconcile the graph.
      }
    }),
  );

  edges.sort((left, right) =>
    left.source.localeCompare(right.source) || left.target.localeCompare(right.target),
  );

  return {
    nodes: includedPaths.map((path) => ({
      id: path,
      kind: "file" as const,
      path,
      label: path.split("/").at(-1) ?? path,
    })),
    edges: dedupeEdges(edges),
    truncated,
  };
}

export function assertSafeGraphRoot(cwd: string) {
  const resolved = resolve(cwd);
  if (resolved === resolve(homedir()) || resolved === parse(resolved).root) {
    throw new Error("NeoLens requires a project directory. Start NeoCode inside your repository.");
  }
}

async function collectTypeScriptPaths(cwd: string) {
  const paths: string[] = [];

  async function visit(projectDirectory: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(resolve(cwd, projectDirectory), { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const projectPath = normalizeProjectPath(posix.join(projectDirectory, entry.name));
      if (isIgnored(projectPath) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await visit(projectPath);
      } else if (entry.isFile() && TYPESCRIPT_EXTENSIONS.includes(extname(entry.name))) {
        paths.push(projectPath);
        if (paths.length > MAX_GRAPH_FILES) return;
      }
      if (paths.length > MAX_GRAPH_FILES) return;
    }
  }

  await visit("");
  return paths;
}

export function extractTypeScriptImports(source: string): string[] {
  const imports = new Set<string>();
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) imports.add(match[1]);
    }
  }
  return [...imports];
}

export function resolveImportPath(
  importer: string,
  specifier: string,
  existingPaths: ReadonlySet<string>,
): string | null {
  if (!specifier.startsWith(".")) return null;
  const withoutSuffix = specifier.split(/[?#]/, 1)[0];
  if (!withoutSuffix) return null;

  const base = normalizeProjectPath(posix.normalize(posix.join(dirname(importer), withoutSuffix)));
  if (base === ".." || base.startsWith("../")) return null;
  const candidates = extname(base)
    ? [base]
    : [
        ...TYPESCRIPT_EXTENSIONS.map((extension) => `${base}${extension}`),
        ...TYPESCRIPT_EXTENSIONS.map((extension) => `${base}/index${extension}`),
      ];

  return candidates.find((candidate) => existingPaths.has(candidate)) ?? null;
}

function normalizeProjectPath(path: string) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isIgnored(path: string) {
  return path.split("/").some((segment) => IGNORED_SEGMENTS.has(segment));
}

function dedupeEdges(edges: NeoLensGraphEdge[]) {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.source}\0${edge.target}\0${edge.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
