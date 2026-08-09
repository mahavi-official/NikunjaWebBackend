import Fastify, { FastifyZodInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import corsPlugin from "@/plugins/cors";
import helmetPlugin from "@/plugins/helmet";
import rateLimitPlugin from "@/plugins/rateLimit";
import errorHandlerPlugin from "@/plugins/errorHandler";
import prismaPlugin from "@/plugins/prisma";
import loggerPlugin, { createLogger } from "@/plugins/logger";
import { env } from "@/config/env";
import { API_PREFIX } from "@/config/constants";

export async function buildApp() {
  const fastify = Fastify({
    logger: createLogger(),
    requestIdLogLabel: "req.id",
    disableRequestLogging: false,
    requestTimeout: 30000,
  }).withTypeProvider<ZodTypeProvider>();

  await fastify.register(errorHandlerPlugin);
  await fastify.register(loggerPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(cookie);
  await fastify.register(multipart);
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: "Radhakundah Platform API",
        description: "REST API for the Radhakundah content hub",
        version: "1.0.0",
      },
      host: env.API_URL.replace(/https?:\/\//, "").split(":")[0],
      schemes: [env.API_URL.startsWith("https") ? "https" : "http"],
      consumes: ["application/json"],
      produces: ["application/json"],
    },
  });
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
  });

  fastify.get("/health", async (_request, reply) => {
    return reply.send({ status: "ok", timestamp: new Date().toISOString() });
  });

  fastify.get("/health/ready", async (request, reply) => {
    try {
      await request.server.prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: "ready", timestamp: new Date().toISOString() });
    } catch (error) {
      return reply.status(503).send({ status: "not ready", error: "Database connection failed" });
    }
  });

  fastify.get(`${API_PREFIX}/`, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        name: "Radhakundah Platform API",
        version: "1.0.0",
        environment: env.NODE_ENV,
      },
    });
  });

  return fastify as FastifyZodInstance;
}

export type FastifyZodInstance = FastifyZodInstance;
