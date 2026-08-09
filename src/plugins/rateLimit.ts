import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import { RATE_LIMITS } from "@/config/constants";

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    max: RATE_LIMITS.GLOBAL_PER_MINUTE,
    timeWindow: "1 minute",
    cache: 10000,
    allowList: ["127.0.0.1", "localhost"],
    redis: undefined,
    skipOnError: true,
    keyGenerator: (request) => {
      return request.ip || "unknown";
    },
  });

  console.log("✓ Rate limiting configured");
}

export default fp(rateLimitPlugin);
