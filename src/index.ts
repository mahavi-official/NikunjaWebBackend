import { buildApp } from "@/server";
import { env } from "@/config/env";
import { scheduleBackup } from "@/jobs/backup";
import { schedulePruning } from "@/jobs/pruneAuditLogs";
import { ensureSuperAdminOrExit } from "@/lib/ensureSuperAdmin";

async function start() {
  const fastify = await buildApp();

  // Runs before listen so the instance never serves traffic without an
  // administrable account. Idempotent — safe on every restart.
  await ensureSuperAdminOrExit(fastify.prisma, {
    info: (msg) => fastify.log.info(msg),
    error: (msg) => fastify.log.error(msg),
  });

  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });

    scheduleBackup();
    schedulePruning(fastify.prisma);
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
