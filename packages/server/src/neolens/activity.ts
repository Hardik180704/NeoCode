import { isAbsolute, normalize, relative, resolve } from "node:path";
import type {
  NeoLensActivityEvent,
  NeoLensFileStatus,
} from "@neocode/shared";

const MODIFICATION_TOOLS = new Set(["writeFile", "editFile"]);
const VERIFICATION_COMMAND = /(?:^|\s)(?:bun|npm|pnpm|yarn|npx|bunx)\s+(?:run\s+)?(?:test|build|lint|check|typecheck)|(?:^|\s)(?:tsc|vitest|jest|eslint)(?:\s|$)/i;
const TYPESCRIPT_PATH = /(?:^|\s|["'])([A-Za-z0-9_@./-]+\.(?:ts|tsx|mts|cts))(?:\s|["']|$)/g;

type ToolCall = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
};

export type NeoLensActivityTracker = ReturnType<typeof createNeoLensActivityTracker>;

export function createNeoLensActivityTracker(cwd: string, startedAt: number) {
  const modifiedFiles = new Set<string>();
  const startedEvents = new Map<string, NeoLensActivityEvent>();
  const verificationCalls = new Set<string>();

  const start = (call: ToolCall): NeoLensActivityEvent => {
    const filePaths = extractFilePaths(cwd, call.toolName, call.args);
    const status = classifyStartedStatus(call.toolName);
    if (
      call.toolName === "bash" &&
      typeof call.args.command === "string" &&
      isVerificationCommand(call.args.command)
    ) {
      verificationCalls.add(call.toolCallId);
    }
    const event: NeoLensActivityEvent = {
      id: `${call.toolCallId}:started`,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      phase: "started",
      status,
      filePaths,
      ...(getMcpServer(call.toolName) ? { mcpServer: getMcpServer(call.toolName) } : {}),
      timestampMs: Date.now(),
      offsetMs: Math.max(0, Date.now() - startedAt),
      summary: createSummary(call.toolName, status, filePaths),
    };
    startedEvents.set(call.toolCallId, event);
    return event;
  };

  const complete = (toolCallId: string, result: string): NeoLensActivityEvent | null => {
    const started = startedEvents.get(toolCallId);
    if (!started) return null;

    const failed = isFailedResult(result);
    const verification = verificationCalls.has(toolCallId);
    const status: NeoLensFileStatus = failed
      ? "failed"
      : verification
        ? "verified"
        : started.status;
    if (!failed && started.status === "modified") {
      for (const path of started.filePaths) modifiedFiles.add(path);
    }
    const filePaths = verification && started.filePaths.length === 0
      ? [...modifiedFiles].sort()
      : started.filePaths;

    return {
      ...started,
      id: `${toolCallId}:completed`,
      phase: "completed",
      status,
      filePaths,
      timestampMs: Date.now(),
      offsetMs: Math.max(0, Date.now() - startedAt),
      summary: createSummary(started.toolName, status, filePaths),
    };
  };

  return { start, complete };
}

export function extractFilePaths(
  cwd: string,
  toolName: string,
  args: Record<string, unknown>,
): string[] {
  const candidates = new Set<string>();
  collectPathValues(args, candidates);

  const command = typeof args.command === "string" ? args.command : "";
  for (const match of command.matchAll(TYPESCRIPT_PATH)) {
    if (match[1]) candidates.add(match[1]);
  }

  return [...candidates]
    .map((path) => toProjectPath(cwd, path))
    .filter((path): path is string => path !== null)
    .sort();
}

function collectPathValues(value: unknown, output: Set<string>, key = "") {
  if (typeof value === "string") {
    if (/^(?:path|file|filePath|files|paths)$/i.test(key)) output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPathValues(item, output, key);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [nestedKey, nestedValue] of Object.entries(value)) {
    collectPathValues(nestedValue, output, nestedKey);
  }
}

function toProjectPath(cwd: string, value: string): string | null {
  if (value.length === 0 || value.includes("\0")) return null;
  const absolute = isAbsolute(value) ? resolve(value) : resolve(cwd, value);
  const projectPath = relative(cwd, absolute);
  if (projectPath === "" || projectPath.startsWith("..") || isAbsolute(projectPath)) {
    return null;
  }
  return normalize(projectPath).replaceAll("\\", "/");
}

function classifyStartedStatus(toolName: string): NeoLensFileStatus {
  if (MODIFICATION_TOOLS.has(toolName) || isMcpWriteTool(toolName)) return "modified";
  return "inspected";
}

function isMcpWriteTool(toolName: string) {
  return toolName.startsWith("mcp__") && /(?:write|edit|create|delete|remove|update|move|rename)/i.test(toolName);
}

function isFailedResult(result: string) {
  try {
    const parsed = JSON.parse(result) as { error?: unknown; exitCode?: unknown };
    return Boolean(parsed.error) || (typeof parsed.exitCode === "number" && parsed.exitCode !== 0);
  } catch {
    return /(?:^|\n)(?:error|failed|failure):/i.test(result);
  }
}

function getMcpServer(toolName: string): string | undefined {
  if (!toolName.startsWith("mcp__")) return undefined;
  return toolName.split("__")[1] || "unknown";
}

function createSummary(
  toolName: string,
  status: NeoLensFileStatus,
  filePaths: string[],
) {
  const target = filePaths.length === 0
    ? toolName
    : filePaths.length === 1
      ? filePaths[0]
      : `${filePaths.length} files`;
  return `${capitalize(status)} ${target}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function isVerificationCommand(command: string) {
  return VERIFICATION_COMMAND.test(command);
}
