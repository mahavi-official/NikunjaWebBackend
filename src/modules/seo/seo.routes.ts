import { FastifyInstance } from "fastify";
import { z } from "zod";
import { successResponse, paginationMeta } from "@/lib/response";
import { requireRole } from "@/plugins/rbac";
import seoService, { SitemapType } from "./seo.service";

const SITEMAP_TYPES: SitemapType[] = [
  "posts",
  "research",
  "gallery",
  "videos",
  "authors",
  "categories",
  "static",
];

const createRedirectSchema = z.object({
  fromPath: z.string().min(1),
  toPath: z.string().min(1),
  statusCode: z.number().int().default(301),
});

export async function registerSeoRoutes(fastify: FastifyInstance) {
  fastify.get("/public/redirects", async (request, reply) => {
    const { path } = request.query as { path: string };

    const redirect = await seoService.findRedirect(request.server.prisma, path);

    return reply.send(successResponse({ redirect }));
  });

  fastify.post(
    "/admin/redirects",
    { preHandler: requireRole("SUPER_ADMIN") },
    async (request, reply) => {
      const data = createRedirectSchema.parse(request.body);

      const redirect = await seoService.createRedirect(
        request.server.prisma,
        data.fromPath,
        data.toPath,
        data.statusCode
      );

      return reply.status(201).send(successResponse(redirect));
    }
  );

  fastify.get(
    "/admin/redirects",
    { preHandler: requireRole("SUPER_ADMIN") },
    async (request, reply) => {
      const { page = "1", limit = "50" } = request.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const { redirects, total } = await seoService.listRedirects(
        request.server.prisma,
        (pageNum - 1) * limitNum,
        limitNum
      );

      return reply.send(
        successResponse({ redirects }, paginationMeta(pageNum, limitNum, total))
      );
    }
  );

  fastify.delete(
    "/admin/redirects/:id",
    { preHandler: requireRole("SUPER_ADMIN") },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      await seoService.deleteRedirect(request.server.prisma, id);

      return reply.send(successResponse({ message: "Redirect deleted" }));
    }
  );

  fastify.post(
    "/admin/posts/:id/preview-token",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const token = await seoService.createPreviewToken(
        request.server.prisma,
        "post",
        id,
        request.user!.id
      );

      return reply.send(successResponse({ token }));
    }
  );
}

export async function registerSitemapRoutes(fastify: FastifyInstance) {
  fastify.get("/sitemap.xml", async (_request, reply) => {
    const xml = seoService.buildSitemapIndexXml(SITEMAP_TYPES);

    return reply
      .header("Content-Type", "application/xml")
      .header("Cache-Control", "public, max-age=3600")
      .send(xml);
  });

  fastify.get("/sitemaps/:file", async (request, reply) => {
    const { file } = request.params as { file: string };
    const match = file.match(/^([a-z]+)-(\d+)\.xml$/);

    if (!match) {
      return reply.status(404).send({ error: "Not found" });
    }

    const [, type, pageStr] = match;

    if (!SITEMAP_TYPES.includes(type as SitemapType)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const entries = await seoService.getSitemapEntries(
      request.server.prisma,
      type as SitemapType,
      parseInt(pageStr)
    );

    const xml = seoService.buildSitemapXml(entries);

    return reply
      .header("Content-Type", "application/xml")
      .header("Cache-Control", "public, max-age=3600")
      .send(xml);
  });
}
