import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import tagsService from "./tags.service";
import { CreateTagInput, UpdateTagInput } from "./tags.schema";

export const tagsController = {
  async createTag(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateTagInput;

    const tag = await tagsService.createTag(request.server.prisma, data);

    await createAuditLog(request.server.prisma, request, "tag.create", "tag", tag.id);

    return reply.status(201).send(successResponse(tag));
  },

  async listTags(request: FastifyRequest, reply: FastifyReply) {
    const { page = "1", limit = "50" } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const { tags, total } = await tagsService.listTags(
      request.server.prisma,
      skip,
      limitNum
    );

    return reply.send(successResponse({ tags }, paginationMeta(pageNum, limitNum, total)));
  },

  async getTag(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const tag = await tagsService.getTag(request.server.prisma, id);

    return reply.send(successResponse(tag));
  },

  async updateTag(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateTagInput;

    const tag = await tagsService.updateTag(request.server.prisma, id, data);

    await createAuditLog(request.server.prisma, request, "tag.update", "tag", tag.id);

    return reply.send(successResponse(tag));
  },

  async deleteTag(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await tagsService.deleteTag(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "tag.delete", "tag", id);

    return reply.send(successResponse({ message: "Tag deleted" }));
  },
};
