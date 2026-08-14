import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "./middleware/require-auth";
import * as Sentry from "@sentry/hono/bun";
import { sentry } from "@sentry/hono/bun";
import sessions from "./routes/sessions";
import chat from "./routes/chat";
import mcp from "./routes/mcp";
import auth from "./routes/auth";
import neolens from "./routes/neolens";
import billing from "./routes/billing";

const app = new Hono();

const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  const configuredSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1");
  const tracesSampleRate = Number.isFinite(configuredSampleRate)
    ? Math.min(1, Math.max(0, configuredSampleRate))
    : 0.1;

  app.use(
    sentry(app, {
      dsn: sentryDsn,
      tracesSampleRate,
      enableLogs: true,
      sendDefaultPii: false,
    }),
  );
}


app.onError((error, c) => {
  if (error instanceof HTTPException) {
    Sentry.logger.warn("Handled HTTP error", {
      status: error.status,
      message: error.message || "Request failed",
      path: c.req.path,
      method: c.req.method,
    });

    return c.json({
      error: error.message || "Request failed",
    }, error.status);
  }

  console.error("Unhandled server error", error);
  return c.json({
    error: "Internal Server Error"
  }, 500);
});

app.use("/sessions/*", requireAuth);
app.use("/chat/*", requireAuth);
app.use("/mcp/*", requireAuth);
app.use("/neolens/*", requireAuth);
app.use("/billing/checkout", requireAuth);
app.use("/billing/portal", requireAuth);

const routes = app
  .route("/auth", auth)
  .route("/sessions", sessions)
  .route("/chat", chat)
  .route("/mcp", mcp)
  .route("/neolens", neolens)
  .route("/billing", billing);

export type AppType = typeof routes;

// idleTimeout must be high otherwise LLM tool calls might not complete
export default { port: 3000, fetch: app.fetch, idleTimeout: 255 };
