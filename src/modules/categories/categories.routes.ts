import { FastifyInstance } from "fastify";
import { categoriesController } from "./categories.controller";
import { requirePermission } from "@/plugins/rbac";

export async function registerCategoriesRoutes(fastify: FastifyInstance) {
  fastify.get("/public/categories", (request, reply) =>
    categoriesController.listCategories(request, reply)
  );

  fastify.post(
    "/admin/categories",
    { preHandler: requirePermission("posts") },
    (request, reply) => categoriesController.createCategory(request, reply)
  );

  fastify.get(
    "/admin/categories",
    { preHandler: requirePermission("posts") },
    (request, reply) => categoriesController.listCategories(request, reply)
  );

  fastify.get(
    "/admin/categories/:id",
    { preHandler: requirePermission("posts") },
    (request, reply) => categoriesController.getCategory(request, reply)
  );

  fastify.patch(
    "/admin/categories/:id",
    { preHandler: requirePermission("posts") },
    (request, reply) => categoriesController.updateCategory(request, reply)
  );

  fastify.delete(
    "/admin/categories/:id",
    { preHandler: requirePermission("posts") },
    (request, reply) => categoriesController.deleteCategory(request, reply)
  );
}
