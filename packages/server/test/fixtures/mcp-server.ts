import { createInterface } from "node:readline";

const input = createInterface({ input: process.stdin });

input.on("line", (line) => {
  let message: Record<string, unknown>;
  try {
    message = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return;
  }

  if (message.method === "initialize") {
    respond(message.id, {
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: { name: "neocode-test-mcp", version: "1.0.0" },
    });
    return;
  }

  if (message.method === "tools/list") {
    respond(message.id, {
      tools: [
        {
          name: "read_value",
          description: "Read a test value",
          inputSchema: {
            type: "object",
            properties: { key: { type: "string" } },
            required: ["key"],
          },
        },
        {
          name: "write_value",
          description: "Write a test value",
          inputSchema: {
            type: "object",
            properties: { key: { type: "string" }, value: { type: "string" } },
            required: ["key", "value"],
          },
        },
        {
          name: "unclassified",
          description: "A tool without an explicit Neocode policy",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });
    return;
  }

  if (message.method === "tools/call") {
    const params = message.params as {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    respond(message.id, {
      content: [
        {
          type: "text",
          text: JSON.stringify({ tool: params.name, arguments: params.arguments ?? {} }),
        },
      ],
    });
  }
});

function respond(id: unknown, result: unknown) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}
