import { FastifyInstance } from "fastify";
import { galleryController } from "./gallery.controller";
import { requirePermission } from "@/plugins/rbac";

export async function registerGalleryRoutes(fastify: FastifyInstance) {
  fastify.get("/public/gallery", (request, reply) =>
    galleryController.listPublicSegments(request, reply)
  );

  fastify.get("/public/gallery/:slug", (request, reply) =>
    galleryController.getPublicSegment(request, reply)
  );

  fastify.post(
    "/admin/gallery",
    { preHandler: requirePermission("gallery") },
    (request, reply) => galleryController.createSegment(request, reply)
  );

  fastify.get(
    "/admin/gallery",
    { preHandler: requirePermission("gallery") },
    (request, reply) => galleryController.listSegments(request, reply)
  );

  fastify.get(
    "/admin/gallery/:id",
    { preHandler: requirePermission("gallery") },
    (request, reply) => galleryController.getSegment(request, reply)
  );

  fastify.patch(
    "/admin/gallery/:id",
    { preHandler: requirePermission("gallery") },
    (request, reply) => galleryController.updateSegment(request, reply)
  );

  fastify.delete(
    "/admin/gallery/:id",
    { preHandler: requirePermission("gallery") },
    (request, reply) => galleryController.deleteSegment(request, reply)
  );

  fastify.post(
    "/admin/gallery/:id/images",
    { preHandler: requirePermission("gallery") },
    (request, reply) => galleryController.addImages(request, reply)
  );

  fastify.post(
    "/admin/gallery/:id/reorder",
    { preHandler: requirePermission("gallery") },
    (request, reply) => galleryController.reorderImages(request, reply)
  );

  fastify.delete(
    "/admin/gallery/images/:imageId",
    { preHandler: requirePermission("gallery") },
    (request, reply) => galleryController.deleteImage(request, reply)
  );
}
