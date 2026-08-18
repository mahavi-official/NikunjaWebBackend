import { FastifyInstance } from "fastify";
import { contactController } from "./contact.controller";
import { requireRole } from "@/plugins/rbac";
import {
  bool,
  idParam,
  jsonBody,
  ok,
  okMessage,
  okPaged,
  op,
  pageQuery,
  queryParams,
  rawBody,
  str,
} from "@/schemas/common";
import { contactMessageSchema } from "@/schemas/entities";

const TAGS = ["Contact"];
const ACCESS = "SUPER_ADMIN or ADMIN";

export async function registerContactRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/public/contact",
    {
      config: {
        rateLimit: { max: 3, timeWindow: "1 hour" },
      },
      schema: op({
        tags: TAGS,
        summary: "Submit the contact form",
        description: [
          "Stores the message and emails the configured notification address.",
          "",
          "**Rate limited to 3 submissions per hour per IP.**",
          "",
          "`website` is a honeypot: render it hidden and leave it empty. Bots that fill it in are rejected. `recaptchaToken` is verified when a reCAPTCHA secret is configured.",
        ].join("\n"),
        body: jsonBody(
          "The message to send.",
          {
            name: str("Sender name.", { minLength: 1, example: "Ananda Das" }),
            email: str("Sender email — where a reply would go.", {
              format: "email",
              example: "ananda@example.com",
            }),
            phone: str("Sender phone.", { example: "+91 98765 43210" }),
            subject: str("Subject line.", { example: "Research access" }),
            message: str("Message body.", {
              minLength: 1,
              example: "I would like to know more about…",
            }),
            website: str("Honeypot. Must be empty — bots fill it in.", { maxLength: 0 }),
            recaptchaToken: str("reCAPTCHA token, when the widget is enabled on the form."),
          },
          ["name", "email", "message"]
        ),
        response: {
          201: okMessage("The message was received.", "Thank you for your message"),
        },
      }),
    },
    (request, reply) => contactController.submitMessage(request, reply)
  );

  fastify.get(
    "/admin/contact-messages",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "List contact messages",
        description:
          "Submitted messages, newest first. Filter with `isRead=false` for the unread queue — that count is also on the dashboard.",
        access: ACCESS,
        query: queryParams({
          isRead: bool("Filter by read state. Omit to get both.", { example: false }),
          ...pageQuery(20),
        }),
        response: {
          200: okPaged(
            "A page of messages.",
            "messages",
            contactMessageSchema,
            "Messages on this page, newest first."
          ),
        },
      }),
    },
    (request, reply) => contactController.listMessages(request, reply)
  );

  fastify.patch(
    "/admin/contact-messages/:id/read",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Mark a message read",
        description:
          "Sets `isRead` to true and drops it out of the unread count. Takes no body. There is no unread toggle.",
        access: ACCESS,
        params: idParam("contact message"),
        response: {
          200: ok("The message, now marked read.", contactMessageSchema),
        },
      }),
    },
    (request, reply) => contactController.markRead(request, reply)
  );

  fastify.get(
    "/admin/contact-messages/export.csv",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Export messages as CSV",
        description:
          "Every message — not just the current page — as `text/csv`, served with `Content-Disposition: attachment; filename=\"contact-messages.csv\"`.",
        access: ACCESS,
        produces: ["text/csv"],
        response: {
          200: rawBody(
            "CSV file. One header row, then one row per message.",
            "id,name,email,phone,subject,message,isRead,createdAt"
          ),
        },
      }),
    },
    (request, reply) => contactController.exportCsv(request, reply)
  );
}
