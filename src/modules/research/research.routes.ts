import { FastifyInstance } from "fastify";
import { researchController } from "./research.controller";
import { requirePermission } from "@/plugins/rbac";

export async function registerResearchRoutes(fastify: FastifyInstance) {
  fastify.get("/public/research", (request, reply) =>
    researchController.listPublicResearch(request, reply)
  );

  fastify.get("/public/research/:slug", (request, reply) =>
    researchController.getPublicResearch(request, reply)
  );

  fastify.get("/me/research/:slug/view-url", (request, reply) =>
    researchController.getViewUrl(request, reply)
  );

  fastify.post(
    "/admin/research",
    { preHandler: requirePermission("research") },
    (request, reply) => researchController.createResearch(request, reply)
  );

  fastify.get(
    "/admin/research",
    { preHandler: requirePermission("research") },
    (request, reply) => researchController.listResearch(request, reply)
  );

  fastify.get(
    "/admin/research/:id",
    { preHandler: requirePermission("research") },
    (request, reply) => researchController.getResearch(request, reply)
  );

  fastify.patch(
    "/admin/research/:id",
    { preHandler: requirePermission("research") },
    (request, reply) => researchController.updateResearch(request, reply)
  );

  fastify.delete(
    "/admin/research/:id",
    { preHandler: requirePermission("research") },
    (request, reply) => researchController.deleteResearch(request, reply)
  );

  fastify.post(
    "/admin/research/:id/publish",
    { preHandler: requirePermission("research") },
    (request, reply) => researchController.publishResearch(request, reply)
  );

  fastify.post(
    "/admin/research/:id/unpublish",
    { preHandler: requirePermission("research") },
    (request, reply) => researchController.unpublishResearch(request, reply)
  );

  fastify.post(
    "/admin/research/:id/files",
    { preHandler: requirePermission("research") },
    (request, reply) => researchController.uploadFile(request, reply)
  );

  fastify.delete(
    "/admin/research/files/:fileId",
    { preHandler: requirePermission("research") },
    (request, reply) => researchController.deleteFile(request, reply)
  );
}
