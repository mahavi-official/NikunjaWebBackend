import { buildApp } from "@/server";
import { env } from "@/config/env";

async function start() {
  const fastify = await buildApp();

  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`\n🚀 Server listening on ${env.API_URL}`);
    console.log(`📊 Health: http://localhost:${env.PORT}/health`);
    console.log(`📋 Ready: http://localhost:${env.PORT}/health/ready\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  console.log("\n⏹️  SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\n⏹️  SIGINT received, shutting down gracefully...");
  process.exit(0);
});

start();
