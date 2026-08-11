import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import engagementService from "./engagement.service";
import {
  CreateCommentInput,
  UpdateCommentInput,
  listCommentsSchema,
} from "./engagement.schema";

export const engagementController = {
  async likePost(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await engagementService.likePost(request.server.prisma, id, request.user!.id);

    const count = await engagementService.getLikeCount(request.server.prisma, id);

    return reply.send(successResponse({ liked: true, count }));
  },

  async unlikePost(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await engagementService.unlikePost(request.server.prisma, id, request.user!.id);

    const count = await engagementService.getLikeCount(request.server.prisma, id);

    return reply.send(successResponse({ liked: false, count }));
  },

  async createComment(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateCommentInput;

    const comment = await engagementService.createComment(
      request.server.prisma,
      data,
      request.user!.id
    );

    await createAuditLog(
      request.server.prisma,
      request,
      "comment.create",
      "comment",
      comment.id
    );

    return reply.status(201).send(successResponse(comment));
  },

  async listComments(request: FastifyRequest, reply: FastifyReply) {
    const query = listCommentsSchema.parse(request.query);

    const { comments, total } = await engagementService.listComments(
      request.server.prisma,
      query
    );

    return reply.send(
      successResponse({ comments }, paginationMeta(query.page, query.limit, total))
    );
  },

  async updateComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateCommentInput;

    const comment = await engagementService.updateComment(
      request.server.prisma,
      id,
      data,
      request.user!.id
    );

    return reply.send(successResponse(comment));
  },

  async deleteComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const isStaff = ["SUPER_ADMIN", "ADMIN", "EDITOR"].includes(request.user!.role);

    await engagementService.deleteComment(
      request.server.prisma,
      id,
      request.user!.id,
      isStaff
    );

    await createAuditLog(request.server.prisma, request, "comment.delete", "comment", id);

    return reply.send(successResponse({ message: "Comment deleted" }));
  },

  async hideComment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { isHidden = true } = request.body as { isHidden?: boolean };

    const comment = await engagementService.hideComment(
      request.server.prisma,
      id,
      isHidden
    );

    await createAuditLog(request.server.prisma, request, "comment.hide", "comment", id);

    return reply.send(successResponse(comment));
  },
};
