import { FastifyInstance } from "fastify";
import { settingsController } from "./settings.controller";
import { requireRole } from "@/plugins/rbac";

export async function registerSettingsRoutes(fastify: FastifyInstance) {
  fastify.get("/public/settings", (request, reply) =>
    settingsController.getPublicSettings(request, reply)
  );

  fastify.get(
    "/admin/settings",
    { preHandler: requireRole("SUPER_ADMIN") },
    (request, reply) => settingsController.getSettings(request, reply)
  );

  fastify.patch(
    "/admin/settings",
    { preHandler: requireRole("SUPER_ADMIN") },
    (request, reply) => settingsController.updateSettings(request, reply)
  );
}
