import { FastifyInstance } from "fastify";
import { videosController } from "./videos.controller";
import { requirePermission } from "@/plugins/rbac";
import {
  arrayOf,
  bool,
  dateTime,
  id,
  idParam,
  int,
  jsonBody,
  obj,
  ok,
  okMessage,
  okPaged,
  okWrapped,
  op,
  pageQuery,
  queryParams,
  slugParam,
  str,
  withoutDefaults,
} from "@/schemas/common";
import { seoSchema, videoCategorySchema, videoSchema } from "@/schemas/entities";

const TAGS = ["Videos"];
const ACCESS = "SUPER_ADMIN, ADMIN, or an EDITOR granted the `videos` module";

const videoBodyFields = {
  title: str("Video title.", { minLength: 1, example: "Morning kirtan at Radha Kunda" }),
  slug: str("URL slug. Derived from the title when omitted.", { example: "morning-kirtan" }),
  description: str("Description shown under the player."),
  youtubeUrl: str(
    "Any YouTube URL form — watch, youtu.be, shorts, or embed. The id is parsed out and the thumbnail fetched automatically.",
    { format: "uri", example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
  ),
  durationSec: int("Runtime in seconds, for the duration badge and JSON-LD.", { example: 754 }),
  categoryId: id("video category"),
  publishedAt: dateTime(
    "Publication instant, ISO 8601. Supplying it sets status to `PUBLISHED`; a future value schedules it. Omit to keep it a draft."
  ),
  isFeatured: bool("Pin to the homepage video rail.", { default: false }),
  metaTitle: str("`<title>` override."),
  metaDescription: str("Meta description override. Falls back to the description."),
  noIndex: bool("Serve the video page as `noindex, nofollow`.", { default: false }),
};

const videoCategoryBodyFields = {
  name: str("Display name.", { minLength: 1, example: "Kirtan" }),
  slug: str("URL slug. Derived from the name when omitted.", { example: "kirtan" }),
  description: str("Short blurb."),
  metaTitle: str("`<title>` override."),
  metaDescription: str("Meta description override."),
  noIndex: bool("Serve the category page as `noindex, nofollow`.", { default: false }),
};

export async function registerVideosRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/videos",
    {
      schema: op({
        tags: TAGS,
        summary: "List published videos",
        description:
          "Published videos, newest first, each with its YouTube id, thumbnail, and category. Scheduled videos stay hidden until their `publishedAt` passes.",
        query: queryParams({
          category: str("Video category slug to filter by.", { example: "kirtan" }),
          q: str("Case-insensitive substring match on title and description."),
          ...pageQuery(20),
        }),
        response: {
          200: okPaged("A page of videos.", "videos", videoSchema, "Videos on this page, newest first."),
        },
      }),
    },
    (request, reply) => videosController.listPublicVideos(request, reply)
  );

  fastify.get(
    "/public/videos/:slug",
    {
      schema: op({
        tags: TAGS,
        summary: "Get a published video by slug",
        description:
          "The video plus a `seo` block with `VideoObject` JSON-LD. Build the player URL from `youtubeId` as `https://www.youtube.com/embed/{youtubeId}`.",
        params: slugParam("video"),
        response: {
          200: ok(
            "The video and its SEO block.",
            obj("Video detail.", { video: videoSchema, seo: seoSchema })
          ),
        },
      }),
    },
    (request, reply) => videosController.getPublicVideo(request, reply)
  );

  fastify.post(
    "/public/videos/:slug/view",
    {
      schema: op({
        tags: TAGS,
        summary: "Record a video view",
        description:
          "Increments `viewCount` by one. Takes no body and needs no token. There is no per-visitor de-duplication.",
        params: slugParam("video"),
        response: {
          200: ok(
            "The view was counted.",
            obj("Acknowledgement.", { ok: bool("Always `true`.", { example: true }) })
          ),
        },
      }),
    },
    (request, reply) => videosController.incrementView(request, reply)
  );

  fastify.get(
    "/public/video-categories",
    {
      schema: op({
        tags: TAGS,
        summary: "List video categories",
        description:
          "The video section's own taxonomy, in manual `order`. Separate from post and research categories. Not paginated.",
        response: {
          200: okWrapped(
            "Every video category.",
            "categories",
            arrayOf(videoCategorySchema, "Categories in display order.")
          ),
        },
      }),
    },
    (request, reply) => videosController.listCategories(request, reply)
  );

  fastify.post(
    "/admin/videos",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "Create a video",
        description:
          "Only `title` and `youtubeUrl` are required. The YouTube id is parsed from the URL and the thumbnail is fetched at save time. Re-using a YouTube id returns 409.",
        access: ACCESS,
        body: jsonBody("The video to create.", videoBodyFields, ["title", "youtubeUrl"]),
        errors: [409],
        response: {
          201: ok("The created video.", videoSchema),
        },
      }),
    },
    (request, reply) => videosController.createVideo(request, reply)
  );

  fastify.get(
    "/admin/videos",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "List all videos",
        description: "Drafts and published videos together, newest first. This is the admin table.",
        access: ACCESS,
        query: queryParams({
          category: str("Video category slug to filter by."),
          q: str("Case-insensitive substring match on title and description."),
          ...pageQuery(20),
        }),
        response: {
          200: okPaged("A page of videos.", "videos", videoSchema, "Videos on this page."),
        },
      }),
    },
    (request, reply) => videosController.listVideos(request, reply)
  );

  fastify.get(
    "/admin/videos/:id",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "Get one video by id",
        description: "Full record whatever its status, for the edit form.",
        access: ACCESS,
        params: idParam("video"),
        response: {
          200: ok("The video.", videoSchema),
        },
      }),
    },
    (request, reply) => videosController.getVideo(request, reply)
  );

  fastify.patch(
    "/admin/videos/:id",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "Update a video",
        description:
          "Send only the fields you want to change. Supplying a new `youtubeUrl` re-parses the id and re-fetches the thumbnail.",
        access: ACCESS,
        params: idParam("video"),
        body: jsonBody("Fields to change. All optional.", withoutDefaults(videoBodyFields)),
        errors: [409],
        response: {
          200: ok("The updated video.", videoSchema),
        },
      }),
    },
    (request, reply) => videosController.updateVideo(request, reply)
  );

  fastify.delete(
    "/admin/videos/:id",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "Delete a video",
        description:
          "Permanent, and only removes the record here — nothing on YouTube is touched. Use `/unpublish` to hide it instead.",
        access: ACCESS,
        params: idParam("video"),
        response: {
          200: okMessage("The video was deleted.", "Video deleted"),
        },
      }),
    },
    (request, reply) => videosController.deleteVideo(request, reply)
  );

  fastify.post(
    "/admin/videos/:id/publish",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "Publish a video",
        description: "Sets status to `PUBLISHED` and stamps `publishedAt` if it was empty. Takes no body.",
        access: ACCESS,
        params: idParam("video"),
        response: {
          200: ok("The published video.", videoSchema),
        },
      }),
    },
    (request, reply) => videosController.publishVideo(request, reply)
  );

  fastify.post(
    "/admin/videos/:id/unpublish",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "Unpublish a video",
        description: "Sets status back to `DRAFT`, removing it from public endpoints. Takes no body.",
        access: ACCESS,
        params: idParam("video"),
        response: {
          200: ok("The unpublished video.", videoSchema),
        },
      }),
    },
    (request, reply) => videosController.unpublishVideo(request, reply)
  );

  fastify.post(
    "/admin/video-categories",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "Create a video category",
        description: "Only `name` is required. Slugs are globally unique within the video taxonomy.",
        access: ACCESS,
        body: jsonBody("The category to create.", videoCategoryBodyFields, ["name"]),
        errors: [409],
        response: {
          201: ok("The created category.", videoCategorySchema),
        },
      }),
    },
    (request, reply) => videosController.createCategory(request, reply)
  );

  fastify.get(
    "/admin/video-categories",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "List video categories (admin)",
        description: "Same data as the public endpoint, behind a token for the category picker. Not paginated.",
        access: ACCESS,
        response: {
          200: okWrapped(
            "Every video category.",
            "categories",
            arrayOf(videoCategorySchema, "Categories in display order.")
          ),
        },
      }),
    },
    (request, reply) => videosController.listCategories(request, reply)
  );

  fastify.delete(
    "/admin/video-categories/:id",
    {
      preHandler: requirePermission("videos"),
      schema: op({
        tags: TAGS,
        summary: "Delete a video category",
        description: "Videos in the category are kept; their `categoryId` is set to null.",
        access: ACCESS,
        params: idParam("video category"),
        response: {
          200: okMessage("The category was deleted.", "Video category deleted"),
        },
      }),
    },
    (request, reply) => videosController.deleteCategory(request, reply)
  );
}
