import { FastifyInstance } from "fastify";
import { heroController } from "./hero.controller";
import { requireRole } from "@/plugins/rbac";

export async function registerHeroRoutes(fastify: FastifyInstance) {
  fastify.get("/public/hero", (request, reply) =>
    heroController.listPublicSlides(request, reply)
  );

  fastify.post(
    "/admin/hero",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    (request, reply) => heroController.createSlide(request, reply)
  );

  fastify.get(
    "/admin/hero",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    (request, reply) => heroController.listSlides(request, reply)
  );

  fastify.patch(
    "/admin/hero/:id",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    (request, reply) => heroController.updateSlide(request, reply)
  );

  fastify.delete(
    "/admin/hero/:id",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    (request, reply) => heroController.deleteSlide(request, reply)
  );
}
