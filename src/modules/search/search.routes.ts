import { FastifyInstance } from "fastify";
import { z } from "zod";
import { successResponse, paginationMeta } from "@/lib/response";
import { enumOf, okPaged, op, pageQuery, queryParams, str } from "@/schemas/common";
import { searchResultSchema } from "@/schemas/entities";
import searchService, { SearchType } from "./search.service";

const searchQuerySchema = z.object({
  q: z.string().min(1),
  type: z.enum(["post", "research", "video", "all"]).default("all"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export async function registerSearchRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/search",
    {
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
      schema: op({
        tags: ["Search"],
        summary: "Search posts, research, and videos",
        description: [
          "Postgres full-text search over published content only, ranked by `ts_rank` and returned newest-relevance first.",
          "",
          "Posts match on title, excerpt, and body. Research matches on title, abstract, and the text extracted from its PDFs — so a phrase inside a paper is findable even though the PDF itself is gated. Videos are matched with a case-insensitive substring on title and description and always come back with `rank: 0`.",
          "",
          "**Rate limited to 30 requests per minute per IP.**",
        ].join("\n"),
        query: queryParams(
          {
            q: str("Search phrase. Required.", { minLength: 1, example: "radha kunda" }),
            type: enumOf(
              ["all", "post", "research", "video"],
              "Restrict to one collection.",
              { default: "all" }
            ),
            ...pageQuery(20, 50),
          },
          ["q"]
        ),
        response: {
          200: okPaged(
            "A page of search hits.",
            "results",
            searchResultSchema,
            "Hits on this page, highest rank first."
          ),
        },
      }),
    },
    async (request, reply) => {
      const query = searchQuerySchema.parse(request.query);
      const skip = (query.page - 1) * query.limit;

      const { results, total } = await searchService.search(
        request.server.prisma,
        query.q,
        query.type as SearchType,
        skip,
        query.limit
      );

      return reply.send(
        successResponse({ results }, paginationMeta(query.page, query.limit, total))
      );
    }
  );
}
