import { FastifyInstance } from "fastify";
import { videosController } from "./videos.controller";
import { requirePermission } from "@/plugins/rbac";

export async function registerVideosRoutes(fastify: FastifyInstance) {
  fastify.get("/public/videos", (request, reply) =>
    videosController.listPublicVideos(request, reply)
  );

  fastify.get("/public/videos/:slug", (request, reply) =>
    videosController.getPublicVideo(request, reply)
  );

  fastify.post("/public/videos/:slug/view", (request, reply) =>
    videosController.incrementView(request, reply)
  );

  fastify.get("/public/video-categories", (request, reply) =>
    videosController.listCategories(request, reply)
  );

  fastify.post(
    "/admin/videos",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.createVideo(request, reply)
  );

  fastify.get(
    "/admin/videos",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.listVideos(request, reply)
  );

  fastify.get(
    "/admin/videos/:id",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.getVideo(request, reply)
  );

  fastify.patch(
    "/admin/videos/:id",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.updateVideo(request, reply)
  );

  fastify.delete(
    "/admin/videos/:id",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.deleteVideo(request, reply)
  );

  fastify.post(
    "/admin/videos/:id/publish",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.publishVideo(request, reply)
  );

  fastify.post(
    "/admin/videos/:id/unpublish",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.unpublishVideo(request, reply)
  );

  fastify.post(
    "/admin/video-categories",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.createCategory(request, reply)
  );

  fastify.get(
    "/admin/video-categories",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.listCategories(request, reply)
  );

  fastify.delete(
    "/admin/video-categories/:id",
    { preHandler: requirePermission("videos") },
    (request, reply) => videosController.deleteCategory(request, reply)
  );
}
