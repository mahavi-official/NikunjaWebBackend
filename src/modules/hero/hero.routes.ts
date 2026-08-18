import { FastifyInstance } from "fastify";
import { heroController } from "./hero.controller";
import { requireRole } from "@/plugins/rbac";
import {
  arrayOf,
  bool,
  id,
  idParam,
  int,
  jsonBody,
  ok,
  okMessage,
  okWrapped,
  op,
  str,
  withoutDefaults,
} from "@/schemas/common";
import { heroSlideSchema } from "@/schemas/entities";

const TAGS = ["Hero"];
const ACCESS = "SUPER_ADMIN, ADMIN, or EDITOR";

const slideBodyFields = {
  title: str("Headline shown on the slide.", { minLength: 1, example: "Welcome to Radha Kunda" }),
  subtitle: str("Supporting line under the headline."),
  imageId: id("media file to use as the background image"),
  ctaLabel: str("Call-to-action button label.", { example: "Explore research" }),
  ctaUrl: str("Where the call-to-action points.", { example: "/research" }),
  order: int("Position in the carousel, ascending.", { default: 0, example: 0 }),
  isActive: bool("Show the slide on the public homepage.", { default: true }),
};

export async function registerHeroRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/hero",
    {
      schema: op({
        tags: TAGS,
        summary: "List active hero slides",
        description:
          "Slides for the homepage carousel, in `order`, each with its full media record. Inactive slides are excluded. Not paginated.",
        response: {
          200: okWrapped(
            "The active slides.",
            "slides",
            arrayOf(heroSlideSchema, "Slides in carousel order.")
          ),
        },
      }),
    },
    (request, reply) => heroController.listPublicSlides(request, reply)
  );

  fastify.post(
    "/admin/hero",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Create a hero slide",
        description:
          "`title` and `imageId` are required — upload the background through `POST /admin/media/upload` first. New slides are active unless you say otherwise.",
        access: ACCESS,
        body: jsonBody("The slide to create.", slideBodyFields, ["title", "imageId"]),
        response: {
          201: ok("The created slide.", heroSlideSchema),
        },
      }),
    },
    (request, reply) => heroController.createSlide(request, reply)
  );

  fastify.get(
    "/admin/hero",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "List all hero slides",
        description: "Active and inactive slides together, in `order`. Not paginated.",
        access: ACCESS,
        response: {
          200: okWrapped("Every slide.", "slides", arrayOf(heroSlideSchema, "Slides in order.")),
        },
      }),
    },
    (request, reply) => heroController.listSlides(request, reply)
  );

  fastify.patch(
    "/admin/hero/:id",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Update a hero slide",
        description:
          "Send only the fields you want to change. Reordering the carousel means patching `order` on each affected slide.",
        access: ACCESS,
        params: idParam("hero slide"),
        body: jsonBody("Fields to change. All optional.", withoutDefaults(slideBodyFields)),
        response: {
          200: ok("The updated slide.", heroSlideSchema),
        },
      }),
    },
    (request, reply) => heroController.updateSlide(request, reply)
  );

  fastify.delete(
    "/admin/hero/:id",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Delete a hero slide",
        description:
          "Removes the slide. The background image stays in the media library. To hide a slide temporarily, patch `isActive: false` instead.",
        access: ACCESS,
        params: idParam("hero slide"),
        response: {
          200: okMessage("The slide was deleted.", "Slide deleted"),
        },
      }),
    },
    (request, reply) => heroController.deleteSlide(request, reply)
  );
}
