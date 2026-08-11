import { PrismaClient } from "@prisma/client";

export type SearchType = "post" | "research" | "video" | "all";

export interface SearchResult {
  type: "post" | "research" | "video";
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  rank: number;
}

class SearchService {
  async search(
    prisma: PrismaClient,
    query: string,
    type: SearchType,
    skip: number,
    take: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const results: SearchResult[] = [];

    if (type === "post" || type === "all") {
      const posts = await prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          publishedAt: Date | null;
          rank: number;
        }>
      >`
        SELECT id, title, slug, excerpt, "publishedAt",
               ts_rank("searchVector", plainto_tsquery('english', ${query})) AS rank
        FROM "Post"
        WHERE "searchVector" @@ plainto_tsquery('english', ${query})
          AND status = 'PUBLISHED'
          AND "publishedAt" <= NOW()
        ORDER BY rank DESC
        LIMIT ${take} OFFSET ${skip}
      `;

      results.push(...posts.map((p) => ({ ...p, type: "post" as const })));
    }

    if (type === "research" || type === "all") {
      const research = await prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          publishedAt: Date | null;
          rank: number;
        }>
      >`
        SELECT id, title, slug, abstract AS excerpt, "publishedAt",
               ts_rank("searchVector", plainto_tsquery('english', ${query})) AS rank
        FROM "Research"
        WHERE "searchVector" @@ plainto_tsquery('english', ${query})
          AND status = 'PUBLISHED'
          AND "publishedAt" <= NOW()
        ORDER BY rank DESC
        LIMIT ${take} OFFSET ${skip}
      `;

      results.push(...research.map((r) => ({ ...r, type: "research" as const })));
    }

    if (type === "video" || type === "all") {
      const videos = await prisma.video.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { lte: new Date() },
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        skip,
        take,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          publishedAt: true,
        },
      });

      results.push(
        ...videos.map((v) => ({
          type: "video" as const,
          id: v.id,
          title: v.title,
          slug: v.slug,
          excerpt: v.description,
          publishedAt: v.publishedAt,
          rank: 0,
        }))
      );
    }

    results.sort((a, b) => b.rank - a.rank);

    return { results: results.slice(0, take), total: results.length };
  }
}

export default new SearchService();
