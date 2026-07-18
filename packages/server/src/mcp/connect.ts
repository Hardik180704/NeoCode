import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { McpServerConfig } from "./config";
import { resolveConfigValue } from "./config";

const SAFE_INHERITED_ENV = ["PATH", "LANG", "LC_ALL", "SHELL", "TMPDIR"] as const;

export async function connectMcpServer(params: {
  name: string;
  config: McpServerConfig;
  cwd: string;
}): Promise<MCPClient> {
  const { name, config, cwd } = params;

  if (config.transport === "stdio") {
    const env: Record<string, string> = {};
    for (const key of SAFE_INHERITED_ENV) {
      const value = process.env[key];
      if (value != null) env[key] = value;
    }
    for (const [key, value] of Object.entries(config.env)) {
      env[key] = resolveConfigValue(value, cwd);
    }

    return createMCPClient({
      clientName: `neocode-${name}`,
      version: "1.0.0",
      maxRetries: 1,
      transport: new Experimental_StdioMCPTransport({
        command: resolveConfigValue(config.command, cwd),
        args: config.args.map((arg) => resolveConfigValue(arg, cwd)),
        cwd,
        env,
        // MCP reserves stdout for JSON-RPC. Ignore stderr so a noisy third-party
        // server cannot fill an unread pipe and deadlock the Neocode request.
        stderr: "ignore",
      }),
      onUncaughtError: (error) => {
        console.error(`Uncaught MCP error from ${name}`, error);
      },
    });
  }

  const headers = Object.fromEntries(
    Object.entries(config.headers).map(([key, value]) => [
      key,
      resolveConfigValue(value, cwd),
    ]),
  );

  return createMCPClient({
    clientName: `neocode-${name}`,
    version: "1.0.0",
    maxRetries: 1,
    transport: {
      type: "http",
      url: resolveConfigValue(config.url, cwd),
      headers,
      redirect: "error",
    },
    onUncaughtError: (error) => {
      console.error(`Uncaught MCP error from ${name}`, error);
    },
  });
}
