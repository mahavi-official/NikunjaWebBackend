import { FastifyInstance } from "fastify";
import { authController } from "./auth.controller";

export async function registerAuthRoutes(fastify: FastifyInstance) {
  fastify.get("/auth/google", (request, reply) =>
    authController.googleStart(request, reply)
  );

  fastify.get("/auth/google/callback", (request, reply) =>
    authController.googleCallback(request, reply)
  );

  fastify.post("/auth/refresh", (request, reply) =>
    authController.refreshToken(request, reply)
  );

  fastify.post("/auth/logout", (request, reply) =>
    authController.logout(request, reply)
  );

  fastify.post("/auth/logout-all", (request, reply) =>
    authController.logoutAll(request, reply)
  );
}
