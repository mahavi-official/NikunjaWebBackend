import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import { buildSeo, buildBreadcrumbJsonLd } from "@/lib/seo";
import galleryService from "./gallery.service";
import {
  CreateSegmentInput,
  UpdateSegmentInput,
  AddImagesInput,
  ReorderInput,
} from "./gallery.schema";

export const galleryController = {
  async createSegment(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateSegmentInput;

    const segment = await galleryService.createSegment(request.server.prisma, data);

    await createAuditLog(
      request.server.prisma,
      request,
      "gallery.create",
      "gallerySegment",
      segment.id
    );

    return reply.status(201).send(successResponse(segment));
  },

  async listSegments(request: FastifyRequest, reply: FastifyReply) {
    const { page = "1", limit = "50" } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const { segments, total } = await galleryService.listSegments(
      request.server.prisma,
      false,
      skip,
      limitNum
    );

    return reply.send(
      successResponse({ segments }, paginationMeta(pageNum, limitNum, total))
    );
  },

  async listPublicSegments(request: FastifyRequest, reply: FastifyReply) {
    const { page = "1", limit = "50" } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const { segments, total } = await galleryService.listSegments(
      request.server.prisma,
      true,
      skip,
      limitNum
    );

    return reply.send(
      successResponse({ segments }, paginationMeta(pageNum, limitNum, total))
    );
  },

  async getSegment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const segment = await galleryService.getSegment(request.server.prisma, id);

    return reply.send(successResponse(segment));
  },

  async getPublicSegment(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const segment = await galleryService.getSegmentBySlug(request.server.prisma, slug);

    const seo = buildSeo(
      segment.metaTitle || segment.name,
      segment.metaDescription || segment.description || `${segment.name} gallery`,
      `/gallery/${segment.slug}`,
      segment.coverImage?.url,
      segment.noIndex
    );

    seo.jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        name: segment.name,
        description: segment.description,
        image: segment.images.map((i) => i.media.url),
      },
      buildBreadcrumbJsonLd([
        { name: "Home", url: seo.canonical.split("/").slice(0, 3).join("/") },
        { name: segment.name, url: seo.canonical },
      ]),
    ];

    return reply.send(successResponse({ segment, seo }));
  },

  async updateSegment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateSegmentInput;

    const segment = await galleryService.updateSegment(request.server.prisma, id, data);

    await createAuditLog(
      request.server.prisma,
      request,
      "gallery.update",
      "gallerySegment",
      segment.id
    );

    return reply.send(successResponse(segment));
  },

  async deleteSegment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await galleryService.deleteSegment(request.server.prisma, id);

    await createAuditLog(
      request.server.prisma,
      request,
      "gallery.delete",
      "gallerySegment",
      id
    );

    return reply.send(successResponse({ message: "Segment deleted" }));
  },

  async addImages(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as AddImagesInput;

    const images = await galleryService.addImages(request.server.prisma, id, data);

    await createAuditLog(
      request.server.prisma,
      request,
      "gallery.add_images",
      "gallerySegment",
      id,
      { count: images.length }
    );

    return reply.status(201).send(successResponse({ images }));
  },

  async deleteImage(request: FastifyRequest, reply: FastifyReply) {
    const { imageId } = request.params as { imageId: string };

    await galleryService.deleteImage(request.server.prisma, imageId);

    await createAuditLog(
      request.server.prisma,
      request,
      "gallery.delete_image",
      "galleryImage",
      imageId
    );

    return reply.send(successResponse({ message: "Image deleted" }));
  },

  async reorderImages(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as ReorderInput;

    await galleryService.reorderImages(request.server.prisma, data);

    return reply.send(successResponse({ message: "Images reordered" }));
  },
};
