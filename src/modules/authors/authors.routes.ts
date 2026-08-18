import { FastifyInstance } from "fastify";
import { authorsController } from "./authors.controller";
import { requirePermission } from "@/plugins/rbac";
import {
  bool,
  id,
  idParam,
  jsonBody,
  obj,
  ok,
  okMessage,
  okPaged,
  op,
  pageQuery,
  queryParams,
  slugParam,
  str,
  withoutDefaults,
} from "@/schemas/common";
import { authorSchema, seoSchema } from "@/schemas/entities";

const TAGS = ["Authors"];
const ACCESS = "SUPER_ADMIN, ADMIN, or an EDITOR granted the `research` module";

const authorBodyFields = {
  name: str("Full name as it should appear in a byline.", {
    minLength: 1,
    example: "Dr. R. Sharma",
  }),
  slug: str("URL slug. Derived from the name when omitted.", { example: "r-sharma" }),
  affiliation: str("Institution or department.", { example: "Dept. of History, BHU" }),
  bio: str("Short biography shown on the author page."),
  photoId: id("media file to use as the portrait"),
  email: str("Contact email.", { format: "email", example: "r.sharma@example.edu" }),
  orcid: str("ORCID identifier.", { example: "0000-0002-1825-0097" }),
  metaTitle: str("`<title>` override for the author page."),
  metaDescription: str("Meta description override. Falls back to the bio."),
  noIndex: bool("Serve the author page as `noindex, nofollow`.", { default: false }),
};

export async function registerAuthorsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/authors",
    {
      schema: op({
        tags: TAGS,
        summary: "List authors",
        description:
          "Publication authors, alphabetical by name, each with their portrait. These are not user accounts — an author does not need to be able to sign in.",
        query: queryParams(pageQuery(50)),
        response: {
          200: okPaged("A page of authors.", "authors", authorSchema, "Authors on this page, A–Z."),
        },
      }),
    },
    (request, reply) => authorsController.listAuthors(request, reply)
  );

  fastify.get(
    "/public/authors/:slug",
    {
      schema: op({
        tags: TAGS,
        summary: "Get an author by slug",
        description:
          "The author profile plus every publication they are credited on, in byline order, and a ready-to-render `seo` block with `Person` JSON-LD.",
        params: slugParam("author"),
        response: {
          200: ok(
            "The author and their SEO block.",
            obj("Author detail.", {
              author: {
                ...authorSchema,
                description: "The author, with a `research` array of their credited publications.",
              },
              seo: seoSchema,
            })
          ),
        },
      }),
    },
    (request, reply) => authorsController.getPublicAuthor(request, reply)
  );

  fastify.post(
    "/admin/authors",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Create an author",
        description:
          "Only `name` is required. Create the author first, then reference the returned id in a publication's `authorIds`.",
        access: ACCESS,
        body: jsonBody("The author to create.", authorBodyFields, ["name"]),
        errors: [409],
        response: {
          201: ok("The created author.", authorSchema),
        },
      }),
    },
    (request, reply) => authorsController.createAuthor(request, reply)
  );

  fastify.get(
    "/admin/authors",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "List authors (admin)",
        description: "Same data as the public endpoint, behind a token for the author picker.",
        access: ACCESS,
        query: queryParams(pageQuery(50)),
        response: {
          200: okPaged("A page of authors.", "authors", authorSchema, "Authors on this page."),
        },
      }),
    },
    (request, reply) => authorsController.listAuthors(request, reply)
  );

  fastify.get(
    "/admin/authors/:id",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Get one author",
        description: "Single author by id, for the edit form.",
        access: ACCESS,
        params: idParam("author"),
        response: {
          200: ok("The author.", authorSchema),
        },
      }),
    },
    (request, reply) => authorsController.getAuthor(request, reply)
  );

  fastify.patch(
    "/admin/authors/:id",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Update an author",
        description: "Send only the fields you want to change.",
        access: ACCESS,
        params: idParam("author"),
        body: jsonBody("Fields to change. All optional.", withoutDefaults(authorBodyFields)),
        errors: [409],
        response: {
          200: ok("The updated author.", authorSchema),
        },
      }),
    },
    (request, reply) => authorsController.updateAuthor(request, reply)
  );

  fastify.delete(
    "/admin/authors/:id",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Delete an author",
        description:
          "Removes the author and their byline entries. The publications themselves stay, but lose that name from their author list.",
        access: ACCESS,
        params: idParam("author"),
        response: {
          200: okMessage("The author was deleted.", "Author deleted"),
        },
      }),
    },
    (request, reply) => authorsController.deleteAuthor(request, reply)
  );
}
