import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

export const MCP_CONFIG_RELATIVE_PATH = ".neocode/mcp.json";

const toolAccessSchema = z.enum(["read", "write", "disabled"]);
const environmentNameSchema = z.string().regex(
  /^[A-Za-z_][A-Za-z0-9_]*$/,
  "Environment variable names may contain only letters, numbers, and underscores",
);

const commonServerSchema = z.object({
  enabled: z.boolean().default(true),
  tools: z.record(z.string(), toolAccessSchema).default({}),
});

const stdioServerSchema = commonServerSchema.extend({
  transport: z.literal("stdio"),
  command: z.string().trim().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(environmentNameSchema, z.string()).default({}),
}).strict();

const httpServerSchema = commonServerSchema.extend({
  transport: z.literal("http"),
  url: z.url(),
  headers: z.record(z.string(), z.string()).default({}),
}).strict();

export const mcpConfigSchema = z.object({
  version: z.literal(1),
  servers: z.record(
    z.string().trim().min(1),
    z.discriminatedUnion("transport", [stdioServerSchema, httpServerSchema]),
  ),
}).strict();

export type McpConfig = z.infer<typeof mcpConfigSchema>;
export type McpServerConfig = McpConfig["servers"][string];
export type McpToolAccess = z.infer<typeof toolAccessSchema>;

export class McpConfigError extends Error {
  readonly configPath: string;

  constructor(configPath: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "McpConfigError";
    this.configPath = configPath;
  }
}

export type LoadedMcpConfig = {
  configPath: string;
  exists: boolean;
  config: McpConfig;
};

const emptyConfig: McpConfig = { version: 1, servers: {} };

export async function loadMcpConfig(cwd: string): Promise<LoadedMcpConfig> {
  const configPath = resolve(cwd, MCP_CONFIG_RELATIVE_PATH);
  let raw: string;

  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { configPath, exists: false, config: emptyConfig };
    }

    throw new McpConfigError(configPath, "Unable to read MCP configuration", {
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new McpConfigError(configPath, "MCP configuration is not valid JSON", {
      cause: error,
    });
  }

  const result = mcpConfigSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");
    throw new McpConfigError(configPath, `Invalid MCP configuration: ${details}`);
  }

  return { configPath, exists: true, config: result.data };
}

export function getToolAccess(
  server: McpServerConfig,
  toolName: string,
): McpToolAccess {
  return server.tools[toolName] ?? server.tools["*"] ?? "disabled";
}

export function resolveConfigValue(value: string, cwd: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, expression: string) => {
    if (expression === "workspaceFolder") return cwd;

    if (expression.startsWith("env:")) {
      const name = expression.slice(4);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(`Invalid environment variable reference: ${expression}`);
      }

      const resolved = process.env[name];
      if (resolved == null) {
        throw new Error(`Required environment variable is not defined: ${name}`);
      }
      return resolved;
    }

    throw new Error(`Unsupported MCP configuration variable: ${expression}`);
  });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
