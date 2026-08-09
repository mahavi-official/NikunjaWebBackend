import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import pino from "pino";
import { env } from "@/config/env";

export function createLogger() {
  return pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              singleLine: false,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
  });
}

async function loggerPlugin(fastify: FastifyInstance) {
  const logger = createLogger();
  fastify.log = logger;
  console.log(`✓ Logger configured (level: ${env.LOG_LEVEL})`);
}

export default fp(loggerPlugin);
