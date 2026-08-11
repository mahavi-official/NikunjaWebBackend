import { FastifyRequest, FastifyReply } from "fastify";
import { CategoryScope } from "@prisma/client";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import categoriesService from "./categories.service";
import { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema";

export const categoriesController = {
  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateCategoryInput;

    const category = await categoriesService.createCategory(
      request.server.prisma,
      data.scope,
      data
    );

    await createAuditLog(
      request.server.prisma,
      request,
      "category.create",
      "category",
      category.id
    );

    return reply.status(201).send(successResponse(category));
  },

  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    const { scope = "ARTICLE", page = "1", limit = "50" } = request.query as Record<
      string,
      string
    >;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const { categories, total } = await categoriesService.listCategories(
      request.server.prisma,
      scope as CategoryScope,
      skip,
      limitNum
    );

    return reply.send(
      successResponse({ categories }, paginationMeta(pageNum, limitNum, total))
    );
  },

  async getCategory(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const category = await categoriesService.getCategory(request.server.prisma, id);

    return reply.send(successResponse(category));
  },

  async updateCategory(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateCategoryInput;

    const category = await categoriesService.updateCategory(
      request.server.prisma,
      id,
      data
    );

    await createAuditLog(
      request.server.prisma,
      request,
      "category.update",
      "category",
      category.id
    );

    return reply.send(successResponse(category));
  },

  async deleteCategory(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await categoriesService.deleteCategory(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "category.delete", "category", id);

    return reply.send(successResponse({ message: "Category deleted" }));
  },
};
