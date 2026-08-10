import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Mode } from "@neocode/shared";
import { loadMcpConfig, McpConfigError, resolveConfigValue } from "../src/mcp/config";
import { createMcpRuntime, inspectMcpServers } from "../src/mcp/runtime";

const fixture = join(import.meta.dir, "fixtures/mcp-server.ts");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("MCP configuration", () => {
  test("returns an empty configuration when the project has no MCP file", async () => {
    const cwd = await createTemporaryProject(false);
    const loaded = await loadMcpConfig(cwd);

    expect(loaded.exists).toBe(false);
    expect(loaded.config.servers).toEqual({});
  });

  test("resolves workspace and explicit environment references", () => {
    process.env.NEOCODE_MCP_TEST_TOKEN = "secret-value";
    expect(resolveConfigValue("${workspaceFolder}/${env:NEOCODE_MCP_TEST_TOKEN}", "/repo"))
      .toBe("/repo/secret-value");
    delete process.env.NEOCODE_MCP_TEST_TOKEN;
  });

  test("rejects malformed configuration with a useful error", async () => {
    const cwd = await createTemporaryProject(false);
    await mkdir(join(cwd, ".neocode"), { recursive: true });
    await writeFile(join(cwd, ".neocode/mcp.json"), "{ not-json }");

    expect(loadMcpConfig(cwd)).rejects.toBeInstanceOf(McpConfigError);
  });
});

describe("MCP runtime", () => {
  test("discovers a stdio server and reports configured tool policies", async () => {
    const cwd = await createTemporaryProject(true);
    const inspection = await inspectMcpServers(cwd);

    expect(inspection.configured).toBe(true);
    expect(inspection.servers).toHaveLength(1);
    expect(inspection.servers[0]?.status).toBe("connected");
    expect(inspection.servers[0]?.tools.map(({ name, access }) => ({ name, access }))).toEqual([
      { name: "read_value", access: "read" },
      { name: "write_value", access: "write" },
      { name: "unclassified", access: "disabled" },
    ]);
  });

  test("exposes only read tools in PLAN and explicitly allowed tools in BUILD", async () => {
    const cwd = await createTemporaryProject(true);

    const planController = new AbortController();
    const plan = await createMcpRuntime({
      cwd,
      mode: Mode.PLAN,
      abortSignal: planController.signal,
    });
    expect(Object.keys(plan.tools)).toEqual(["mcp__fixture__read_value"]);
    await plan.close();

    const buildController = new AbortController();
    const build = await createMcpRuntime({
      cwd,
      mode: Mode.BUILD,
      abortSignal: buildController.signal,
    });
    expect(Object.keys(build.tools).sort()).toEqual([
      "mcp__fixture__read_value",
      "mcp__fixture__write_value",
    ]);

    const readTool = build.tools["mcp__fixture__read_value"];
    expect(readTool).toBeDefined();
    const output = await readTool!.execute(
      { key: "answer" },
      { toolCallId: "test-call", messages: [], context: undefined },
    );
    expect(output).toMatchObject({
      content: [
        {
          type: "text",
          text: JSON.stringify({ tool: "read_value", arguments: { key: "answer" } }),
        },
      ],
    });
    await build.close();
    await build.close();
  });

  test("isolates connection failures instead of breaking the tool runtime", async () => {
    const cwd = await createTemporaryProject(false);
    await mkdir(join(cwd, ".neocode"), { recursive: true });
    await writeFile(
      join(cwd, ".neocode/mcp.json"),
      JSON.stringify({
        version: 1,
        servers: {
          unavailable: {
            transport: "stdio",
            command: "definitely-not-a-real-neocode-command",
            tools: { "*": "read" },
          },
        },
      }),
    );

    const errorLog = spyOn(console, "error").mockImplementation(() => {});
    try {
      const runtime = await createMcpRuntime({
        cwd,
        mode: Mode.PLAN,
        abortSignal: new AbortController().signal,
      });

      expect(runtime.tools).toEqual({});
      expect(runtime.warnings[0]).toContain("MCP server unavailable is unavailable");
      expect(errorLog).toHaveBeenCalledTimes(1);
      await runtime.close();
    } finally {
      errorLog.mockRestore();
    }
  });
});

async function createTemporaryProject(withConfig: boolean): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "neocode-mcp-"));
  temporaryDirectories.push(cwd);

  if (withConfig) {
    const configDirectory = join(cwd, ".neocode");
    await mkdir(configDirectory, { recursive: true });
    await writeFile(
      join(configDirectory, "mcp.json"),
      JSON.stringify({
        version: 1,
        servers: {
          fixture: {
            transport: "stdio",
            command: process.execPath,
            args: [fixture],
            tools: {
              read_value: "read",
              write_value: "write",
            },
          },
        },
      }),
    );
  }

  return cwd;
}
