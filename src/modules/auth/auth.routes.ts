import { FastifyInstance } from "fastify";
import { authController } from "./auth.controller";
import { emptyBody, ok, okMessage, op, plainError, queryParams, str } from "@/schemas/common";
import { authPayloadSchema } from "@/schemas/entities";

const TAGS = ["Auth"];

export async function registerAuthRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/auth/google",
    {
      schema: op({
        tags: TAGS,
        summary: "Start Google sign-in",
        description:
          "Send the browser here — do not fetch it with XHR. Responds with a 302 to Google's consent screen. There are no passwords in this system; Google is the only identity provider.",
        response: {
          302: emptyBody(
            "Empty body. Follow the `Location` header to Google's OAuth consent screen."
          ),
        },
      }),
    },
    (request, reply) => authController.googleStart(request, reply)
  );

  fastify.get(
    "/auth/google/callback",
    {
      schema: op({
        tags: TAGS,
        summary: "Google sign-in callback",
        description: [
          "Google redirects the browser here after consent. Do not call it yourself.",
          "",
          "On success the API:",
          "1. Creates the user (or binds Google to a pre-whitelisted email, flipping it to `ACTIVE`).",
          "2. Opens a session and sets an httpOnly `refreshToken` cookie scoped to `/api/v1/auth`.",
          "3. Redirects to `{SITE_URL}/auth/callback?token=<accessToken>`.",
          "",
          "Read the `token` query param on that page — it is the 15-minute Bearer token for every guarded endpoint.",
        ].join("\n"),
        query: queryParams({
          code: str("One-time authorization code issued by Google.", { example: "4/0AeanS0b…" }),
          state: str("Opaque round-trip value, when one was sent."),
        }),
        response: {
          302: emptyBody(
            "Empty body. Follow the `Location` header to `{SITE_URL}/auth/callback?token=<accessToken>`."
          ),
          400: plainError("The `code` query parameter was missing.", "Missing code"),
          403: plainError("The account exists but is suspended.", "Account suspended"),
          500: plainError("Token exchange with Google failed.", "Authentication failed"),
        },
      }),
    },
    (request, reply) => authController.googleCallback(request, reply)
  );

  fastify.post(
    "/auth/refresh",
    {
      schema: op({
        tags: TAGS,
        summary: "Exchange the refresh cookie for a new access token",
        description: [
          "Takes no body. Authenticates with the httpOnly `refreshToken` cookie, so the call must be made with credentials included (`fetch(url, { credentials: 'include' })`).",
          "",
          "The old session is revoked and a new cookie is issued on every call — refresh tokens rotate.",
          "Call this when an access token is about to hit its 15-minute expiry.",
        ].join("\n"),
        response: {
          200: ok("A new access token, plus a rotated `refreshToken` cookie.", authPayloadSchema),
          401: plainError(
            "No cookie, or the session was revoked, expired, or belongs to a suspended user.",
            "Invalid or revoked session"
          ),
        },
      }),
    },
    (request, reply) => authController.refreshToken(request, reply)
  );

  fastify.post(
    "/auth/logout",
    {
      schema: op({
        tags: TAGS,
        summary: "Log out of this device",
        description:
          "Revokes the session behind the `refreshToken` cookie and clears the cookie. Takes no body. Other devices stay signed in — use `/auth/logout-all` for those.",
        response: {
          200: okMessage("The session was revoked.", "Logged out"),
          400: plainError("No `refreshToken` cookie was sent.", "No active session"),
          500: plainError("The session could not be revoked.", "Logout failed"),
        },
      }),
    },
    (request, reply) => authController.logout(request, reply)
  );

  fastify.post(
    "/auth/logout-all",
    {
      schema: op({
        tags: TAGS,
        summary: "Log out of every device",
        description:
          "Revokes every session for the signed-in user and clears the cookie on this device. Takes no body. Requires a Bearer token, because it needs to know who you are.",
        access: "any signed-in user",
        response: {
          200: okMessage("Every session was revoked.", "All sessions revoked"),
          401: plainError("No Bearer token was sent.", "Not authenticated"),
          500: plainError("The sessions could not be revoked.", "Logout failed"),
        },
      }),
    },
    (request, reply) => authController.logoutAll(request, reply)
  );
}
