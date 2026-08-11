import type { Dirent } from "node:fs";
import { lstat, open, readFile, readdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, parse, posix, relative, resolve } from "node:path";

const MAX_WORKSPACE_ENTRIES = 5_000;
const MAX_PREVIEW_BYTES = 512_000;
const MAX_SEARCH_FILES = 1_000;
const MAX_SEARCH_BYTES = 12_000_000;
const MAX_SEARCH_RESULTS = 100;

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor",
]);

const SENSITIVE_NAMES = [
  /^\.env(?:\.|$)/i,
  /^\.npmrc$/i,
  /^\.pypirc$/i,
  /^credentials(?:\.|$)/i,
  /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.|$)/i,
  /\.(?:key|p12|pfx|pem)$/i,
];

const BINARY_EXTENSIONS = new Set([
  ".7z", ".a", ".avi", ".bin", ".bmp", ".class", ".db", ".dll", ".dmg",
  ".doc", ".docx", ".eot", ".exe", ".gif", ".gz", ".ico", ".jar", ".jpeg",
  ".jpg", ".lockb", ".mov", ".mp3", ".mp4", ".o", ".otf", ".pdf", ".png",
  ".so", ".sqlite", ".tar", ".tiff", ".ttf", ".wav", ".webm", ".webp", ".woff",
  ".woff2", ".xls", ".xlsx", ".zip",
]);

export type NeoLensWorkspaceEntry = {
  path: string;
  name: string;
  kind: "directory" | "file";
  depth: number;
};

export type NeoLensWorkspaceIndex = {
  entries: NeoLensWorkspaceEntry[];
  files: string[];
  truncated: boolean;
  ignoredCount: number;
};

export type NeoLensFilePreview = {
  path: string;
  content: string;
  bytes: number;
  truncated: boolean;
  language: string;
};

export type NeoLensSearchMatch = {
  path: string;
  line: number | null;
  column: number | null;
  preview: string;
  kind: "path" | "content";
};

export type NeoLensSearchResult = {
  matches: NeoLensSearchMatch[];
  truncated: boolean;
  scannedFiles: number;
};

type IgnoreRule = {
  pattern: string;
  negate: boolean;
  directoryOnly: boolean;
  anchored: boolean;
};

export function assertSafeWorkspaceRoot(cwd: string) {
  const root = resolve(cwd);
  if (root === resolve(homedir()) || root === parse(root).root) {
    throw new Error("NeoLens requires a project directory. Start NeoCode inside your repository.");
  }
}

export async function buildWorkspaceIndex(cwd: string): Promise<NeoLensWorkspaceIndex> {
  assertSafeWorkspaceRoot(cwd);
  const root = await realpath(cwd);
  const ignoreRules = await loadGitIgnoreRules(root);
  const entries: NeoLensWorkspaceEntry[] = [];
  const files: string[] = [];
  let truncated = false;
  let ignoredCount = 0;

  async function visit(projectDirectory: string, depth: number): Promise<void> {
    if (truncated) return;
    let directoryEntries: Dirent[];
    try {
      directoryEntries = await readdir(resolve(root, projectDirectory), { withFileTypes: true });
    } catch {
      return;
    }

    directoryEntries.sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

    for (const entry of directoryEntries) {
      const projectPath = normalizeProjectPath(posix.join(projectDirectory, entry.name));
      const directory = entry.isDirectory();
      if (
        entry.isSymbolicLink() ||
        shouldAlwaysIgnore(projectPath, entry.name, directory) ||
        isGitIgnored(projectPath, directory, ignoreRules)
      ) {
        ignoredCount += 1;
        continue;
      }
      if (!directory && !entry.isFile()) continue;
      if (entries.length >= MAX_WORKSPACE_ENTRIES) {
        truncated = true;
        return;
      }

      entries.push({
        path: projectPath,
        name: entry.name,
        kind: directory ? "directory" : "file",
        depth,
      });
      if (directory) {
        await visit(projectPath, depth + 1);
      } else {
        files.push(projectPath);
      }
    }
  }

  await visit("", 0);
  return { entries, files, truncated, ignoredCount };
}

export async function readWorkspaceFile(cwd: string, projectPath: string): Promise<NeoLensFilePreview> {
  const resolved = await resolveWorkspaceFile(cwd, projectPath);
  if (isSensitivePath(projectPath)) throw new Error("NeoLens does not display sensitive files");
  if (isBinaryPath(projectPath)) throw new Error("Binary files cannot be previewed");

  const { bytes, totalBytes } = await readFilePrefix(resolved, MAX_PREVIEW_BYTES);
  if (looksBinary(bytes)) throw new Error("Binary files cannot be previewed");
  const truncated = totalBytes > MAX_PREVIEW_BYTES;
  const content = bytes.toString("utf8");
  return {
    path: normalizeProjectPath(projectPath),
    content,
    bytes: totalBytes,
    truncated,
    language: languageForPath(projectPath),
  };
}

