import { Hono } from "hono";

const app = new Hono()
  .get("/config", (c) => {
    const clerkFrontendApi = process.env.CLERK_FRONTEND_API;
    const clientId = process.env.CLERK_OAUTH_CLIENT_ID;

    if (!clerkFrontendApi || !clientId) {
      return c.json({ error: "Authentication is not configured" }, 503);
    }

    return c.json({ clerkFrontendApi, clientId });
  })
  .get("/callback", (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    const errorDescription = c.req.query("error_description");

    if (error) {
      return c.text(errorDescription ?? error, 400);
    }

    if (!code || !state) {
      return c.text("Missing authorization code or state", 400);
    }

    try {
      const [encoded] = state.split(".");
      if (!encoded) throw new Error("Invalid state");

      const payload = JSON.parse(
        Buffer.from(encoded, "base64url").toString(),
      );
      const port = payload.port;

      if (!port || typeof port !== "number") {
        throw new Error("Invalid port in state");
      }

      const redirectUrl = `http://localhost:${port}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

      return c.redirect(redirectUrl);
    } catch {
      return c.text("Invalid authentication state", 400);
    }
  });

export default app;
