import fp from "fastify-plugin";
import { FastifyRequest } from "fastify";
import { verifyAccessToken } from "@/lib/jwt";
import { UnauthorizedError } from "@/lib/errors";

export interface AuthUser {
  id: string;
  role: string;
  editorModules: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

export default fp(async (fastify) => {
  fastify.addHook("preHandler", async (request, _reply) => {
    const path = request.url.split("?")[0];

    // Public routes and auth endpoints don't require tokens
    if (path.startsWith("/api/v1/public/") || path.startsWith("/api/v1/auth/")) {
      return;
    }

    // For admin and me endpoints, require auth.
    // `/api/v1/me` has no trailing slash, so it needs its own check.
    if (
      path.startsWith("/api/v1/admin/") ||
      path.startsWith("/api/v1/me/") ||
      path === "/api/v1/me"
    ) {
      const token = extractToken(request);
      if (!token) {
        throw new UnauthorizedError("Missing authorization token");
      }

      try {
        const decoded = verifyAccessToken(token);
        request.user = {
          id: decoded.sub,
          role: decoded.role,
          editorModules: decoded.editorModules || [],
        };
      } catch (error) {
        throw new UnauthorizedError("Invalid or expired token");
      }
    }
  });
});
