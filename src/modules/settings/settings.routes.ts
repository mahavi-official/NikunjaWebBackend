import { FastifyInstance } from "fastify";
import { settingsController } from "./settings.controller";
import { requireRole } from "@/plugins/rbac";
import { JsonSchema, okWrapped, op } from "@/schemas/common";
import { settingsMapSchema } from "@/schemas/entities";

const TAGS = ["Settings"];

const settingsBody: JsonSchema = {
  type: "object",
  description:
    "Keys to write, as a flat `{ key: value }` map. Values may be any JSON. Keys not listed are left alone.",
  additionalProperties: true,
  example: {
    "site.title": "Radhakundah",
    "contact.email": "hello@radhakundah.com",
    "social.youtube": "https://youtube.com/@radhakundah",
  },
};

export async function registerSettingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/settings",
    {
      schema: op({
        tags: TAGS,
        summary: "Get public site settings",
        description: [
          "The subset of settings safe to expose to anonymous visitors: keys starting with `site.`, `contact.`, `social.`, `analytics.`, or `seo.`.",
          "",
          "Everything else — including operational keys — is filtered out. Fetch this once at app start for the header, footer, and analytics setup.",
        ].join("\n"),
        response: {
          200: okWrapped("The public settings map.", "settings", settingsMapSchema),
        },
      }),
    },
    (request, reply) => settingsController.getPublicSettings(request, reply)
  );

  fastify.get(
    "/admin/settings",
    {
      preHandler: requireRole("SUPER_ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Get all settings",
        description: "Every stored setting, unfiltered.",
        access: "SUPER_ADMIN only",
        response: {
          200: okWrapped("The full settings map.", "settings", settingsMapSchema),
        },
      }),
    },
    (request, reply) => settingsController.getSettings(request, reply)
  );

  fastify.patch(
    "/admin/settings",
    {
      preHandler: requireRole("SUPER_ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Update settings",
        description: [
          "Upserts each key in the body — send only what changed. There is no delete; write `null` to blank a value.",
          "",
          "The response is the **complete** settings map after the write, not just the keys you sent.",
          "",
          "```json",
          '{ "site.title": "Radhakundah", "contact.email": "hello@radhakundah.com" }',
          "```",
        ].join("\n"),
        access: "SUPER_ADMIN only",
        body: settingsBody,
        response: {
          200: okWrapped("The full settings map after the write.", "settings", settingsMapSchema),
        },
      }),
    },
    (request, reply) => settingsController.updateSettings(request, reply)
  );
}
