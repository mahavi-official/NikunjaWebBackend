import { FastifyInstance } from "fastify";
import { researchController } from "./research.controller";
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
  op,
  pageQuery,
  pathParams,
  plainError,
  queryParams,
  slugParam,
  str,
  withoutDefaults,
} from "@/schemas/common";
import {
  publicResearchSchema,
  researchFileSchema,
  researchSchema,
  seoSchema,
} from "@/schemas/entities";

const TAGS = ["Research"];
const ACCESS = "SUPER_ADMIN, ADMIN, or an EDITOR granted the `research` module";

const researchBodyFields = {
  title: str("Publication title.", { minLength: 1, example: "Hydrology of Radha Kunda" }),
  slug: str("URL slug. Derived from the title when omitted.", { example: "hydrology-radha-kunda" }),
  abstract: str("Public abstract. Always visible, unlike the PDF body.", {
    minLength: 1,
    example: "This paper surveys…",
  }),
  categoryId: id("`RESEARCH`-scoped category"),
  authorIds: {
    ...arrayOf(
      obj("One byline entry.", {
        authorId: id("author"),
        order: int("Byline position, ascending.", { default: 0, example: 0 }),
        isCorresponding: bool("Marks the corresponding author.", { default: false }),
      }),
      "Byline. Replaces the existing set. Create authors via `/admin/authors` first."
    ),
    default: [],
  },
  tagNames: {
    ...arrayOf(
      str("Tag label.", { example: "hydrology" }),
      "Tags by name. Missing tags are created. Replaces the existing set."
    ),
    default: [],
  },
  publishedAt: dateTime(
    "Publication instant, ISO 8601. Supplying it sets status to `PUBLISHED`; a future value schedules it. Omit to keep it a draft."
  ),
  isFeatured: bool("Pin to the homepage research rail.", { default: false }),
  doi: str("Digital Object Identifier.", { example: "10.1000/xyz123" }),
  journal: str("Journal name.", { example: "Journal of Braj Studies" }),
  volume: str("Journal volume.", { example: "12" }),
  issue: str("Journal issue.", { example: "3" }),
  pages: str("Page range.", { example: "112-130" }),
  publicationYear: int("Year of publication.", { example: 2026 }),
  keywords: {
    ...arrayOf(str("Keyword.", { example: "hydrology" }), "Author-supplied keywords."),
    default: [],
  },
  metaTitle: str("`<title>` override."),
  metaDescription: str("Meta description override. Falls back to the abstract."),
  ogImageId: id("media file to use as the Open Graph image"),
  noIndex: bool("Serve the publication page as `noindex, nofollow`.", { default: false }),
};

