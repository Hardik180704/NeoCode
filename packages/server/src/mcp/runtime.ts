import type { mode as Mode } from "@neocode/database/enums";
import { mode as ModeValue } from "@neocode/database/enums";
import type { ListToolsResult, MCPClient } from "@ai-sdk/mcp";
import { connectMcpServer } from "./connect";
import {
  getToolAccess,
  loadMcpConfig,
  McpConfigError,
  type McpServerConfig,
  type McpToolAccess,
} from "./config";

const TOOL_LIST_TIMEOUT_MS = 10_000;
const MAX_TOOLS_PER_SERVER = 100;

export type McpToolSummary = {
  name: string;
  title?: string;
  description?: string;
  access: McpToolAccess;
  enabledInPlan: boolean;
  enabledInBuild: boolean;
};

export type McpServerSummary = {
  name: string;
  transport: "stdio" | "http";
  status: "disabled" | "connected" | "failed";
  serverInfo?: {
    name: string;
    version: string;
    title?: string;
  };
  tools: McpToolSummary[];
  error?: string;
};

export type McpInspection = {
  configured: boolean;
  configPath: string;
  servers: McpServerSummary[];
};

export type McpRuntime = {
  tools: Record<string, McpDiscoveredTool>;
  warnings: string[];
  close: () => Promise<void>;
};

type McpDiscoveredTool = Awaited<ReturnType<MCPClient["tools"]>>[string];

export async function createMcpRuntime(params: {
  cwd: string;
  mode: Mode;
  abortSignal: AbortSignal;
}): Promise<McpRuntime> {
  const { cwd, mode, abortSignal } = params;
  const clients: MCPClient[] = [];
  const tools: Record<string, McpDiscoveredTool> = {};
  const warnings: string[] = [];

  let loaded;
  try {
    loaded = await loadMcpConfig(cwd);
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      tools,
      warnings: [message],
      close: async () => {},
    };
  }

  const enabledServers = Object.entries(loaded.config.servers).filter(
    ([, server]) => server.enabled,
  );

  await Promise.all(
    enabledServers.map(async ([serverName, serverConfig]) => {
      if (abortSignal.aborted) return;

      let client: MCPClient | undefined;
      try {
        client = await connectMcpServer({ name: serverName, config: serverConfig, cwd });
        clients.push(client);

        const definitions = await client.listTools({
          options: { signal: abortSignal, timeout: TOOL_LIST_TIMEOUT_MS },
        });
        const allowedDefinitions = filterDefinitions(definitions, serverConfig, mode);
        const serverTools = client.toolsFromDefinitions(allowedDefinitions);

        for (const [toolName, tool] of Object.entries(serverTools)) {
          const exposedName = createUniqueToolName(serverName, toolName, tools);
          tools[exposedName] = tool;
        }
      } catch (error) {
        warnings.push(`MCP server ${serverName} is unavailable: ${getErrorMessage(error)}`);
        if (client) {
          await client.close().catch(() => {});
          const index = clients.indexOf(client);
          if (index >= 0) clients.splice(index, 1);
        }
      }
    }),
  );

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    abortSignal.removeEventListener("abort", onAbort);
    await Promise.allSettled(clients.map((client) => client.close()));
  };
  const onAbort = () => {
    void close();
  };
  abortSignal.addEventListener("abort", onAbort, { once: true });

  if (abortSignal.aborted) await close();

  return { tools, warnings: warnings.sort(), close };
}

export async function inspectMcpServers(cwd: string): Promise<McpInspection> {
  const loaded = await loadMcpConfig(cwd);

  const servers = await Promise.all(
    Object.entries(loaded.config.servers).map(async ([name, config]): Promise<McpServerSummary> => {
      if (!config.enabled) {
        return { name, transport: config.transport, status: "disabled", tools: [] };
      }

      let client: MCPClient | undefined;
      try {
        client = await connectMcpServer({ name, config, cwd });
        const definitions = await client.listTools({
          options: { timeout: TOOL_LIST_TIMEOUT_MS },
        });

        return {
          name,
          transport: config.transport,
          status: "connected",
          serverInfo: client.serverInfo,
          tools: definitions.tools.map((tool) => summarizeTool(tool, config)),
        };
      } catch (error) {
        return {
          name,
          transport: config.transport,
          status: "failed",
          tools: [],
          error: getErrorMessage(error),
        };
      } finally {
        await client?.close().catch(() => {});
      }
    }),
  );

  return {
    configured: loaded.exists,
    configPath: loaded.configPath,
    servers,
  };
}

function filterDefinitions(
  definitions: ListToolsResult,
  config: McpServerConfig,
  mode: Mode,
): ListToolsResult {
  return {
    ...definitions,
    tools: definitions.tools
      .filter((tool) => {
        const access = getToolAccess(config, tool.name);
        if (access === "disabled") return false;
        return mode === ModeValue.BUILD || access === "read";
      })
      .slice(0, MAX_TOOLS_PER_SERVER),
  };
}

function summarizeTool(
  tool: ListToolsResult["tools"][number],
  config: McpServerConfig,
): McpToolSummary {
  const access = getToolAccess(config, tool.name);
  return {
    name: tool.name,
    ...(tool.title ? { title: tool.title } : {}),
    ...(tool.description ? { description: tool.description } : {}),
    access,
    enabledInPlan: access === "read",
    enabledInBuild: access === "read" || access === "write",
  };
}

function createUniqueToolName(
  serverName: string,
  toolName: string,
  existing: Record<string, unknown>,
): string {
  const base = `mcp__${sanitizeName(serverName)}__${sanitizeName(toolName)}`;
  if (!(base in existing)) return base;

  const suffix = stableHash(`${serverName}\0${toolName}`).toString(36);
  return `${base}__${suffix}`;
}

function sanitizeName(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_-]/g, "_");
  return sanitized.length > 0 ? sanitized : "unnamed";
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof McpConfigError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
