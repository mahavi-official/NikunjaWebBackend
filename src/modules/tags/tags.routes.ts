import { FastifyInstance } from "fastify";
import { tagsController } from "./tags.controller";
import { requirePermission } from "@/plugins/rbac";

export async function registerTagsRoutes(fastify: FastifyInstance) {
  fastify.get("/public/tags", (request, reply) =>
    tagsController.listTags(request, reply)
  );

  fastify.post(
    "/admin/tags",
    { preHandler: requirePermission("posts") },
    (request, reply) => tagsController.createTag(request, reply)
  );

  fastify.get(
    "/admin/tags",
    { preHandler: requirePermission("posts") },
    (request, reply) => tagsController.listTags(request, reply)
  );

  fastify.get(
    "/admin/tags/:id",
    { preHandler: requirePermission("posts") },
    (request, reply) => tagsController.getTag(request, reply)
  );

  fastify.patch(
    "/admin/tags/:id",
    { preHandler: requirePermission("posts") },
    (request, reply) => tagsController.updateTag(request, reply)
  );

  fastify.delete(
    "/admin/tags/:id",
    { preHandler: requirePermission("posts") },
    (request, reply) => tagsController.deleteTag(request, reply)
  );
}