export async function searchWorkspace(
  cwd: string,
  files: readonly string[],
  query: string,
): Promise<NeoLensSearchResult> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length < 2) {
    return { matches: [], truncated: false, scannedFiles: 0 };
  }

  const matches: NeoLensSearchMatch[] = [];
  let scannedFiles = 0;
  let scannedBytes = 0;
  let truncated = false;

  for (const projectPath of files.slice(0, MAX_SEARCH_FILES)) {
    if (matches.length >= MAX_SEARCH_RESULTS || scannedBytes >= MAX_SEARCH_BYTES) {
      truncated = true;
      break;
    }
    if (isSensitivePath(projectPath) || isBinaryPath(projectPath)) continue;

    if (projectPath.toLocaleLowerCase().includes(normalizedQuery)) {
      matches.push({ path: projectPath, line: null, column: null, preview: projectPath, kind: "path" });
      if (matches.length >= MAX_SEARCH_RESULTS) {
        truncated = true;
        break;
      }
    }

    try {
      const resolved = await resolveWorkspaceFile(cwd, projectPath);
      const { bytes, totalBytes } = await readFilePrefix(resolved, MAX_PREVIEW_BYTES);
      scannedFiles += 1;
      scannedBytes += bytes.byteLength;
      if (totalBytes > MAX_PREVIEW_BYTES || looksBinary(bytes)) continue;
      const lines = bytes.toString("utf8").split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const column = line.toLocaleLowerCase().indexOf(normalizedQuery);
        if (column === -1) continue;
        matches.push({
          path: projectPath,
          line: index + 1,
          column: column + 1,
          preview: line.trim().slice(0, 180),
          kind: "content",
        });
        if (matches.length >= MAX_SEARCH_RESULTS) {
          truncated = true;
          break;
        }
      }
    } catch {
      // Files may disappear or become unreadable while the workspace is open.
    }
  }

  if (files.length > MAX_SEARCH_FILES) truncated = true;
  return { matches, truncated, scannedFiles };
}

async function resolveWorkspaceFile(cwd: string, projectPath: string) {
  assertSafeWorkspaceRoot(cwd);
  if (!projectPath || projectPath.includes("\0") || isAbsolute(projectPath)) {
    throw new Error("Invalid project file path");
  }
  const root = await realpath(cwd);
  const candidate = resolve(root, projectPath);
  const relativePath = relative(root, candidate);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Path is outside the project directory");
  }

  let current = root;
  for (const segment of relativePath.split(/[\\/]/)) {
    current = resolve(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error("NeoLens does not follow symbolic links");
  }
  const info = await lstat(candidate);
  if (!info.isFile()) throw new Error("Path is not a file");
  return candidate;
}

async function readFilePrefix(path: string, limit: number) {
  const handle = await open(path, "r");
  try {
    const info = await handle.stat();
    const length = Math.min(info.size, limit);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return { bytes: buffer.subarray(0, bytesRead), totalBytes: info.size };
  } finally {
    await handle.close();
  }
}

async function loadGitIgnoreRules(root: string): Promise<IgnoreRule[]> {
  try {
    const source = await readFile(resolve(root, ".gitignore"), "utf8");
    return source.split(/\r?\n/).flatMap((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return [];
      const negate = line.startsWith("!");
      const value = negate ? line.slice(1) : line;
      const directoryOnly = value.endsWith("/");
      const withoutSlash = directoryOnly ? value.slice(0, -1) : value;
      const anchored = withoutSlash.startsWith("/");
      const pattern = anchored ? withoutSlash.slice(1) : withoutSlash;
      return pattern ? [{ pattern, negate, directoryOnly, anchored }] : [];
    });
  } catch {
    return [];
  }
}

function isGitIgnored(path: string, directory: boolean, rules: readonly IgnoreRule[]) {
  let ignored = false;
  for (const rule of rules) {
    if (rule.directoryOnly && !directory && !path.includes(`${rule.pattern}/`)) continue;
    const matches = matchIgnorePattern(path, rule.pattern, rule.anchored);
    if (matches) ignored = !rule.negate;
  }
  return ignored;
}

function matchIgnorePattern(path: string, pattern: string, anchored: boolean) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", "\0")
    .replaceAll("*", "[^/]*")
    .replaceAll("?", "[^/]")
    .replaceAll("\0", ".*");
  const expression = anchored || pattern.includes("/")
    ? `^${escaped}(?:/.*)?$`
    : `(?:^|/)${escaped}(?:/.*)?$`;
  return new RegExp(expression).test(path);
}

function shouldAlwaysIgnore(path: string, name: string, directory: boolean) {
  if (directory && IGNORED_DIRECTORIES.has(name)) return true;
  if (isSensitivePath(path)) return true;
  return false;
}

function isSensitivePath(path: string) {
  return SENSITIVE_NAMES.some((pattern) => pattern.test(basename(path)));
}

function isBinaryPath(path: string) {
  const extension = posix.extname(path.toLocaleLowerCase());
  return BINARY_EXTENSIONS.has(extension);
}

function looksBinary(bytes: Uint8Array) {
  const sample = bytes.subarray(0, Math.min(bytes.byteLength, 8_000));
  return sample.includes(0);
}

function languageForPath(path: string) {
  const extension = posix.extname(path).slice(1).toLocaleLowerCase();
  const languages: Record<string, string> = {
    cjs: "javascript", cts: "typescript", js: "javascript", json: "json",
    jsx: "javascript", md: "markdown", mdx: "markdown", mjs: "javascript",
    mts: "typescript", py: "python", rs: "rust", sh: "shell", ts: "typescript",
    tsx: "typescript", yaml: "yaml", yml: "yaml",
  };
  return languages[extension] ?? (extension || "text");
}

function normalizeProjectPath(path: string) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
