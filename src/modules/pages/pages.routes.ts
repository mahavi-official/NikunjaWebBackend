import { FastifyInstance } from "fastify";
import { pagesController } from "./pages.controller";
import { requireRole } from "@/plugins/rbac";
import {
  anyJson,
  bool,
  id,
  jsonBody,
  obj,
  ok,
  op,
  pathParams,
  str,
} from "@/schemas/common";
import { pageSchema, seoSchema } from "@/schemas/entities";

const TAGS = ["Pages"];
const ACCESS = "SUPER_ADMIN, ADMIN, or EDITOR";

const keyParam = pathParams({
  key: str("Page key. `about` is the only page today; the model is reusable for more.", {
    example: "about",
  }),
});

export async function registerPagesRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/pages/:key",
    {
      schema: op({
        tags: TAGS,
        summary: "Get a static page",
        description: [
          "Returns the page plus a ready-to-render `seo` block.",
          "",
          "`sections` is free-form JSON owned by the frontend — for `about` it holds `{ about, mission, vision, objectives, team[], journey[], contact }`. The API stores and returns it verbatim without validating its shape.",
        ].join("\n"),
        params: keyParam,
        response: {
          200: ok(
            "The page and its SEO block.",
            obj("Page detail.", { page: pageSchema, seo: seoSchema })
          ),
        },
      }),
    },
    (request, reply) => pagesController.getPublicPage(request, reply)
  );

  fastify.get(
    "/admin/pages/:key",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Get a static page (admin)",
        description: "The raw page record without the SEO block — this is what the page editor loads.",
        access: ACCESS,
        params: keyParam,
        response: {
          200: ok("The page.", pageSchema),
        },
      }),
    },
    (request, reply) => pagesController.getPage(request, reply)
  );

  fastify.patch(
    "/admin/pages/:key",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Create or replace a static page",
        description: [
          "Upsert: creates the page if `key` does not exist yet, otherwise replaces it.",
          "",
          "Despite being a PATCH, `sections` is stored **whole** — send the complete section tree, not a partial one, or the omitted sections are lost.",
        ].join("\n"),
        access: ACCESS,
        params: keyParam,
        body: jsonBody(
          "The full page content.",
          {
            title: str("Page title.", { minLength: 1, example: "About Us" }),
            sections: anyJson(
              "The complete section tree. Stored verbatim, replacing whatever was there."
            ),
            metaTitle: str("`<title>` override. Falls back to `title`."),
            metaDescription: str("Meta description override."),
            ogImageId: id("media file to use as the Open Graph image"),
            noIndex: bool("Serve the page as `noindex, nofollow`.", { default: false }),
          },
          ["title", "sections"]
        ),
        response: {
          200: ok("The saved page.", pageSchema),
        },
      }),
    },
    (request, reply) => pagesController.upsertPage(request, reply)
  );
}
