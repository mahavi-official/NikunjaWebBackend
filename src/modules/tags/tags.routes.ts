import { FastifyInstance } from "fastify";
import { tagsController } from "./tags.controller";
import { requirePermission } from "@/plugins/rbac";
import {
  idParam,
  jsonBody,
  ok,
  okMessage,
  okPaged,
  op,
  pageQuery,
  queryParams,
  str,
} from "@/schemas/common";
import { tagSchema } from "@/schemas/entities";

const TAGS = ["Tags"];
const ACCESS = "SUPER_ADMIN, ADMIN, or an EDITOR granted the `posts` module";

export async function registerTagsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/tags",
    {
      schema: op({
        tags: TAGS,
        summary: "List tags",
        description:
          "One flat tag list shared by posts and research. Pass a returned `slug` to `/public/posts?tag=…` to filter.",
        query: queryParams(pageQuery(50)),
        response: {
          200: okPaged("A page of tags.", "tags", tagSchema, "Tags on this page."),
        },
      }),
    },
    (request, reply) => tagsController.listTags(request, reply)
  );

  fastify.post(
    "/admin/tags",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Create a tag",
        description: [
          "Creating tags by hand is rarely needed: `tagNames` on a post or research payload creates any tag that does not exist yet.",
          "",
          "Names and slugs are globally unique — a duplicate returns 409.",
        ].join("\n"),
        access: ACCESS,
        body: jsonBody(
          "The tag to create.",
          {
            name: str("Tag label. Must be unique.", { minLength: 1, example: "bhakti" }),
            slug: str("URL slug. Derived from `name` when omitted.", {
              minLength: 1,
              example: "bhakti",
            }),
          },
          ["name"]
        ),
        errors: [409],
        response: {
          201: ok("The created tag.", tagSchema),
        },
      }),
    },
    (request, reply) => tagsController.createTag(request, reply)
  );

  fastify.get(
    "/admin/tags",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "List tags (admin)",
        description: "Same data as the public endpoint, behind a token for the admin UI.",
        access: ACCESS,
        query: queryParams(pageQuery(50)),
        response: {
          200: okPaged("A page of tags.", "tags", tagSchema, "Tags on this page."),
        },
      }),
    },
    (request, reply) => tagsController.listTags(request, reply)
  );

  fastify.get(
    "/admin/tags/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Get one tag",
        description: "Single tag by id, for the edit form.",
        access: ACCESS,
        params: idParam("tag"),
        response: {
          200: ok("The tag.", tagSchema),
        },
      }),
    },
    (request, reply) => tagsController.getTag(request, reply)
  );

  fastify.patch(
    "/admin/tags/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Rename a tag",
        description:
          "Renames the tag everywhere it is used. The slug is not regenerated, so existing tag URLs keep working.",
        access: ACCESS,
        params: idParam("tag"),
        body: jsonBody(
          "The new label.",
          { name: str("New tag label.", { minLength: 1, example: "bhakti-yoga" }) },
          ["name"]
        ),
        errors: [409],
        response: {
          200: ok("The updated tag.", tagSchema),
        },
      }),
    },
    (request, reply) => tagsController.updateTag(request, reply)
  );

  fastify.delete(
    "/admin/tags/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Delete a tag",
        description: "Detaches the tag from every post and research record. The content itself is untouched.",
        access: ACCESS,
        params: idParam("tag"),
        response: {
          200: okMessage("The tag was deleted.", "Tag deleted"),
        },
      }),
    },
    (request, reply) => tagsController.deleteTag(request, reply)
  );
}
