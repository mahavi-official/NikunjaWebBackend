import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import { buildSeo, buildArticleJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo";
import { truncateText, stripHtmlTags } from "@/lib/sanitize";
import postsService from "./posts.service";
import { CreatePostInput, UpdatePostInput, listPostsSchema } from "./posts.schema";

function canonicalPath(placement: string, slug: string): string {
  return placement === "BLOG" ? `/blogs/${slug}` : `/articles/${slug}`;
}

export const postsController = {
  async createPost(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreatePostInput;

    const post = await postsService.createPost(
      request.server.prisma,
      data,
      request.user!.id
    );

    await createAuditLog(request.server.prisma, request, "post.create", "post", post.id);

    return reply.status(201).send(successResponse(post));
  },

  async listPosts(request: FastifyRequest, reply: FastifyReply) {
    const query = listPostsSchema.parse(request.query);

    const { posts, total } = await postsService.listPosts(
      request.server.prisma,
      query,
      false
    );

    return reply.send(
      successResponse({ posts }, paginationMeta(query.page, query.limit, total))
    );
  },

  async listPublicPosts(request: FastifyRequest, reply: FastifyReply) {
    const query = listPostsSchema.parse(request.query);

    const { posts, total } = await postsService.listPosts(
      request.server.prisma,
      query,
      true
    );

    return reply.send(
      successResponse({ posts }, paginationMeta(query.page, query.limit, total))
    );
  },

  async getPost(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const post = await postsService.getPost(request.server.prisma, id);

    return reply.send(successResponse(post));
  },

  async getPublicPost(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const post = await postsService.getPostBySlug(request.server.prisma, slug);

    const path = canonicalPath(post.placement, post.slug);
    const seo = buildSeo(
      post.metaTitle || post.title,
      post.metaDescription || post.excerpt || truncateText(stripHtmlTags(post.content), 155),
      path,
      post.ogImage?.url || post.coverImage?.url,
      post.noIndex,
      "article",
      post.publishedAt?.toISOString(),
      post.updatedAt.toISOString(),
      post.author.name
    );

    seo.jsonLd = [
      buildArticleJsonLd({
        title: post.title,
        description: post.excerpt || "",
        content: post.content,
        author: post.author.name,
        publishedTime: post.publishedAt?.toISOString() || "",
        modifiedTime: post.updatedAt.toISOString(),
        image: post.ogImage?.url || post.coverImage?.url,
        url: seo.canonical,
        keywords: post.metaKeywords?.split(","),
      }),
      buildBreadcrumbJsonLd([
        { name: "Home", url: seo.canonical.split("/").slice(0, 3).join("/") },
        { name: post.title, url: seo.canonical },
      ]),
    ];

    return reply.send(successResponse({ post, seo }));
  },

  async updatePost(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdatePostInput;

    const post = await postsService.updatePost(request.server.prisma, id, data);

    await createAuditLog(request.server.prisma, request, "post.update", "post", post.id);

    return reply.send(successResponse(post));
  },

  async publishPost(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const post = await postsService.publishPost(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "post.publish", "post", post.id);

    return reply.send(successResponse(post));
  },

  async unpublishPost(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const post = await postsService.unpublishPost(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "post.unpublish", "post", post.id);

    return reply.send(successResponse(post));
  },

  async deletePost(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await postsService.deletePost(request.server.prisma, id);

    await createAuditLog(request.server.prisma, request, "post.delete", "post", id);

    return reply.send(successResponse({ message: "Post deleted" }));
  },

  async incrementView(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };

    await postsService.incrementViewCount(request.server.prisma, slug);

    return reply.send(successResponse({ ok: true }));
  },
};
