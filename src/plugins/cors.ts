import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { env } from "@/config/env";

async function corsPlugin(fastify: FastifyInstance) {
  const origins = env.CORS_ORIGINS.split(",").map((o) => o.trim());

  await fastify.register(cors, {
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  console.log(`✓ CORS configured for origins: ${origins.join(", ")}`);
}

export default fp(corsPlugin);
