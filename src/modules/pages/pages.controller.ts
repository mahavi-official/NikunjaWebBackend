import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import { buildSeo } from "@/lib/seo";
import pagesService from "./pages.service";
import { UpsertPageInput } from "./pages.schema";

export const pagesController = {
  async getPublicPage(request: FastifyRequest, reply: FastifyReply) {
    const { key } = request.params as { key: string };
    const page = await pagesService.getPage(request.server.prisma, key);

    const seo = buildSeo(
      page.metaTitle || page.title,
      page.metaDescription || page.title,
      `/${key}`,
      undefined,
      page.noIndex
    );

    return reply.send(successResponse({ page, seo }));
  },

  async getPage(request: FastifyRequest, reply: FastifyReply) {
    const { key } = request.params as { key: string };
    const page = await pagesService.getPage(request.server.prisma, key);

    return reply.send(successResponse(page));
  },

  async upsertPage(request: FastifyRequest, reply: FastifyReply) {
    const { key } = request.params as { key: string };
    const data = request.body as UpsertPageInput;

    const page = await pagesService.upsertPage(request.server.prisma, key, data);

    await createAuditLog(request.server.prisma, request, "page.update", "page", page.id);

    return reply.send(successResponse(page));
  },
};
