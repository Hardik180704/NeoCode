import { Hono } from "hono";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { createCheckoutUrl, createCustomerPortalUrl } from "../lib/polar";

const app = new Hono<AuthenticatedEnv>()
  .post("/checkout", async (c) => {
    const userId = c.get("userId");

    return c.json({
      url: await createCheckoutUrl({
        customerExternalId: userId,
        requestUrl: c.req.url,
      }),
    });
  })
  .post("/portal", async (c) => {
    const userId = c.get("userId");

    return c.json({
      url: await createCustomerPortalUrl({
        customerExternalId: userId,
        requestUrl: c.req.url,
      }),
    });
  })
  .get("/success", (c) =>
    c.text("Done. You can close this tab and return to Neocode."),
  );

export default app;
