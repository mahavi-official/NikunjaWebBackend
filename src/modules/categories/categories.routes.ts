import { FastifyInstance } from "fastify";
import { categoriesController } from "./categories.controller";
import { requirePermission } from "@/plugins/rbac";
import {
  bool,
  enumOf,
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
import { categorySchema, CATEGORY_SCOPE_VALUES } from "@/schemas/entities";

const TAGS = ["Categories"];
const ACCESS = "SUPER_ADMIN, ADMIN, or an EDITOR granted the `posts` module";

const scopeQuery = {
  scope: enumOf(CATEGORY_SCOPE_VALUES, "Which taxonomy to list.", { default: "ARTICLE" }),
};

export async function registerCategoriesRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/categories",
    {
      schema: op({
        tags: TAGS,
        summary: "List categories",
        description: [
          "Categories for one scope, in manual `order`. Scopes are independent taxonomies: `ARTICLE`, `BLOG`, and `RESEARCH` each have their own set, and slugs are only unique within a scope.",
          "",
          "Pass the returned `slug` to `/public/posts?category=…` or `/public/research?category=…` to filter content.",
        ].join("\n"),
        query: queryParams({ ...scopeQuery, ...pageQuery(50) }),
        response: {
          200: okPaged(
            "A page of categories.",
            "categories",
            categorySchema,
            "Categories on this page, ordered by `order`."
          ),
        },
      }),
    },
    (request, reply) => categoriesController.listCategories(request, reply)
  );

  fastify.post(
    "/admin/categories",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Create a category",
        description:
          "`scope` decides which taxonomy the category joins and cannot be changed afterwards. Omit `slug` and one is derived from the name; a collision within the same scope returns 409.",
        access: ACCESS,
        body: jsonBody(
          "The category to create.",
          {
            scope: enumOf(CATEGORY_SCOPE_VALUES, "Which taxonomy this belongs to."),
            name: str("Display name.", { minLength: 1, example: "Philosophy" }),
            slug: str("URL slug. Derived from `name` when omitted.", {
              minLength: 1,
              example: "philosophy",
            }),
            description: str("Blurb shown on the category page."),
            metaTitle: str("`<title>` override."),
            metaDescription: str("Meta description override."),
            noIndex: bool("Serve the category page as `noindex, nofollow`.", { default: false }),
          },
          ["scope", "name"]
        ),
        errors: [409],
        response: {
          201: ok("The created category.", categorySchema),
        },
      }),
    },
    (request, reply) => categoriesController.createCategory(request, reply)
  );

  fastify.get(
    "/admin/categories",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "List categories (admin)",
        description: "Same data as the public endpoint. Kept separate so the admin UI can read it behind a token.",
        access: ACCESS,
        query: queryParams({ ...scopeQuery, ...pageQuery(50) }),
        response: {
          200: okPaged("A page of categories.", "categories", categorySchema, "Categories on this page."),
        },
      }),
    },
    (request, reply) => categoriesController.listCategories(request, reply)
  );

  fastify.get(
    "/admin/categories/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Get one category",
        description: "Single category by id, for the edit form.",
        access: ACCESS,
        params: idParam("category"),
        response: {
          200: ok("The category.", categorySchema),
        },
      }),
    },
    (request, reply) => categoriesController.getCategory(request, reply)
  );

  fastify.patch(
    "/admin/categories/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Update a category",
        description:
          "Send only the fields you want to change. `scope` and `slug` are fixed after creation — changing a slug would break every published URL under it.",
        access: ACCESS,
        params: idParam("category"),
        body: jsonBody("Fields to change. All optional.", {
          name: str("New display name.", { example: "Philosophy" }),
          description: str("New blurb."),
          metaTitle: str("`<title>` override."),
          metaDescription: str("Meta description override."),
          noIndex: bool("Serve the category page as `noindex, nofollow`."),
        }),
        response: {
          200: ok("The updated category.", categorySchema),
        },
      }),
    },
    (request, reply) => categoriesController.updateCategory(request, reply)
  );

  fastify.delete(
    "/admin/categories/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Delete a category",
        description:
          "Posts in the category are not deleted — they simply lose the assignment. Research rows pointing at it have `categoryId` set to null.",
        access: ACCESS,
        params: idParam("category"),
        response: {
          200: okMessage("The category was deleted.", "Category deleted"),
        },
      }),
    },
    (request, reply) => categoriesController.deleteCategory(request, reply)
  );
}
