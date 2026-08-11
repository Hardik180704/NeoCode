import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { requireAuth, type AuthenticatedEnv } from "./require-auth";

const originalSecretKey = process.env.CLERK_SECRET_KEY;
const originalPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;

afterEach(() => {
  if (originalSecretKey === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = originalSecretKey;
  }

  if (originalPublishableKey === undefined) {
    delete process.env.CLERK_PUBLISHABLE_KEY;
  } else {
    process.env.CLERK_PUBLISHABLE_KEY = originalPublishableKey;
  }
});

describe("authentication middleware", () => {
  test("fails closed when Clerk is not configured", async () => {
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.CLERK_PUBLISHABLE_KEY;

    const app = new Hono<AuthenticatedEnv>();
    app.use("*", requireAuth);
    app.get("/private", (c) => c.json({ userId: c.get("userId") }));

    const response = await app.request("/private");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized. Run /login to continue.",
    });
  });
});
