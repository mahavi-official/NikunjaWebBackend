import { FastifyInstance } from "fastify";
import { authorsController } from "./authors.controller";
import { requirePermission } from "@/plugins/rbac";

export async function registerAuthorsRoutes(fastify: FastifyInstance) {
  fastify.get("/public/authors", (request, reply) =>
    authorsController.listAuthors(request, reply)
  );

  fastify.get("/public/authors/:slug", (request, reply) =>
    authorsController.getPublicAuthor(request, reply)
  );

  fastify.post(
    "/admin/authors",
    { preHandler: requirePermission("research") },
    (request, reply) => authorsController.createAuthor(request, reply)
  );

  fastify.get(
    "/admin/authors",
    { preHandler: requirePermission("research") },
    (request, reply) => authorsController.listAuthors(request, reply)
  );

  fastify.get(
    "/admin/authors/:id",
    { preHandler: requirePermission("research") },
    (request, reply) => authorsController.getAuthor(request, reply)
  );

  fastify.patch(
    "/admin/authors/:id",
    { preHandler: requirePermission("research") },
    (request, reply) => authorsController.updateAuthor(request, reply)
  );

  fastify.delete(
    "/admin/authors/:id",
    { preHandler: requirePermission("research") },
    (request, reply) => authorsController.deleteAuthor(request, reply)
  );
}
