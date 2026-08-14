import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, parse, posix, resolve } from "node:path";

const MAX_GRAPH_FILES = 500;
const MAX_SOURCE_BYTES = 1_000_000;
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const IGNORED_SEGMENTS = new Set([".git", ".next", ".turbo", "coverage", "dist", "node_modules"]);

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

  edges.sort(
    (left, right) =>
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
  const tokens = tokenizeTypeScriptImports(source);

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token?.kind !== "identifier") continue;

    if (token.value === "require") {
      addCallSpecifier(tokens, index, imports);
      continue;
    }

    if (token.value !== "import" && token.value !== "export") continue;
    if (tokens[index + 1]?.value === "(") {
      addCallSpecifier(tokens, index, imports);
      continue;
    }

    const directSpecifier = tokens[index + 1];
    if (directSpecifier?.kind === "string") {
      imports.add(directSpecifier.value);
      continue;
    }

    for (let cursor = index + 1; cursor < tokens.length; cursor++) {
      const candidate = tokens[cursor];
      if (!candidate || candidate.value === ";") break;
      if (
        cursor > index + 1 &&
        candidate.kind === "identifier" &&
        (candidate.value === "import" || candidate.value === "export")
      ) {
        index = cursor - 1;
        break;
      }
      if (candidate.kind !== "identifier" || candidate.value !== "from") continue;

      const specifier = tokens[cursor + 1];
      if (specifier?.kind === "string") imports.add(specifier.value);
      index = cursor + 1;
      break;
    }
  }
  return [...imports];
}

type ImportToken = {
  kind: "identifier" | "punctuation" | "string";
  value: string;
};

function addCallSpecifier(tokens: ImportToken[], index: number, imports: Set<string>) {
  if (tokens[index + 1]?.value !== "(") return;
  const specifier = tokens[index + 2];
  if (specifier?.kind === "string" && tokens[index + 3]?.value === ")") {
    imports.add(specifier.value);
  }
}

function tokenizeTypeScriptImports(source: string): ImportToken[] {
  const tokens: ImportToken[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index++;
      continue;
    }

    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index++;
      }
      index = Math.min(index + 2, source.length);
      continue;
    }

    if (character === '"' || character === "'") {
      const stringToken = readStringToken(source, index, character);
      tokens.push({ kind: "string", value: stringToken.value });
      index = stringToken.nextIndex;
      continue;
    }

    if (character === "`") {
      index = skipTemplateLiteral(source, index);
      continue;
    }

    if (character && isIdentifierStart(character)) {
      const start = index++;
      while (index < source.length && isIdentifierPart(source[index] ?? "")) index++;
      tokens.push({ kind: "identifier", value: source.slice(start, index) });
      continue;
    }

    if (character === "(" || character === ")" || character === ";") {
      tokens.push({ kind: "punctuation", value: character });
    }
    index++;
  }

  return tokens;
}

function readStringToken(source: string, quoteIndex: number, quote: string) {
  let index = quoteIndex + 1;
  let value = "";

  while (index < source.length) {
    const character = source[index] ?? "";
    if (character === quote) return { value, nextIndex: index + 1 };
    if (character === "\\" && index + 1 < source.length) {
      value += source[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (character === "\n" || character === "\r") break;
    value += character;
    index++;
  }

  return { value, nextIndex: index };
}

function skipTemplateLiteral(source: string, templateIndex: number) {
  let index = templateIndex + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    index++;
    if (character === "`") break;
  }
  return index;
}

function isIdentifierStart(character: string) {
  const code = character.charCodeAt(0);
  return (
    character === "$" ||
    character === "_" ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isIdentifierPart(character: string) {
  const code = character.charCodeAt(0);
  return isIdentifierStart(character) || (code >= 48 && code <= 57);
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
