import { FastifyInstance } from "fastify";
import { z } from "zod";
import { successResponse, paginationMeta } from "@/lib/response";
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
