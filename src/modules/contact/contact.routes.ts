import { FastifyInstance } from "fastify";
import { contactController } from "./contact.controller";
import { requireRole } from "@/plugins/rbac";

export async function registerContactRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/public/contact",
    {
      config: {
        rateLimit: { max: 3, timeWindow: "1 hour" },
      },
    },
    (request, reply) => contactController.submitMessage(request, reply)
  );

  fastify.get(
    "/admin/contact-messages",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => contactController.listMessages(request, reply)
  );

  fastify.patch(
    "/admin/contact-messages/:id/read",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => contactController.markRead(request, reply)
  );

  fastify.get(
    "/admin/contact-messages/export.csv",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => contactController.exportCsv(request, reply)
  );
}
