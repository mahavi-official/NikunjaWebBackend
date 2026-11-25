import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import { buildSeo, buildScholarlyArticleJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo";
import { truncateText } from "@/lib/sanitize";
import { checkUpload } from "@/lib/upload-validation";
import researchService from "./research.service";
import {
  CreateResearchInput,
  UpdateResearchInput,
  listResearchSchema,
} from "./research.schema";

export const researchController = {
  async createResearch(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateResearchInput;

    const research = await researchService.createResearch(request.server.prisma, data);

    await createAuditLog(
      request.server.prisma,
      request,
      "research.create",
      "research",
      research.id
    );

    return reply.status(201).send(successResponse(research));
  },

  async listResearch(request: FastifyRequest, reply: FastifyReply) {
    const query = listResearchSchema.parse(request.query);

    const { research, total } = await researchService.listResearch(
      request.server.prisma,
      query,
      false
    );

    return reply.send(
      successResponse({ research }, paginationMeta(query.page, query.limit, total))
    );
  },

  async listPublicResearch(request: FastifyRequest, reply: FastifyReply) {
    const query = listResearchSchema.parse(request.query);

    const { research, total } = await researchService.listResearch(
      request.server.prisma,
      query,
      true
    );

    return reply.send(
      successResponse({ research }, paginationMeta(query.page, query.limit, total))
    );
  },

  async getResearch(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const research = await researchService.getResearch(request.server.prisma, id);

    return reply.send(successResponse(research));
  },

  async getPublicResearch(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const research = await researchService.getResearchBySlug(
      request.server.prisma,
      slug
    );

    const seo = buildSeo(
      research.metaTitle || research.title,
      research.metaDescription || truncateText(research.abstract, 155),
      `/research/${research.slug}`,
      research.ogImage?.url,
      research.noIndex,
      "article",
      research.publishedAt?.toISOString(),
      research.updatedAt.toISOString()
    );

    seo.jsonLd = [
      buildScholarlyArticleJsonLd({
        title: research.title,
        abstract: research.abstract,
        authors: research.authors.map((a) => a.author.name),
        datePublished: research.publishedAt?.toISOString() || "",
        doi: research.doi || undefined,
        journal: research.journal || undefined,
        image: research.ogImage?.url,
        url: seo.canonical,
      }),
      buildBreadcrumbJsonLd([
        { name: "Home", url: seo.canonical.split("/").slice(0, 3).join("/") },
        { name: research.title, url: seo.canonical },
      ]),
    ];

    // File list WITHOUT urls — gated access only
    const files = research.files.map((f) => ({
      id: f.id,
      label: f.label,
      fileName: f.fileName,
      sizeBytes: f.sizeBytes,
      pageCount: f.pageCount,
    }));

    const { extractedText: _extractedText, files: _files, ...rest } = research;

    return reply.send(successResponse({ research: { ...rest, files }, seo }));
  },

  async getViewUrl(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const { fileId } = request.query as { fileId?: string };

    const result = await researchService.getGatedViewUrl(
      request.server.prisma,
      slug,
      request.user!.id,
      fileId,
      request.ip
    );

    return reply.send(successResponse(result));
  },

  async updateResearch(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateResearchInput;

    const research = await researchService.updateResearch(
      request.server.prisma,
      id,
      data
    );

    await createAuditLog(
      request.server.prisma,
      request,
      "research.update",
      "research",
      research.id
    );

    return reply.send(successResponse(research));
  },

  async publishResearch(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const research = await researchService.publishResearch(request.server.prisma, id);

    await createAuditLog(
      request.server.prisma,
      request,
      "research.publish",
      "research",
      research.id
    );

    return reply.send(successResponse(research));
  },

  async unpublishResearch(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const research = await researchService.unpublishResearch(request.server.prisma, id);

    await createAuditLog(
      request.server.prisma,
      request,
      "research.unpublish",
      "research",
      research.id
    );

    return reply.send(successResponse(research));
  },

  async deleteResearch(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await researchService.deleteResearch(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "research.delete", "research", id);

    return reply.send(successResponse({ message: "Research deleted" }));
  },

  async uploadFile(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const buffer = await data.toBuffer();

    // Symmetric with the media library. These blobs are private and only ever
    // handed out through a SAS URL, but a "PDF" that is really HTML would
    // still open as a document in the reader's browser, so the type is read
    // from the bytes rather than taken from the client.
    const check = await checkUpload(buffer, "document");
    if (!check.ok) {
      return reply.status(check.status).send({ error: check.error });
    }

    const label = (data.fields.label as any)?.value || data.filename;

    const file = await researchService.uploadResearchFile(
      request.server.prisma,
      id,
      buffer,
      data.filename,
      check.mimeType,
      label
    );

    await createAuditLog(
      request.server.prisma,
      request,
      "research.file_upload",
      "research",
      id,
      { fileName: file.fileName }
    );

    return reply.status(201).send(successResponse(file));
  },

  async deleteFile(request: FastifyRequest, reply: FastifyReply) {
    const { fileId } = request.params as { fileId: string };

    await researchService.deleteResearchFile(request.server.prisma, fileId);

    await createAuditLog(
      request.server.prisma,
      request,
      "research.file_delete",
      "researchFile",
      fileId
    );

    return reply.send(successResponse({ message: "File deleted" }));
  },
};