export async function registerResearchRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/research",
    {
      schema: op({
        tags: TAGS,
        summary: "List published research",
        description:
          "Published publications, newest first, each with its byline and abstract. PDF contents are never included here — see `/me/research/{slug}/view-url`.",
        query: queryParams({
          category: str("Category slug to filter by.", { example: "archaeology" }),
          author: str("Author slug to filter by.", { example: "r-sharma" }),
          year: int("Restrict to one publication year.", { example: 2026 }),
          q: str("Case-insensitive substring match on title and abstract."),
          ...pageQuery(20),
        }),
        response: {
          200: okPaged(
            "A page of published research.",
            "research",
            publicResearchSchema,
            "Publications on this page, newest first."
          ),
        },
      }),
    },
    (request, reply) => researchController.listPublicResearch(request, reply)
  );

  fastify.get(
    "/public/research/:slug",
    {
      schema: op({
        tags: TAGS,
        summary: "Get a published publication by slug",
        description: [
          "The publication with its byline, academic metadata, and a `seo` block carrying `ScholarlyArticle` JSON-LD.",
          "",
          "`files` lists the attached PDFs by label and size but **carries no URLs** — the PDFs live in a private bucket. A signed-in user gets a 60-second link from `/me/research/{slug}/view-url`.",
        ].join("\n"),
        params: slugParam("research"),
        response: {
          200: ok(
            "The publication and its SEO block.",
            obj("Research detail.", { research: publicResearchSchema, seo: seoSchema })
          ),
        },
      }),
    },
    (request, reply) => researchController.getPublicResearch(request, reply)
  );

  fastify.get(
    "/me/research/:slug/view-url",
    {
      schema: op({
        tags: TAGS,
        summary: "Get a time-limited PDF link",
        description: [
          "Issues a presigned S3 URL valid for 60 seconds, then records who opened which file. Any signed-in user may call it — this is the gate that makes research downloads auditable.",
          "",
          "Omit `fileId` to get the first attached file.",
        ].join("\n"),
        access: "any signed-in user",
        params: slugParam("research"),
        query: queryParams({
          fileId: id("specific attached file. Defaults to the first one"),
        }),
        response: {
          200: ok(
            "A short-lived download URL.",
            obj("Presigned link.", {
              url: str("Presigned S3 URL. Expires 60 seconds after issue.", {
                example: "https://private-bucket.s3.amazonaws.com/research/paper.pdf?X-Amz-…",
              }),
              fileName: str("Original file name, for the download prompt.", {
                example: "radha-kunda-2026.pdf",
              }),
            })
          ),
        },
      }),
    },
    (request, reply) => researchController.getViewUrl(request, reply)
  );

  fastify.post(
    "/admin/research",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Create a publication",
        description:
          "Only `title` and `abstract` are required. Create the record first, then attach PDFs with `POST /admin/research/{id}/files`.",
        access: ACCESS,
        body: jsonBody("The publication to create.", researchBodyFields, ["title", "abstract"]),
        errors: [409],
        response: {
          201: ok("The created publication.", researchSchema),
        },
      }),
    },
    (request, reply) => researchController.createResearch(request, reply)
  );

  fastify.get(
    "/admin/research",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "List all research",
        description: "Drafts and published publications together, newest first. This is the admin table.",
        access: ACCESS,
        query: queryParams({
          category: str("Category slug to filter by."),
          author: str("Author slug to filter by."),
          year: int("Restrict to one publication year.", { example: 2026 }),
          q: str("Case-insensitive substring match on title and abstract."),
          ...pageQuery(20),
        }),
        response: {
          200: okPaged(
            "A page of publications.",
            "research",
            researchSchema,
            "Publications on this page."
          ),
        },
      }),
    },
    (request, reply) => researchController.listResearch(request, reply)
  );

  fastify.get(
    "/admin/research/:id",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Get one publication by id",
        description:
          "Full record whatever its status, including file storage keys and `extractedText` — the text pulled from the PDFs to feed search. The public endpoints strip that field; this one does not.",
        access: ACCESS,
        params: idParam("research"),
        response: {
          200: ok("The publication.", researchSchema),
        },
      }),
    },
    (request, reply) => researchController.getResearch(request, reply)
  );

  fastify.patch(
    "/admin/research/:id",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Update a publication",
        description:
          "Send only the fields you want to change. `authorIds`, `tagNames`, and `keywords` **replace** the existing sets rather than adding to them.",
        access: ACCESS,
        params: idParam("research"),
        body: jsonBody("Fields to change. All optional.", withoutDefaults(researchBodyFields)),
        errors: [409],
        response: {
          200: ok("The updated publication.", researchSchema),
        },
      }),
    },
    (request, reply) => researchController.updateResearch(request, reply)
  );

  fastify.delete(
    "/admin/research/:id",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Delete a publication",
        description:
          "Permanent. Byline entries, tags, view records, and every attached PDF go with it. Use `/unpublish` to take it offline instead.",
        access: ACCESS,
        params: idParam("research"),
        response: {
          200: okMessage("The publication was deleted.", "Research deleted"),
        },
      }),
    },
    (request, reply) => researchController.deleteResearch(request, reply)
  );

  fastify.post(
    "/admin/research/:id/publish",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Publish a publication",
        description:
          "Sets status to `PUBLISHED` and stamps `publishedAt` if it was empty. Takes no body.",
        access: ACCESS,
        params: idParam("research"),
        response: {
          200: ok("The published publication.", researchSchema),
        },
      }),
    },
    (request, reply) => researchController.publishResearch(request, reply)
  );

  fastify.post(
    "/admin/research/:id/unpublish",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Unpublish a publication",
        description: "Sets status back to `DRAFT`, removing it from public endpoints. Takes no body.",
        access: ACCESS,
        params: idParam("research"),
        response: {
          200: ok("The unpublished publication.", researchSchema),
        },
      }),
    },
    (request, reply) => researchController.unpublishResearch(request, reply)
  );

  fastify.post(
    "/admin/research/:id/files",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Attach a PDF to a publication",
        description: [
          "`multipart/form-data` with a file part named **`file`** and an optional text part named **`label`** (defaults to the file name).",
          "",
          "The PDF goes into the private bucket — it never gets a public URL. Its text is extracted on upload to feed full-text search, and the page count is stored. Limit is 50 MB.",
          "",
          "```bash",
          'curl -X POST "$API/api/v1/admin/research/$ID/files" \\',
          '  -H "Authorization: Bearer $TOKEN" \\',
          '  -F "label=Full paper" -F "file=@paper.pdf"',
          "```",
        ].join("\n"),
        access: ACCESS,
        params: idParam("research"),
        consumes: ["multipart/form-data"],
        response: {
          201: ok("The stored file.", researchFileSchema),
          400: plainError("The request carried no file part.", "No file uploaded"),
        },
      }),
    },
    (request, reply) => researchController.uploadFile(request, reply)
  );

  fastify.delete(
    "/admin/research/files/:fileId",
    {
      preHandler: requirePermission("research"),
      schema: op({
        tags: TAGS,
        summary: "Delete an attached PDF",
        description:
          "Removes the row and the object from the private bucket. The publication itself is kept. Note the id here is the **file** id, not the publication id.",
        access: ACCESS,
        params: pathParams({ fileId: id("research file") }),
        response: {
          200: okMessage("The file was deleted.", "File deleted"),
        },
      }),
    },
    (request, reply) => researchController.deleteFile(request, reply)
  );
}
