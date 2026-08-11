import { FastifyInstance } from "fastify";
import { newsletterController } from "./newsletter.controller";
import { requireRole } from "@/plugins/rbac";

export async function registerNewsletterRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/public/newsletter/subscribe",
    {
      config: {
        rateLimit: { max: 3, timeWindow: "1 hour" },
      },
    },
    (request, reply) => newsletterController.subscribe(request, reply)
  );

  fastify.get("/public/newsletter/unsubscribe/:token", (request, reply) =>
    newsletterController.unsubscribe(request, reply)
  );

  fastify.get(
    "/admin/newsletter",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => newsletterController.listSubscribers(request, reply)
  );

  fastify.get(
    "/admin/newsletter/export.csv",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    (request, reply) => newsletterController.exportCsv(request, reply)
  );
}
