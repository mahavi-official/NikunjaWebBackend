import { FastifyInstance } from "fastify";
import { mediaController } from "./media.controller";
import { requirePermission } from "@/plugins/rbac";

export async function registerMediaRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/admin/media/upload",
    { preHandler: requirePermission("media") },
    (request, reply) => mediaController.uploadMedia(request, reply)
  );

  fastify.get(
    "/admin/media",
    { preHandler: requirePermission("media") },
    (request, reply) => mediaController.listMedia(request, reply)
  );

  fastify.get(
    "/admin/media/:id",
    { preHandler: requirePermission("media") },
    (request, reply) => mediaController.getMedia(request, reply)
  );

  fastify.patch(
    "/admin/media/:id",
    { preHandler: requirePermission("media") },
    (request, reply) => mediaController.updateMedia(request, reply)
  );

  fastify.delete(
    "/admin/media/:id",
    { preHandler: requirePermission("media") },
    (request, reply) => mediaController.deleteMedia(request, reply)
  );
}
