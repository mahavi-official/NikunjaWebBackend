import { FastifyInstance } from "fastify";
import { requirePermission, requireRole } from "@/plugins/rbac";
import {
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
  newsletterIssueLinkSchema,
  newsletterIssueSchema,
  seoSchema,
} from "@/schemas/entities";
import { issuesController } from "./issues.controller";

const TAGS = ["Newsletter"];
const WRITE_ACCESS = "SUPER_ADMIN, ADMIN, or an EDITOR granted the `posts` module";
const SEND_ACCESS = "SUPER_ADMIN or ADMIN";

const listItemSchema = {
  ...newsletterIssueSchema,
  description: "An issue without its `content` body, which list endpoints omit.",
};

const issueBodyFields = {
  title: str("Issue title. Also used as the email subject.", { minLength: 1, example: "Notes from the Kartik parikrama" }),
  subtitle: str("One-line deck shown under the title and as the inbox preview."),
  slug: str("URL slug. Derived from the title when omitted, with a numeric suffix on collision."),
  excerpt: str("Archive summary. Auto-derived from the first 200 characters of the body when omitted."),
  content: str("Rich-text HTML body. Sanitised server-side.", { minLength: 1, example: "<p>Dear readers…</p>" }),
  coverImageId: id("media file to use as the cover image"),
  publishedAt: dateTime("Publish on the website at this instant. Does not send the email — use `/send`."),
  metaTitle: str("`<title>` override."),
  metaDescription: str("Meta description override."),
  noIndex: bool("Serve the issue page as `noindex, nofollow`.", { default: false }),
};

