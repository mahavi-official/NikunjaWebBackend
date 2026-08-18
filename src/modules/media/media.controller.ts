import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import mediaService from "./media.service";
import { MediaUpdateInput } from "./media.schema";

export const mediaController = {
  async uploadMedia(request: FastifyRequest, reply: FastifyReply) {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const buffer = await data.toBuffer();
    const folder = (request.query as any).folder || "/";

    const media = await mediaService.uploadMedia(
      request.server.prisma,
      buffer,
      data.filename,
      data.mimetype,
      folder,
      request.user!.id
    );

    await createAuditLog(request.server.prisma, request, "media.upload", "media", media.id, {
      fileName: media.fileName,
      sizeBytes: media.sizeBytes,
    });

    return reply.status(201).send(
      successResponse({
        id: media.id,
        url: media.url,
        fileName: media.fileName,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        width: media.width,
        height: media.height,
        folder: media.folder,
        createdAt: media.createdAt,
      })
    );
  },

  async listMedia(request: FastifyRequest, reply: FastifyReply) {
    const { folder, page = "1", limit = "20" } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const { media, total } = await mediaService.listMedia(
      request.server.prisma,
      folder,
      skip,
      limitNum
    );

    return reply.send(
      successResponse(
        {
          media: media.map((m) => ({
            id: m.id,
            url: m.url,
            fileName: m.fileName,
            mimeType: m.mimeType,
            sizeBytes: m.sizeBytes,
            width: m.width,
            height: m.height,
            alt: m.alt,
            folder: m.folder,
            createdAt: m.createdAt,
          })),
        },
        paginationMeta(pageNum, limitNum, total)
      )
    );
  },

  async getMedia(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const media = await mediaService.getMedia(request.server.prisma, id);

    return reply.send(
      successResponse({
        id: media.id,
        url: media.url,
        fileName: media.fileName,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        width: media.width,
        height: media.height,
        alt: media.alt,
        folder: media.folder,
        variants: media.variants,
        createdAt: media.createdAt,
      })
    );
  },

  async updateMedia(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as MediaUpdateInput;

    const media = await mediaService.updateMedia(request.server.prisma, id, data);

    await createAuditLog(request.server.prisma, request, "media.update", "media", media.id);

    return reply.send(
      successResponse({
        id: media.id,
        url: media.url,
        fileName: media.fileName,
        alt: media.alt,
        folder: media.folder,
      })
    );
  },

  async deleteMedia(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await mediaService.deleteMedia(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "media.delete", "media", id);

    return reply.send(successResponse({ message: "Media deleted" }));
  },
};
