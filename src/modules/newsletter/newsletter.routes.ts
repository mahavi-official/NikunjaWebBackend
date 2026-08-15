import { FastifyInstance } from "fastify";
import { newsletterController } from "./newsletter.controller";
import { requireRole } from "@/plugins/rbac";
import {
  jsonBody,
  okMessage,
  okPaged,
  op,
  pageQuery,
  pathParams,
  queryParams,
  rawBody,
  str,
} from "@/schemas/common";
import { subscriberSchema } from "@/schemas/entities";

const TAGS = ["Newsletter"];
const ACCESS = "SUPER_ADMIN or ADMIN";

export async function registerNewsletterRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/public/newsletter/subscribe",
    {
      config: {
        rateLimit: { max: 3, timeWindow: "1 hour" },
      },
      schema: op({
        tags: TAGS,
        summary: "Subscribe to the newsletter",
        description: [
          "Adds the address to the mailing list and issues its unsubscribe token.",
          "",
          "**Rate limited to 3 submissions per hour per IP.** Subscribing an address that is already on the list re-activates it rather than erroring, so the response never reveals whether someone was already subscribed.",
        ].join("\n"),
        body: jsonBody(
          "The address to subscribe.",
          {
            email: str("Email address.", { format: "email", example: "reader@example.com" }),
          },
          ["email"]
        ),
        response: {
          201: okMessage("The address was subscribed.", "Subscribed"),
        },
      }),
    },
    (request, reply) => newsletterController.subscribe(request, reply)
  );

  fastify.get(
    "/public/newsletter/unsubscribe/:token",
    {
      schema: op({
        tags: TAGS,
        summary: "Unsubscribe with a token",
        description:
          "One-click unsubscribe. The token is the `unsubscribeToken` embedded in the footer link of every mailing. Sets `isActive` to false; the row is kept so the address is not silently re-added later.",
        params: pathParams({
          token: str("Unsubscribe token from the email footer link.", { example: "a1b2c3d4e5f6" }),
        }),
        response: {
          200: okMessage("The address was unsubscribed.", "Unsubscribed"),
        },
      }),
    },
    (request, reply) => newsletterController.unsubscribe(request, reply)
  );

  fastify.get(
    "/admin/newsletter",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "List subscribers",
        description: "Every subscriber, newest first, including ones who have unsubscribed (`isActive: false`).",
        access: ACCESS,
        query: queryParams(pageQuery(50)),
        response: {
          200: okPaged(
            "A page of subscribers.",
            "subscribers",
            subscriberSchema,
            "Subscribers on this page, newest first."
          ),
        },
      }),
    },
    (request, reply) => newsletterController.listSubscribers(request, reply)
  );

  fastify.get(
    "/admin/newsletter/export.csv",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Export subscribers as CSV",
        description:
          "The whole list as `text/csv`, served with `Content-Disposition: attachment; filename=\"subscribers.csv\"`. Feed this to your mailing provider.",
        access: ACCESS,
        produces: ["text/csv"],
        response: {
          200: rawBody(
            "CSV file. One header row, then one row per subscriber.",
            "id,email,isActive,createdAt"
          ),
        },
      }),
    },
    (request, reply) => newsletterController.exportCsv(request, reply)
  );
}
