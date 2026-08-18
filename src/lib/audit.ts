import { PrismaClient } from "@prisma/client";
import { FastifyRequest } from "fastify";

export async function createAuditLog(
  prisma: PrismaClient,
  request: FastifyRequest,
  action: string,
  entityType?: string,
  entityId?: string,
  meta?: Record<string, any>,
  /** Actor override for endpoints that authenticate by cookie, where
   *  `request.user` is never populated — sign-in, refresh, sign-out. */
  actorId?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: request.user?.id ?? actorId,
        action,
        entityType,
        entityId,
        ip: request.ip,
        meta: meta || {},
      },
    });
  } catch (error) {
    console.error("Audit log creation error:", error);
  }
}

export async function logAuthEvent(
  prisma: PrismaClient,
  request: FastifyRequest,
  action: string,
  userId?: string,
  meta?: Record<string, any>
): Promise<void> {
  await createAuditLog(prisma, request, action, "auth", userId, meta, userId);
}

export async function logContentAction(
  prisma: PrismaClient,
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId: string,
  meta?: Record<string, any>
): Promise<void> {
  await createAuditLog(prisma, request, `${entityType}.${action}`, entityType, entityId, meta);
}