export async function registerNewsletterIssueRoutes(fastify: FastifyInstance) {
  // ───────────────────────────── public ─────────────────────────────

  fastify.get(
    "/public/newsletter/issues",
    {
      schema: op({
        tags: TAGS,
        summary: "List published newsletter issues",
        description: "The archive, newest first. `content` is omitted from list rows.",
        query: queryParams({
          q: str("Case-insensitive match on title, subtitle and excerpt."),
          ...pageQuery(20),
        }),
        response: {
          200: okPaged("A page of issues.", "issues", listItemSchema, "Issues on this page, newest first."),
        },
      }),
    },
    (request, reply) => issuesController.listPublic(request, reply)
  );

  fastify.get(
    "/public/newsletter/issues/:slug",
    {
      schema: op({
        tags: TAGS,
        summary: "Get a published newsletter issue",
        description: "The full issue, the next newer and older issues for navigation, and a ready-to-render `seo` block. 404 for drafts.",
        params: slugParam("newsletter issue"),
        response: {
          200: ok(
            "The issue.",
            obj("Issue detail.", {
              issue: newsletterIssueSchema,
              newer: newsletterIssueLinkSchema,
              older: newsletterIssueLinkSchema,
              seo: seoSchema,
            })
          ),
        },
      }),
    },
    (request, reply) => issuesController.getPublic(request, reply)
  );

  // ───────────────────────────── admin ─────────────────────────────

  fastify.get(
    "/admin/newsletter/issues",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "List all newsletter issues",
        description: "Drafts first, then published issues newest first. Includes send status and counts.",
        access: WRITE_ACCESS,
        query: queryParams({
          status: enumOf(CONTENT_STATUS_VALUES, "Restrict to drafts or published issues."),
          q: str("Case-insensitive match on title, subtitle and excerpt."),
          ...pageQuery(20),
        }),
        response: {
          200: okPaged("A page of issues.", "issues", listItemSchema, "Issues on this page."),
        },
      }),
    },
    (request, reply) => issuesController.list(request, reply)
  );

  fastify.post(
    "/admin/newsletter/issues",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Create a newsletter issue",
        description: "A draft unless `publishedAt` is sent. Creating an issue never emails anyone.",
        access: WRITE_ACCESS,
        body: jsonBody("The issue to create.", issueBodyFields, ["title", "content"]),
        response: { 201: ok("The created issue.", newsletterIssueSchema) },
      }),
    },
    (request, reply) => issuesController.create(request, reply)
  );

  fastify.get(
    "/admin/newsletter/issues/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Get one newsletter issue",
        description: "Full issue including `content` and send progress. Poll this while `sendStatus` is `SENDING`.",
        access: WRITE_ACCESS,
        params: idParam("newsletter issue"),
        response: { 200: ok("The issue.", newsletterIssueSchema) },
      }),
    },
    (request, reply) => issuesController.get(request, reply)
  );

  fastify.patch(
    "/admin/newsletter/issues/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Update a newsletter issue",
        description:
          "Send only what changed; `null` clears a nullable field. Rejected with 409 while the issue is being sent. Changing the slug of a published issue writes a 301 from the old URL. Editing a sent issue changes the web page only.",
        access: WRITE_ACCESS,
        params: idParam("newsletter issue"),
        body: jsonBody("Fields to change.", withoutDefaults(issueBodyFields)),
        errors: [409],
        response: { 200: ok("The updated issue.", newsletterIssueSchema) },
      }),
    },
    (request, reply) => issuesController.update(request, reply)
  );

  fastify.delete(
    "/admin/newsletter/issues/:id",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Delete a newsletter issue",
        description: "Permanent, along with its delivery records. Rejected with 409 while the issue is being sent.",
        access: WRITE_ACCESS,
        params: idParam("newsletter issue"),
        errors: [409],
        response: { 200: okMessage("The issue was deleted.", "Issue deleted") },
      }),
    },
    (request, reply) => issuesController.remove(request, reply)
  );

  fastify.post(
    "/admin/newsletter/issues/:id/publish",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Publish an issue on the website",
        description: "Makes the issue page live without emailing it. Takes no body.",
        access: WRITE_ACCESS,
        params: idParam("newsletter issue"),
        response: { 200: ok("The published issue.", newsletterIssueSchema) },
      }),
    },
    (request, reply) => issuesController.publish(request, reply)
  );

  fastify.post(
    "/admin/newsletter/issues/:id/unpublish",
    {
      preHandler: requirePermission("posts"),
      schema: op({
        tags: TAGS,
        summary: "Take an issue off the website",
        description: "Back to `DRAFT`. Emails already delivered cannot be recalled. Takes no body.",
        access: WRITE_ACCESS,
        params: idParam("newsletter issue"),
        errors: [409],
        response: { 200: ok("The unpublished issue.", newsletterIssueSchema) },
      }),
    },
    (request, reply) => issuesController.unpublish(request, reply)
  );

  fastify.post(
    "/admin/newsletter/issues/:id/test",
    {
      preHandler: requirePermission("posts"),
      config: { rateLimit: { max: 10, timeWindow: "10 minutes" } },
      schema: op({
        tags: TAGS,
        summary: "Send a test email",
        description:
          "Emails one copy, subject prefixed `[Test]`, to `email` or to your own address. Works on drafts. Records no delivery and does not change the issue.",
        access: WRITE_ACCESS,
        params: idParam("newsletter issue"),
        body: jsonBody("Where to send the test.", {
          email: str("Recipient. Defaults to the signed-in user's address.", { format: "email" }),
        }),
        response: { 200: okMessage("The test was sent.", "Test email sent to you@example.com") },
      }),
    },
    (request, reply) => issuesController.testSend(request, reply)
  );

  fastify.post(
    "/admin/newsletter/issues/:id/send",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: op({
        tags: TAGS,
        summary: "Email the issue to every subscriber",
        description: [
          "Publishes the issue on the website if it is not live yet, then emails every active subscriber in the background, one message each with their own unsubscribe link. Returns 202 at once with `sendStatus: SENDING`; poll `GET /admin/newsletter/issues/{id}` for `sentCount`.",
          "",
          "Allowed when `sendStatus` is `NOT_SENT` or `FAILED`, or `SENT` with `failedCount > 0` (a retry). Subscribers who already have the issue are never emailed twice. 409 otherwise; 422 when there are no active subscribers.",
        ].join("\n"),
        access: SEND_ACCESS,
        params: idParam("newsletter issue"),
        errors: [409, 422],
        response: { 202: ok("Sending has started.", newsletterIssueSchema) },
      }),
    },
    (request, reply) => issuesController.send(request, reply)
  );
}
