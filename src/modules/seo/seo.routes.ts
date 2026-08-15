import { FastifyInstance } from "fastify";
import { z } from "zod";
import { successResponse, paginationMeta } from "@/lib/response";
import { requireRole } from "@/plugins/rbac";
import {
  int,
  idParam,
  jsonBody,
  ok,
  okMessage,
  okPaged,
  okWrapped,
  op,
  pageQuery,
  pathParams,
  queryParams,
  rawBody,
  str,
} from "@/schemas/common";
import { nullableRedirectSchema, redirectSchema } from "@/schemas/entities";
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

const TAGS = ["SEO"];

export async function registerSeoRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/redirects",
    {
      schema: op({
        tags: TAGS,
        summary: "Look up a redirect for a path",
        description: [
          "Answers the question the Next.js middleware asks on every 404: *should this path go somewhere else?*",
          "",
          "Returns `{ \"redirect\": null }` when there is no rule, which is the common case — treat that as \"carry on and render the 404\".",
          "",
          "Rules are written automatically when a published slug changes, and permanently for `/blogs/{slug}` → `/articles/{slug}` on `BOTH`-placement posts.",
        ].join("\n"),
        query: queryParams(
          {
            path: str("Exact incoming path to look up, including the leading slash.", {
              minLength: 1,
              example: "/blogs/old-slug",
            }),
          },
          ["path"]
        ),
        response: {
          200: okWrapped("The matching rule, or null.", "redirect", nullableRedirectSchema),
        },
      }),
    },
    async (request, reply) => {
      const { path } = request.query as { path: string };

      const redirect = await seoService.findRedirect(request.server.prisma, path);

      return reply.send(successResponse({ redirect }));
    }
  );

  fastify.post(
    "/admin/redirects",
    {
      preHandler: requireRole("SUPER_ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Create a redirect",
        description:
          "Adds a manual rule (`isAuto: false`). `fromPath` is unique — a second rule for the same path returns 409. Use this for migrations from an old site.",
        access: "SUPER_ADMIN only",
        body: jsonBody(
          "The rule to create.",
          {
            fromPath: str("Incoming path to match, including the leading slash.", {
              minLength: 1,
              example: "/old/about-us",
            }),
            toPath: str("Where to send it.", { minLength: 1, example: "/about" }),
            statusCode: int("HTTP status to emit. Use 301 for permanent, 302 for temporary.", {
              default: 301,
              example: 301,
            }),
          },
          ["fromPath", "toPath"]
        ),
        errors: [409],
        response: {
          201: ok("The created rule.", redirectSchema),
        },
      }),
    },
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
    {
      preHandler: requireRole("SUPER_ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "List redirects",
        description:
          "Every rule, newest first. `isAuto: true` marks the ones written automatically after a slug change.",
        access: "SUPER_ADMIN only",
        query: queryParams(pageQuery(50)),
        response: {
          200: okPaged("A page of rules.", "redirects", redirectSchema, "Rules on this page."),
        },
      }),
    },
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
    {
      preHandler: requireRole("SUPER_ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Delete a redirect",
        description:
          "Removes the rule, after which the old path 404s again. Deleting an auto-generated rule is allowed but will re-break the URL it was patching.",
        access: "SUPER_ADMIN only",
        params: idParam("redirect"),
        response: {
          200: okMessage("The rule was deleted.", "Redirect deleted"),
        },
      }),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      await seoService.deleteRedirect(request.server.prisma, id);

      return reply.send(successResponse({ message: "Redirect deleted" }));
    }
  );

  fastify.post(
    "/admin/posts/:id/preview-token",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Mint a draft-preview token",
        description: [
          "Issues a short-lived token that lets Next.js draft mode render an unpublished post. Takes no body.",
          "",
          "Only the hash is stored, so the token is shown **once** — put it straight into the preview URL. It expires after `PREVIEW_TOKEN_TTL_MINUTES` (30 by default).",
        ].join("\n"),
        access: "SUPER_ADMIN, ADMIN, or EDITOR",
        params: idParam("post"),
        response: {
          200: okWrapped(
            "The token. Shown once and never retrievable again.",
            "token",
            str("Opaque preview token.", { example: "9f2c1e7a5b3d8c4e6f0a2b1d" })
          ),
        },
      }),
    },
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
  fastify.get(
    "/sitemap.xml",
    {
      schema: op({
        tags: ["Sitemap"],
        summary: "Sitemap index",
        description: [
          "The sitemap index search engines should be pointed at. Lists one child sitemap per content type: `posts`, `research`, `gallery`, `videos`, `authors`, `categories`, `static`.",
          "",
          "Served as `application/xml` and cached for an hour. Note this route sits at the domain root, not under `/api/v1`.",
        ].join("\n"),
        produces: ["application/xml"],
        response: {
          200: rawBody(
            "XML sitemap index.",
            '<?xml version="1.0" encoding="UTF-8"?><sitemapindex …>'
          ),
        },
      }),
    },
    async (_request, reply) => {
      const xml = seoService.buildSitemapIndexXml(SITEMAP_TYPES);

      return reply
        .header("Content-Type", "application/xml")
        .header("Cache-Control", "public, max-age=3600")
        .send(xml);
    }
  );

  fastify.get(
    "/sitemaps/:file",
    {
      schema: op({
        tags: ["Sitemap"],
        summary: "One child sitemap",
        description: [
          "A single page of URLs for one content type. The file name must be `{type}-{page}.xml`, e.g. `posts-1.xml`, with up to 5000 entries per page.",
          "",
          "Anything that does not match that pattern, or names an unknown type, returns 404.",
        ].join("\n"),
        params: pathParams({
          file: str(
            "`{type}-{page}.xml`, where type is one of `posts`, `research`, `gallery`, `videos`, `authors`, `categories`, `static`.",
            { example: "posts-1.xml" }
          ),
        }),
        produces: ["application/xml"],
        response: {
          200: rawBody("XML urlset.", '<?xml version="1.0" encoding="UTF-8"?><urlset …>'),
          404: {
            description: "The file name was malformed or named an unknown content type.",
            type: "object",
            additionalProperties: true,
            properties: { error: str("Always `Not found`.", { example: "Not found" }) },
          },
        },
      }),
    },
    async (request, reply) => {
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
    }
  );
}
