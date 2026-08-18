import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import { buildSeo, buildVideoJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo";
import videosService from "./videos.service";
import {
  CreateVideoInput,
  UpdateVideoInput,
  CreateVideoCategoryInput,
  listVideosSchema,
} from "./videos.schema";

export const videosController = {
  async createVideo(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateVideoInput;

    const video = await videosService.createVideo(request.server.prisma, data);

    await createAuditLog(request.server.prisma, request, "video.create", "video", video.id);

    return reply.status(201).send(successResponse(video));
  },

  async listVideos(request: FastifyRequest, reply: FastifyReply) {
    const query = listVideosSchema.parse(request.query);

    const { videos, total } = await videosService.listVideos(
      request.server.prisma,
      query,
      false
    );

    return reply.send(
      successResponse({ videos }, paginationMeta(query.page, query.limit, total))
    );
  },

  async listPublicVideos(request: FastifyRequest, reply: FastifyReply) {
    const query = listVideosSchema.parse(request.query);

    const { videos, total } = await videosService.listVideos(
      request.server.prisma,
      query,
      true
    );

    return reply.send(
      successResponse({ videos }, paginationMeta(query.page, query.limit, total))
    );
  },

  async getVideo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const video = await videosService.getVideo(request.server.prisma, id);

    return reply.send(successResponse(video));
  },

  async getPublicVideo(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const video = await videosService.getVideoBySlug(request.server.prisma, slug);

    const seo = buildSeo(
      video.metaTitle || video.title,
      video.metaDescription || video.description || video.title,
      `/videos/${video.slug}`,
      video.thumbnailUrl,
      video.noIndex,
      "video.other",
      video.publishedAt?.toISOString(),
      video.updatedAt.toISOString()
    );

    seo.jsonLd = [
      buildVideoJsonLd({
        title: video.title,
        description: video.description || "",
        thumbnailUrl: video.thumbnailUrl,
        uploadDate: video.publishedAt?.toISOString() || "",
        duration: video.durationSec ? `PT${video.durationSec}S` : undefined,
        embedUrl: `https://www.youtube.com/embed/${video.youtubeId}`,
      }),
      buildBreadcrumbJsonLd([
        { name: "Home", url: seo.canonical.split("/").slice(0, 3).join("/") },
        { name: video.title, url: seo.canonical },
      ]),
    ];

    return reply.send(successResponse({ video, seo }));
  },

  async updateVideo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateVideoInput;

    const video = await videosService.updateVideo(request.server.prisma, id, data);

    await createAuditLog(request.server.prisma, request, "video.update", "video", video.id);

    return reply.send(successResponse(video));
  },

  async publishVideo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const video = await videosService.publishVideo(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "video.publish", "video", video.id);

    return reply.send(successResponse(video));
  },

  async unpublishVideo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const video = await videosService.unpublishVideo(request.server.prisma, id);

    await createAuditLog(
      request.server.prisma,
      request,
      "video.unpublish",
      "video",
      video.id
    );

    return reply.send(successResponse(video));
  },

  async deleteVideo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await videosService.deleteVideo(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "video.delete", "video", id);

    return reply.send(successResponse({ message: "Video deleted" }));
  },

  async incrementView(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };

    await videosService.incrementViewCount(request.server.prisma, slug);

    return reply.send(successResponse({ ok: true }));
  },

  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateVideoCategoryInput;

    const category = await videosService.createCategory(request.server.prisma, data);

    await createAuditLog(
      request.server.prisma,
      request,
      "videoCategory.create",
      "videoCategory",
      category.id
    );

    return reply.status(201).send(successResponse(category));
  },

  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    const categories = await videosService.listCategories(request.server.prisma);

    return reply.send(successResponse({ categories }));
  },

  async deleteCategory(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await videosService.deleteCategory(request.server.prisma, id);

    await createAuditLog(
      request.server.prisma,
      request,
      "videoCategory.delete",
      "videoCategory",
      id
    );

    return reply.send(successResponse({ message: "Video category deleted" }));
  },
};
