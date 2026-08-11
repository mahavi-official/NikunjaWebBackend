import { FastifyInstance } from "fastify";
import { successResponse } from "@/lib/response";

export async function registerHomeRoutes(fastify: FastifyInstance) {
  fastify.get("/public/home", async (request, reply) => {
    const { prisma } = request.server;
    const now = new Date();
    const published = { status: "PUBLISHED" as const, publishedAt: { lte: now } };

    const [
      hero,
      featuredResearch,
      featuredPosts,
      latestBlogs,
      latestVideos,
      gallery,
    ] = await Promise.all([
      prisma.heroSlide.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { image: true },
      }),
      prisma.research.findMany({
        where: { ...published, isFeatured: true },
        take: 4,
        orderBy: { publishedAt: "desc" },
        include: { authors: { include: { author: true } } },
      }),
      prisma.post.findMany({
        where: { ...published, isFeatured: true, placement: { in: ["ARTICLE", "BOTH"] } },
        take: 4,
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          coverImage: true,
        },
      }),
      prisma.post.findMany({
        where: { ...published, placement: { in: ["BLOG", "BOTH"] } },
        take: 4,
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          coverImage: true,
        },
      }),
      prisma.video.findMany({
        where: published,
        take: 4,
        orderBy: { publishedAt: "desc" },
      }),
      prisma.gallerySegment.findMany({
        where: { isPublished: true },
        take: 6,
        orderBy: { order: "asc" },
        include: { coverImage: true },
      }),
    ]);

    const recentUpdates = [
      ...featuredPosts.map((p) => ({
        type: "post" as const,
        title: p.title,
        slug: p.slug,
        publishedAt: p.publishedAt,
      })),
      ...featuredResearch.map((r) => ({
        type: "research" as const,
        title: r.title,
        slug: r.slug,
        publishedAt: r.publishedAt,
      })),
      ...latestVideos.map((v) => ({
        type: "video" as const,
        title: v.title,
        slug: v.slug,
        publishedAt: v.publishedAt,
      })),
    ]
      .sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0))
      .slice(0, 10);

    return reply
      .header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
      .send(
        successResponse({
          hero,
          featuredResearch,
          featuredPosts,
          latestBlogs,
          latestVideos,
          gallery,
          recentUpdates,
        })
      );
  });
}
