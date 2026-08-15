import { FastifyInstance } from "fastify";
import { successResponse } from "@/lib/response";
import { arrayOf, enumOf, nullableDateTime, obj, ok, op, slug, str } from "@/schemas/common";
import {
  gallerySegmentSchema,
  heroSlideSchema,
  postSummarySchema,
  publicResearchSchema,
  videoSchema,
} from "@/schemas/entities";

const recentUpdateSchema = obj("One entry in the merged recent-updates feed.", {
  type: enumOf(["post", "research", "video"], "Which collection the entry came from."),
  title: str("Entry title.", { example: "The History of Radha Kunda" }),
  slug: slug("entry"),
  publishedAt: nullableDateTime("Publication instant. The feed is sorted by this, newest first."),
});

export async function registerHomeRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/home",
    {
      schema: op({
        tags: ["Home"],
        summary: "Everything the homepage needs, in one call",
        description: [
          "Aggregates the hero carousel, featured and latest content, and gallery teasers so the homepage renders from a single request instead of eight.",
          "",
          "Only published content with `publishedAt <= now()` is included. Rail sizes are fixed: 4 featured research, 4 featured articles, 4 latest blogs, 4 latest videos, 6 gallery segments, and up to 10 merged recent updates.",
          "",
          "Cached at the edge for 60 seconds (`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`).",
        ].join("\n"),
        response: {
          200: ok(
            "The full homepage payload.",
            obj("Homepage rails.", {
              hero: arrayOf(heroSlideSchema, "Active hero slides, in carousel order."),
              featuredResearch: arrayOf(
                publicResearchSchema,
                "Up to 4 featured publications, newest first. Carries the byline only — `files`, `category`, `ogImage`, and `tags` are not loaded on this rail."
              ),
              featuredPosts: arrayOf(
                postSummarySchema,
                "Up to 4 featured articles (placement `ARTICLE` or `BOTH`), newest first."
              ),
              latestBlogs: arrayOf(
                postSummarySchema,
                "Up to 4 latest blog posts (placement `BLOG` or `BOTH`)."
              ),
              latestVideos: arrayOf(videoSchema, "Up to 4 latest published videos."),
              gallery: arrayOf(
                gallerySegmentSchema,
                "Up to 6 published gallery segments, in display order."
              ),
              recentUpdates: arrayOf(
                recentUpdateSchema,
                "Featured posts, featured research, and latest videos merged and sorted by `publishedAt`, capped at 10."
              ),
            })
          ),
        },
      }),
    },
    async (request, reply) => {
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
    }
  );
}
