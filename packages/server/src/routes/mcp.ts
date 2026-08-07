import { Hono } from "hono";
import { db } from "@neocode/database/client";
import { inspectMcpServers } from "../mcp/runtime";
import { McpConfigError } from "../mcp/config";
import type { AuthenticatedEnv } from "../middleware/require-auth";

const app = new Hono<AuthenticatedEnv>().get("/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const userId = c.get("userId");
  const session = await db.session.findUnique({
    where: { id: sessionId, userId },
    select: { cwd: true },
  });

  if (!session) return c.json({ error: "Session not found" }, 404);
  if (!session.cwd) return c.json({ error: "Session has no project directory" }, 409);

  try {
    return c.json(await inspectMcpServers(session.cwd));
  } catch (error) {
    if (error instanceof McpConfigError) {
      return c.json({ error: error.message, configPath: error.configPath }, 422);
    }
    throw error;
  }
});

export default app;
