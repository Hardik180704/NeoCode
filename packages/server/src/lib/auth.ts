import { createClerkClient } from "@clerk/backend";

let clerkClient: ReturnType<typeof createClerkClient> | undefined;

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;

  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
  }

  if (!publishableKey) {
    throw new Error("CLERK_PUBLISHABLE_KEY environment variable is required");
  }

  clerkClient ??= createClerkClient({ secretKey, publishableKey });
  return clerkClient;
}

export async function authenticateOAuthRequest(request: Request) {
  const clerkClient = getClerkClient();
  const requestState = await clerkClient.authenticateRequest(request, {
    acceptsToken: "oauth_token",
  });

  if (!requestState.isAuthenticated) {
    return null;
  }

  const auth = requestState.toAuth();
  if (auth.tokenType !== "oauth_token" || !auth.userId) {
    return null;
  }

  return { userId: auth.userId };
}
