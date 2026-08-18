import fp from "fastify-plugin";
import { FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export type Role = "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "MEMBER";

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest) => {
    if (!request.user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (!roles.includes(request.user.role as Role)) {
      throw new ForbiddenError("Insufficient permissions");
    }
  };
}

export function requirePermission(...modules: string[]) {
  return async (request: FastifyRequest) => {
    if (!request.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const role = request.user.role as Role;

    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      return;
    }

    if (role === "EDITOR") {
      const hasAccess = modules.some((m) => request.user!.editorModules.includes(m));
      if (!hasAccess) {
        throw new ForbiddenError("No access to this module");
      }
    } else {
      throw new ForbiddenError("Insufficient permissions");
    }
  };
}

export default fp(async () => {
  // Plugin registers the guard functions as utilities
});
