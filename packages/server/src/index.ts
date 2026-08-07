import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "./middleware/require-auth";
import * as Sentry from "@sentry/hono/bun";
import { sentry } from "@sentry/hono/bun";
import sessions from "./routes/sessions";
import chat from "./routes/chat";
import auth from "./routes/auth";

const app = new Hono();

app.use(
  sentry(app, {
    dsn: "https://ed4be58f4d5796b02b049717723360b6@o4511733229092864.ingest.us.sentry.io/4511733240758272",
    tracesSampleRate: 1.0,
    enableLogs: true,
    sendDefaultPii: true,
  }),
);

app.get("/debug-sentry", () => {
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_endpoint',
  });
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);
  throw new Error("My first Sentry error!");
});


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

const routes = app
  .route("/auth", auth)
  .route("/sessions", sessions)
  .route("/chat", chat);

export type AppType = typeof routes;

// idleTimeout must be high otherwise LLM tool calls might not complete
export default { port: 3000, fetch: app.fetch, idleTimeout: 255 };