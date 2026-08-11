import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import settingsService from "./settings.service";

export const settingsController = {
  async getPublicSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = await settingsService.getPublic(request.server.prisma);

    return reply.send(successResponse({ settings }));
  },

  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = await settingsService.getAll(request.server.prisma);

    return reply.send(successResponse({ settings }));
  },

  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const entries = request.body as Record<string, any>;

    await settingsService.upsertMany(request.server.prisma, entries);

    await createAuditLog(request.server.prisma, request, "settings.update", "setting", undefined, {
      keys: Object.keys(entries),
    });

    const settings = await settingsService.getAll(request.server.prisma);

    return reply.send(successResponse({ settings }));
  },
};
