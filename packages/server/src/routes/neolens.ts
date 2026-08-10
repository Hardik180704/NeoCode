import { Hono } from "hono";
import { db } from "@neocode/database/client";
import {
  type NeoLensActivityEvent,
  type NeoLensFileStatus,
} from "@neocode/shared";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { inspectMcpServers } from "../mcp/runtime";
import {
  buildTypeScriptDependencyGraph,
  type NeoLensExternalNode,
  type NeoLensGraphEdge,
} from "../neolens/graph";

const app = new Hono<AuthenticatedEnv>().get("/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const userId = c.get("userId");
  const session = await db.session.findUnique({
    where: { id: sessionId, userId },
    select: {
      cwd: true,
      messages: true,
    },
  });

  if (!session) return c.json({ error: "Session not found" }, 404);
  if (!session.cwd) return c.json({ error: "Session has no project directory" }, 409);

  const [graph, mcpInspection] = await Promise.all([
    buildTypeScriptDependencyGraph(session.cwd),
    inspectMcpServers(session.cwd).catch(() => null),
  ]);
  const timeline = collectPersistedActivity(
    Array.isArray(session.messages) ? session.messages : [],
  );
  const externalNodes: NeoLensExternalNode[] = (mcpInspection?.servers ?? []).map((server) => ({
    id: `mcp:${sanitizeMcpName(server.name)}`,
    kind: "mcp",
    label: server.name,
    status: server.status,
    transport: server.transport,
  }));
  const mcpEdges: NeoLensGraphEdge[] = timeline.flatMap((event) =>
    event.mcpServer
      ? event.filePaths.map((path) => ({
          source: path,
          target: `mcp:${event.mcpServer}`,
          kind: "mcp" as const,
        }))
      : [],
  );

  return c.json({
    cwd: session.cwd,
    graph: {
      nodes: [...graph.nodes, ...externalNodes],
      edges: dedupeEdges([...graph.edges, ...mcpEdges]),
      truncated: graph.truncated,
    },
    timeline,
  });
});

export function collectPersistedActivity(values: unknown[]): NeoLensActivityEvent[] {
  const events: NeoLensActivityEvent[] = [];
  let fallbackOffset = 0;

  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const parts = (value as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;

    for (const partValue of parts) {
      if (!partValue || typeof partValue !== "object") continue;
      const part = partValue as Record<string, unknown>;
      if (typeof part.type !== "string" || !part.type.startsWith("tool-")) continue;
      const name = part.type.slice("tool-".length);
      const id = typeof part.toolCallId === "string" ? part.toolCallId : `${name}:${fallbackOffset}`;
      const args = part.input && typeof part.input === "object"
        ? part.input as Record<string, unknown>
        : {};
      const filePaths = extractLegacyPaths(args);
      const startedStatus = classifyLegacyStatus(name);
      events.push({
        id: `${id}:started`,
        toolCallId: id,
        toolName: name,
        phase: "started",
        status: startedStatus,
        filePaths,
        ...(getMcpServer(name) ? { mcpServer: getMcpServer(name) } : {}),
        timestampMs: fallbackOffset,
        offsetMs: fallbackOffset,
        summary: `${capitalize(startedStatus)} ${filePaths[0] ?? name}`,
      });
      fallbackOffset += 250;

      const result = part.output ?? part.errorText;
      if (result !== undefined) {
        const serializedResult = typeof result === "string"
          ? result
          : JSON.stringify(result) ?? String(result);
        const status: NeoLensFileStatus = part.state === "output-error" || isLegacyFailure(serializedResult)
          ? "failed"
          : startedStatus;
        events.push({
          id: `${id}:completed`,
          toolCallId: id,
          toolName: name,
          phase: "completed",
          status,
          filePaths,
          ...(getMcpServer(name) ? { mcpServer: getMcpServer(name) } : {}),
          timestampMs: fallbackOffset,
          offsetMs: fallbackOffset,
          summary: `${capitalize(status)} ${filePaths[0] ?? name}`,
        });
        fallbackOffset += 250;
      }
    }
  }

  return events.sort((left, right) => left.timestampMs - right.timestampMs);
}

function extractLegacyPaths(args: Record<string, unknown>) {
  return Object.entries(args)
    .filter(([key, value]) => /^(?:path|file|filePath)$/i.test(key) && typeof value === "string")
    .map(([, value]) => value as string);
}

function classifyLegacyStatus(toolName: string): NeoLensFileStatus {
  return /(?:write|edit|create|delete|remove|update|move|rename)/i.test(toolName)
    ? "modified"
    : "inspected";
}

function isLegacyFailure(result: string) {
  try {
    const parsed = JSON.parse(result) as { error?: unknown; exitCode?: unknown };
    return Boolean(parsed.error) || (typeof parsed.exitCode === "number" && parsed.exitCode !== 0);
  } catch {
    return false;
  }
}

function getMcpServer(toolName: string): string | undefined {
  return toolName.startsWith("mcp__") ? toolName.split("__")[1] : undefined;
}

function sanitizeMcpName(value: string) {
  const sanitized = value.replace(/[^A-Za-z0-9_-]/g, "_");
  return sanitized.length > 0 ? sanitized : "unnamed";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

export default app;
