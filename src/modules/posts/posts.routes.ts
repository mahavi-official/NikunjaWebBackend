import { FastifyInstance } from "fastify";
import { postsController } from "./posts.controller";
import { requirePermission } from "@/plugins/rbac";
import {
  arrayOf,
  bool,
  dateTime,
  enumOf,
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
import {
  CONTENT_STATUS_VALUES,
  PLACEMENT_VALUES,
  postSchema,
  seoSchema,
} from "@/schemas/entities";

const TAGS = ["Posts"];
const ACCESS = "SUPER_ADMIN, ADMIN, or an EDITOR granted the `posts` module";

/** List rows drop the HTML body — fetch a single post to get `content`. */
const postListItemSchema = {
  ...postSchema,
  description: "A post without its `content` body, which list endpoints omit for payload size.",
};

const postBodyFields = {
  placement: enumOf(
    PLACEMENT_VALUES,
    "Where the post appears. `ARTICLE` → `/articles/{slug}`, `BLOG` → `/blogs/{slug}`, `BOTH` → canonical at `/articles/{slug}` with a permanent redirect from `/blogs/{slug}`."
  ),
  title: str("Post title.", { minLength: 1, example: "The History of Radha Kunda" }),
  slug: str("URL slug. Derived from the title when omitted, with a numeric suffix on collision.", {
    example: "history-of-radha-kunda",
  }),
  excerpt: str("Summary. Auto-derived from the first 200 characters of the body when omitted."),
  content: str("Rich-text HTML body. Sanitised server-side — scripts and event handlers are stripped.", {
    minLength: 1,
    example: "<p>The kunda was…</p>",
  }),
  coverImageId: id("media file to use as the cover image"),
  categoryIds: {
    ...arrayOf(id("category"), "Categories to attach. Replaces the existing set."),
    default: [],
  },
  tagNames: {
    ...arrayOf(
      str("Tag label.", { example: "bhakti" }),
      "Tags by name. Any name that does not exist yet is created. Replaces the existing set."
    ),
    default: [],
  },
  publishedAt: dateTime(
    "Publication instant, ISO 8601. Supplying it sets status to `PUBLISHED`; a future value schedules the post. Omit to keep it a draft."
  ),
  isFeatured: bool("Pin to the homepage feature rail.", { default: false }),
  commentsEnabled: bool("Allow signed-in members to comment.", { default: true }),
  metaTitle: str("`<title>` override. Falls back to `title`."),
  metaDescription: str("Meta description override. Falls back to `excerpt`."),
  metaKeywords: str("Comma-separated keywords.", { example: "radha kunda,history,braj" }),
  ogImageId: id("media file to use as the Open Graph image"),
  canonicalUrl: str("External canonical URL, if this is a syndicated copy."),
  noIndex: bool("Serve the post as `noindex, nofollow`.", { default: false }),
};

export async function registerPostsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/posts",
    {
      schema: op({
        tags: TAGS,
        summary: "List published posts",
        description: [
          "Published posts only, newest first. Scheduled posts (`publishedAt` in the future) are hidden until their time arrives, and `status` is ignored here — use the admin endpoint to see drafts.",
          "",
          "Filtering by `placement=ARTICLE` also returns `BOTH` posts, since those appear in both sections.",
          "",
          "`content` is omitted from list rows. Fetch `/public/posts/{slug}` for the body.",
        ].join("\n"),
        query: queryParams({
          placement: enumOf(PLACEMENT_VALUES, "Restrict to one section. `BOTH` posts always match `ARTICLE` and `BLOG` too."),
          category: str("Category slug to filter by.", { example: "philosophy" }),
          tag: str("Tag slug to filter by.", { example: "bhakti" }),
          q: str("Case-insensitive substring match on title and excerpt. For real full-text search use `/public/search`.", {
            example: "kunda",
          }),
          ...pageQuery(20),
        }),
        response: {
          200: okPaged(
            "A page of published posts.",
            "posts",
            postListItemSchema,
            "Posts on this page, newest first."
          ),
        },
      }),
    },
    (request, reply) => postsController.listPublicPosts(request, reply)
  );

  fastify.get(
    "/public/posts/:slug",
    {
      schema: op({
        tags: TAGS,
        summary: "Get a published post by slug",
        description: [
          "The full post — body, author, cover image, categories, and tags — plus a ready-to-render `seo` block containing the canonical URL, Open Graph and Twitter tags, and JSON-LD (`Article` + `BreadcrumbList`).",
          "",
          "Returns 404 for drafts and for scheduled posts that have not gone live.",
        ].join("\n"),
        params: slugParam("post"),
        response: {
          200: ok(
            "The post and its SEO block.",
            obj("Post detail.", { post: postSchema, seo: seoSchema })
          ),
        },
      }),
    },
    (request, reply) => postsController.getPublicPost(request, reply)
  );

  fastify.post(
    "/public/posts/:slug/view",
    {
      schema: op({
        tags: TAGS,
        summary: "Record a post view",
        description:
          "Increments `viewCount` by one. Takes no body and needs no token. Fire it once per page load; there is no per-visitor de-duplication.",
        params: slugParam("post"),
        response: {
          200: ok(
            "The view was counted.",
            obj("Acknowledgement.", { ok: bool("Always `true`.", { example: true }) })
          ),
        },
      }),
    },
    (request, reply) => postsController.incrementView(request, reply)
  );

  fastify.post(
    "/admin/posts",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Create a post",
        description: [
          "Creates an article or blog entry. Only `placement`, `title`, and `content` are required.",
          "",
          "The post is a `DRAFT` unless you send `publishedAt`. `categoryIds` must reference categories whose scope matches the placement; `tagNames` creates missing tags on the fly.",
        ].join("\n"),
        access: ACCESS,
        body: jsonBody("The post to create.", postBodyFields, ["placement", "title", "content"]),
        errors: [409],
        response: {
          201: ok("The created post.", postSchema),
        },
      }),
    },
    (request, reply) => postsController.createPost(request, reply)
  );

  fastify.get(
    "/admin/posts",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "List all posts",
        description:
          "Drafts, scheduled, and published posts together — this is the admin table. Filter with `status` to see one bucket. `content` is omitted from list rows.",
        access: ACCESS,
        query: queryParams({
          placement: enumOf(PLACEMENT_VALUES, "Restrict to one section."),
          category: str("Category slug to filter by.", { example: "philosophy" }),
          tag: str("Tag slug to filter by.", { example: "bhakti" }),
          q: str("Case-insensitive substring match on title and excerpt."),
          status: enumOf(CONTENT_STATUS_VALUES, "Restrict to drafts or published posts."),
          ...pageQuery(20),
        }),
        response: {
          200: okPaged("A page of posts.", "posts", postListItemSchema, "Posts on this page."),
        },
      }),
    },
    (request, reply) => postsController.listPosts(request, reply)
  );

  fastify.get(
    "/admin/posts/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Get one post by id",
        description: "Full post including `content`, whatever its status. This is what the editor loads.",
        access: ACCESS,
        params: idParam("post"),
        response: {
          200: ok("The post.", postSchema),
        },
      }),
    },
    (request, reply) => postsController.getPost(request, reply)
  );

  fastify.patch(
    "/admin/posts/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Update a post",
        description: [
          "Every field is optional — send only what changed.",
          "",
          "Sending `categoryIds` or `tagNames` **replaces** the whole set rather than adding to it. Changing the slug of a published post writes a 301 redirect from the old URL automatically.",
        ].join("\n"),
        access: ACCESS,
        params: idParam("post"),
        body: jsonBody("Fields to change. All optional.", withoutDefaults(postBodyFields)),
        errors: [409],
        response: {
          200: ok("The updated post.", postSchema),
        },
      }),
    },
    (request, reply) => postsController.updatePost(request, reply)
  );

  fastify.delete(
    "/admin/posts/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Delete a post",
        description:
          "Permanent. Comments and likes on the post are deleted with it. To take a post offline without losing it, use `/unpublish` instead.",
        access: ACCESS,
        params: idParam("post"),
        response: {
          200: okMessage("The post was deleted.", "Post deleted"),
        },
      }),
    },
    (request, reply) => postsController.deletePost(request, reply)
  );

  fastify.post(
    "/admin/posts/:id/publish",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Publish a post",
        description:
          "Sets status to `PUBLISHED` and stamps `publishedAt` with the current time if it was empty. Takes no body. The post becomes visible on the public endpoints immediately.",
        access: ACCESS,
        params: idParam("post"),
        response: {
          200: ok("The published post.", postSchema),
        },
      }),
    },
    (request, reply) => postsController.publishPost(request, reply)
  );

  fastify.post(
    "/admin/posts/:id/unpublish",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Unpublish a post",
        description:
          "Sets status back to `DRAFT`, removing it from every public endpoint. Takes no body. Content, comments, and view count are kept.",
        access: ACCESS,
        params: idParam("post"),
        response: {
          200: ok("The unpublished post.", postSchema),
        },
      }),
    },
    (request, reply) => postsController.unpublishPost(request, reply)
  );
}
