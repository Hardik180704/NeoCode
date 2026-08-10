import { readFile } from "node:fs/promises";
import { dirname, extname, posix, resolve } from "node:path";

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
  const paths: string[] = [];

  for (const pattern of ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"]) {
    const glob = new Bun.Glob(pattern);
    for await (const match of glob.scan({ cwd, dot: false, onlyFiles: true })) {
      const projectPath = normalizeProjectPath(match);
      if (isIgnored(projectPath) || paths.includes(projectPath)) continue;
      paths.push(projectPath);
      if (paths.length > MAX_GRAPH_FILES) break;
    }
    if (paths.length > MAX_GRAPH_FILES) break;
  }

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
        // A file may disappear while the agent is editing it. The next refresh
        // will reconcile the graph, so a transient read failure is harmless.
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
