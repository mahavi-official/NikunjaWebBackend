import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import { buildSeo } from "@/lib/seo";
import authorsService from "./authors.service";
import { CreateAuthorInput, UpdateAuthorInput } from "./authors.schema";

export const authorsController = {
  async createAuthor(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateAuthorInput;

    const author = await authorsService.createAuthor(request.server.prisma, data);

    await createAuditLog(request.server.prisma, request, "author.create", "author", author.id);

    return reply.status(201).send(successResponse(author));
  },

  async listAuthors(request: FastifyRequest, reply: FastifyReply) {
    const { page = "1", limit = "50" } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const { authors, total } = await authorsService.listAuthors(
      request.server.prisma,
      skip,
      limitNum
    );

    return reply.send(
      successResponse({ authors }, paginationMeta(pageNum, limitNum, total))
    );
  },

  async getAuthor(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const author = await authorsService.getAuthor(request.server.prisma, id);

    return reply.send(successResponse(author));
  },

  async getPublicAuthor(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const author = await authorsService.getAuthorBySlug(request.server.prisma, slug);

    const seo = buildSeo(
      author.metaTitle || author.name,
      author.metaDescription || author.bio || `Publications by ${author.name}`,
      `/authors/${author.slug}`,
      author.photo?.url,
      author.noIndex
    );

    seo.jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Person",
        name: author.name,
        affiliation: author.affiliation,
        description: author.bio,
        image: author.photo?.url,
      },
    ];

    return reply.send(successResponse({ author, seo }));
  },

  async updateAuthor(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateAuthorInput;

    const author = await authorsService.updateAuthor(request.server.prisma, id, data);

    await createAuditLog(request.server.prisma, request, "author.update", "author", author.id);

    return reply.send(successResponse(author));
  },

  async deleteAuthor(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await authorsService.deleteAuthor(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "author.delete", "author", id);

    return reply.send(successResponse({ message: "Author deleted" }));
  },
};
