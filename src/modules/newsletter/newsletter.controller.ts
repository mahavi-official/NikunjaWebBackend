import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { successResponse, paginationMeta } from "@/lib/response";
import newsletterService from "./newsletter.service";

const subscribeSchema = z.object({ email: z.string().email() });

export const newsletterController = {
  async subscribe(request: FastifyRequest, reply: FastifyReply) {
    const { email } = subscribeSchema.parse(request.body);

    await newsletterService.subscribe(request.server.prisma, email, request.ip);

    return reply.status(201).send(successResponse({ message: "Subscribed" }));
  },

  async unsubscribe(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.params as { token: string };

    await newsletterService.unsubscribe(request.server.prisma, token);

    return reply.send(successResponse({ message: "Unsubscribed" }));
  },

  async listSubscribers(request: FastifyRequest, reply: FastifyReply) {
    const { page = "1", limit = "50" } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const { subscribers, total } = await newsletterService.listSubscribers(
      request.server.prisma,
      skip,
      limitNum
    );

    return reply.send(
      successResponse({ subscribers }, paginationMeta(pageNum, limitNum, total))
    );
  },

  async exportCsv(request: FastifyRequest, reply: FastifyReply) {
    const csv = await newsletterService.exportCsv(request.server.prisma);

    return reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="subscribers.csv"')
      .send(csv);
  },
};
