import { Hono } from "hono";
// import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import * as Sentry from "@sentry/hono/bun";
import { z } from "zod";
import { db } from "@neocode/database/client";
import { Role, mode, MessageStatus } from "@neocode/database/enums";
import { findSupportedChatModel } from "@neocode/shared";

const createSessionSchema = z.object({
  title: z.string(),
  cwd: z.string().optional(),
  initialMessage: z
    .object({
      role: z.enum(Role),
      content: z.string(),
      mode: z.enum(mode),
      model: z.string()
        .refine((id) => !!findSupportedChatModel(id), "Unsupported model"),
    })
    .optional(),
});

const createSessionValidator = zValidator(
  "json",
  createSessionSchema,
  (result, c) => {
    if (!result.success) {
      Sentry.logger.warn("Session creation validation failed", {
        path: c.req.path,
        issues: result.error.issues.length,
      });

      return c.json({ error: "Invalid request body" }, 400);
    }
  }
);

const app = new Hono()
  .get("/", async (c) => {
    const sessions = await db.session.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    Sentry.logger.info("Listed sessions", {
      count: sessions.length
    })
    return c.json(sessions);
  })
  .get("/:id", async (c) => {
    // MOCK: Uncomment to simulate slow session loading
    //  const start = Date.now();
    //  while (Date.now() - start < 5000) {}

    // MOCK: Uncomment to simulate session loading error
    //  return c.json(
    //    { error: "Mock error: session loading failed" },
    //    500
    //  );

    const id = c.req.param("id");
    
    const session = await db.session.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      }
    })

    if (!session) {
      Sentry.logger.warn("Session not found", {
        sessionId: id,
        userId: "mock-user"
      })
      return c.json({ error: "Session not found" }, 404);
    }

    Sentry.logger.info("Loaded info", {
      sessionId: session.id,
    });

    return c.json(session);
  })
  .post("/", createSessionValidator, async (c) => {
    // MOCK: Uncomment to simulate slow session loading
    // await new Promise((r) => setTimeout(r, 5000))

    // MOCK: Uncomment to simulate session loading error
    // throw new HTTPException(
    //   500,
    //   { message: "Mock error: session loading failed" }
    // )
    const { initialMessage, ...data } = c.req.valid("json");

    const session = await db.session.create({
      data: {
        ...data,
        userId: "mock-user",
        ...(initialMessage && {
          messages: {
            create: {
              ...initialMessage,
              status: MessageStatus.COMPLETE,
            }
          }
        })
      },
      include: {
        messages: true,
      }
    });

    Sentry.logger.info("Created session", {
      sessionId: session.id,
      title: session.title,
    })

    return c.json(session, 201);
  });

export default app;
