import { FastifyInstance } from "fastify";
import { engagementController } from "./engagement.controller";
import { requireRole } from "@/plugins/rbac";

export async function registerEngagementRoutes(fastify: FastifyInstance) {
  fastify.get("/public/comments", (request, reply) =>
    engagementController.listComments(request, reply)
  );

  fastify.post("/me/posts/:id/like", (request, reply) =>
    engagementController.likePost(request, reply)
  );

  fastify.delete("/me/posts/:id/like", (request, reply) =>
    engagementController.unlikePost(request, reply)
  );

  fastify.post("/me/comments", (request, reply) =>
    engagementController.createComment(request, reply)
  );

  fastify.patch("/me/comments/:id", (request, reply) =>
    engagementController.updateComment(request, reply)
  );

  fastify.delete("/me/comments/:id", (request, reply) =>
    engagementController.deleteComment(request, reply)
  );

  fastify.post(
    "/admin/comments/:id/hide",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    (request, reply) => engagementController.hideComment(request, reply)
  );

  fastify.delete(
    "/admin/comments/:id",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    (request, reply) => engagementController.deleteComment(request, reply)
  );
}
