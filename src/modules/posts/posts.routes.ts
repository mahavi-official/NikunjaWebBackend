import { FastifyInstance } from "fastify";
import { postsController } from "./posts.controller";
import { requirePermission } from "@/plugins/rbac";

export async function registerPostsRoutes(fastify: FastifyInstance) {
  fastify.get("/public/posts", (request, reply) =>
    postsController.listPublicPosts(request, reply)
  );

  fastify.get("/public/posts/:slug", (request, reply) =>
    postsController.getPublicPost(request, reply)
  );

  fastify.post("/public/posts/:slug/view", (request, reply) =>
    postsController.incrementView(request, reply)
  );

  fastify.post(
    "/admin/posts",
    { preHandler: requirePermission("posts") },
    (request, reply) => postsController.createPost(request, reply)
  );

  fastify.get(
    "/admin/posts",
    { preHandler: requirePermission("posts") },
    (request, reply) => postsController.listPosts(request, reply)
  );

  fastify.get(
    "/admin/posts/:id",
    { preHandler: requirePermission("posts") },
    (request, reply) => postsController.getPost(request, reply)
  );

  fastify.patch(
    "/admin/posts/:id",
    { preHandler: requirePermission("posts") },
    (request, reply) => postsController.updatePost(request, reply)
  );

  fastify.delete(
    "/admin/posts/:id",
    { preHandler: requirePermission("posts") },
    (request, reply) => postsController.deletePost(request, reply)
  );

  fastify.post(
    "/admin/posts/:id/publish",
    { preHandler: requirePermission("posts") },
    (request, reply) => postsController.publishPost(request, reply)
  );

  fastify.post(
    "/admin/posts/:id/unpublish",
    { preHandler: requirePermission("posts") },
    (request, reply) => postsController.unpublishPost(request, reply)
  );
}
