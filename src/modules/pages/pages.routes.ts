import { FastifyInstance } from "fastify";
import { pagesController } from "./pages.controller";
import { requireRole } from "@/plugins/rbac";

export async function registerPagesRoutes(fastify: FastifyInstance) {
  fastify.get("/public/pages/:key", (request, reply) =>
    pagesController.getPublicPage(request, reply)
  );

  fastify.get(
    "/admin/pages/:key",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    (request, reply) => pagesController.getPage(request, reply)
  );

  fastify.patch(
    "/admin/pages/:key",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    (request, reply) => pagesController.upsertPage(request, reply)
  );
}
