import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import contactService from "./contact.service";
import { submitContactSchema, listMessagesSchema } from "./contact.schema";

export const contactController = {
  async submitMessage(request: FastifyRequest, reply: FastifyReply) {
    const data = submitContactSchema.parse(request.body);

    await contactService.submitMessage(request.server.prisma, data, request.ip);

    return reply.status(201).send(
      successResponse({ message: "Thank you for your message" })
    );
  },

  async listMessages(request: FastifyRequest, reply: FastifyReply) {
    const query = listMessagesSchema.parse(request.query);

    const { messages, total } = await contactService.listMessages(
      request.server.prisma,
      query
    );

    return reply.send(
      successResponse({ messages }, paginationMeta(query.page, query.limit, total))
    );
  },

  async markRead(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const message = await contactService.markRead(request.server.prisma, id);

    await createAuditLog(
      request.server.prisma,
      request,
      "contact.mark_read",
      "contactMessage",
      id
    );

    return reply.send(successResponse(message));
  },

  async exportCsv(request: FastifyRequest, reply: FastifyReply) {
    const csv = await contactService.exportCsv(request.server.prisma);

    return reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="contact-messages.csv"')
      .send(csv);
  },
};
