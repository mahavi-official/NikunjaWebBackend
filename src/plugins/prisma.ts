import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

export async function prismaPlugin(fastify: FastifyInstance) {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  await prisma.$connect();
  console.log("✓ Connected to database");

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
    console.log("✓ Disconnected from database");
  });
}

export default fp(prismaPlugin);

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
