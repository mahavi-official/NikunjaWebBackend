import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import heroService from "./hero.service";
import { CreateSlideInput, UpdateSlideInput } from "./hero.schema";

export const heroController = {
  async createSlide(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateSlideInput;

    const slide = await heroService.createSlide(request.server.prisma, data);

    await createAuditLog(request.server.prisma, request, "hero.create", "heroSlide", slide.id);

    return reply.status(201).send(successResponse(slide));
  },

  async listSlides(request: FastifyRequest, reply: FastifyReply) {
    const slides = await heroService.listSlides(request.server.prisma, false);

    return reply.send(successResponse({ slides }));
  },

  async listPublicSlides(request: FastifyRequest, reply: FastifyReply) {
    const slides = await heroService.listSlides(request.server.prisma, true);

    return reply.send(successResponse({ slides }));
  },

  async updateSlide(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateSlideInput;

    const slide = await heroService.updateSlide(request.server.prisma, id, data);

    await createAuditLog(request.server.prisma, request, "hero.update", "heroSlide", slide.id);

    return reply.send(successResponse(slide));
  },

  async deleteSlide(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await heroService.deleteSlide(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "hero.delete", "heroSlide", id);

    return reply.send(successResponse({ message: "Slide deleted" }));
  },
};
