import { FastifyInstance } from "fastify";
import { usersController } from "./users.controller";
import { requireRole } from "@/plugins/rbac";

export async function registerUsersRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/admin/users",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => usersController.createUser(request, reply)
  );

  fastify.get(
    "/admin/users",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => usersController.listUsers(request, reply)
  );

  fastify.get(
    "/admin/users/:id",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => usersController.getUser(request, reply)
  );

  fastify.patch(
    "/admin/users/:id",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => usersController.updateUser(request, reply)
  );

  fastify.post(
    "/admin/users/:id/suspend",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => usersController.suspendUser(request, reply)
  );

  fastify.post(
    "/admin/users/:id/activate",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => usersController.activateUser(request, reply)
  );

  fastify.get(
    "/me/sessions",
    (request, reply) => usersController.getSessions(request, reply)
  );

  fastify.delete(
    "/me/sessions/:id",
    (request, reply) => usersController.revokeSession(request, reply)
  );
}
