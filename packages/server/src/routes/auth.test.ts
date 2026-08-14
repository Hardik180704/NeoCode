import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import app from "./auth";

const originalFrontendApi = process.env.CLERK_FRONTEND_API;
const originalClientId = process.env.CLERK_OAUTH_CLIENT_ID;

beforeEach(() => {
  delete process.env.CLERK_FRONTEND_API;
  delete process.env.CLERK_OAUTH_CLIENT_ID;
});

afterEach(() => {
  if (originalFrontendApi === undefined) {
    delete process.env.CLERK_FRONTEND_API;
  } else {
    process.env.CLERK_FRONTEND_API = originalFrontendApi;
  }

  if (originalClientId === undefined) {
    delete process.env.CLERK_OAUTH_CLIENT_ID;
  } else {
    process.env.CLERK_OAUTH_CLIENT_ID = originalClientId;
  }
});

describe("authentication routes", () => {
  test("returns a service error when OAuth is not configured", async () => {
    const response = await app.request("/config");

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Authentication is not configured" });
  });

  test("returns the public OAuth configuration", async () => {
    process.env.CLERK_FRONTEND_API = "clerk.example.test";
    process.env.CLERK_OAUTH_CLIENT_ID = "client_test";

    const response = await app.request("/config");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clerkFrontendApi: "clerk.example.test",
      clientId: "client_test",
    });
  });

  test("rejects incomplete and invalid callback state", async () => {
    const missing = await app.request("/callback?code=code-only");
    expect(missing.status).toBe(400);
    expect(await missing.text()).toBe("Missing authorization code or state");

    const invalid = await app.request("/callback?code=code&state=not-json.signature");
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).toBe("Invalid authentication state");
  });

  test("forwards provider errors without attempting a redirect", async () => {
    const response = await app.request(
      "/callback?error=access_denied&error_description=Login%20cancelled",
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Login cancelled");
  });

  test("redirects a valid callback to the local CLI listener", async () => {
    const encodedState = Buffer.from(JSON.stringify({ port: 43123 })).toString("base64url");
    const state = `${encodedState}.signature`;
    const response = await app.request(
      `/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `http://localhost:43123/callback?code=oauth-code&state=${encodeURIComponent(state)}`,
    );
  });
});
