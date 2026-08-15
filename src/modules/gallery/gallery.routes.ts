import { FastifyInstance } from "fastify";
import { galleryController } from "./gallery.controller";
import { requirePermission } from "@/plugins/rbac";
import {
  arrayOf,
  bool,
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
  pathParams,
  queryParams,
  slugParam,
  str,
  withoutDefaults,
} from "@/schemas/common";
import { galleryImageSchema, gallerySegmentSchema, seoSchema } from "@/schemas/entities";

const TAGS = ["Gallery"];
const ACCESS = "SUPER_ADMIN, ADMIN, or an EDITOR granted the `gallery` module";

const segmentBodyFields = {
  name: str("Segment name.", { minLength: 1, example: "Kartik Parikrama" }),
  slug: str("URL slug. Derived from the name when omitted.", { example: "kartik-parikrama" }),
  description: str("Blurb shown on the segment card in the gallery index."),
  coverImageId: id("media file to use as the segment card image"),
  isPublished: bool("Visible on the public gallery endpoints.", { default: true }),
  metaTitle: str("`<title>` override."),
  metaDescription: str("Meta description override."),
  noIndex: bool("Serve the segment page as `noindex, nofollow`.", { default: false }),
};

export async function registerGalleryRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/gallery",
    {
      schema: op({
        tags: TAGS,
        summary: "List published gallery segments",
        description: [
          "Segments in manual `order`, each with its cover image and an image count in `_count.images`. Unpublished segments are hidden.",
          "",
          "The images themselves are not included — fetch a segment by slug for those.",
        ].join("\n"),
        query: queryParams(pageQuery(50)),
        response: {
          200: okPaged(
            "A page of segments.",
            "segments",
            gallerySegmentSchema,
            "Segments on this page, in display order."
          ),
        },
      }),
    },
    (request, reply) => galleryController.listPublicSegments(request, reply)
  );

  fastify.get(
    "/public/gallery/:slug",
    {
      schema: op({
        tags: TAGS,
        summary: "Get a published segment by slug",
        description:
          "The segment with every image in display order, each carrying its media record, alt text, and caption. Includes a `seo` block with `ImageGallery` JSON-LD. Unpublished segments return 404.",
        params: slugParam("gallery segment"),
        response: {
          200: ok(
            "The segment and its SEO block.",
            obj("Gallery detail.", { segment: gallerySegmentSchema, seo: seoSchema })
          ),
        },
      }),
    },
    (request, reply) => galleryController.getPublicSegment(request, reply)
  );

  fastify.post(
    "/admin/gallery",
    {
      preHandler: requirePermission("gallery"),
      schema: op({
        tags: TAGS,
        summary: "Create a gallery segment",
        description:
          "Only `name` is required. Segments start published — set `isPublished: false` to stage one. Add images afterwards with `POST /admin/gallery/{id}/images`.",
        access: ACCESS,
        body: jsonBody("The segment to create.", segmentBodyFields, ["name"]),
        errors: [409],
        response: {
          201: ok("The created segment.", gallerySegmentSchema),
        },
      }),
    },
    (request, reply) => galleryController.createSegment(request, reply)
  );

  fastify.get(
    "/admin/gallery",
    {
      preHandler: requirePermission("gallery"),
      schema: op({
        tags: TAGS,
        summary: "List all gallery segments",
        description: "Published and unpublished segments together, in display order.",
        access: ACCESS,
        query: queryParams(pageQuery(50)),
        response: {
          200: okPaged("A page of segments.", "segments", gallerySegmentSchema, "Segments on this page."),
        },
      }),
    },
    (request, reply) => galleryController.listSegments(request, reply)
  );

  fastify.get(
    "/admin/gallery/:id",
    {
      preHandler: requirePermission("gallery"),
      schema: op({
        tags: TAGS,
        summary: "Get one segment by id",
        description: "The segment with all of its images, whatever its published state.",
        access: ACCESS,
        params: idParam("gallery segment"),
        response: {
          200: ok("The segment.", gallerySegmentSchema),
        },
      }),
    },
    (request, reply) => galleryController.getSegment(request, reply)
  );

  fastify.patch(
    "/admin/gallery/:id",
    {
      preHandler: requirePermission("gallery"),
      schema: op({
        tags: TAGS,
        summary: "Update a gallery segment",
        description:
          "Send only the fields you want to change. Flipping `isPublished` is how a segment goes live or comes down.",
        access: ACCESS,
        params: idParam("gallery segment"),
        body: jsonBody("Fields to change. All optional.", withoutDefaults(segmentBodyFields)),
        errors: [409],
        response: {
          200: ok("The updated segment.", gallerySegmentSchema),
        },
      }),
    },
    (request, reply) => galleryController.updateSegment(request, reply)
  );

  fastify.delete(
    "/admin/gallery/:id",
    {
      preHandler: requirePermission("gallery"),
      schema: op({
        tags: TAGS,
        summary: "Delete a gallery segment",
        description:
          "Deletes the segment and its image entries. The underlying media library files are kept and can be reused elsewhere.",
        access: ACCESS,
        params: idParam("gallery segment"),
        response: {
          200: okMessage("The segment was deleted.", "Segment deleted"),
        },
      }),
    },
    (request, reply) => galleryController.deleteSegment(request, reply)
  );

  fastify.post(
    "/admin/gallery/:id/images",
    {
      preHandler: requirePermission("gallery"),
      schema: op({
        tags: TAGS,
        summary: "Add images to a segment",
        description: [
          "Attaches already-uploaded media to the segment, appended after the existing images. Upload the files first via `POST /admin/media/upload` and pass the returned ids here.",
          "",
          "`alt` is required on every image — it is what makes the gallery accessible and indexable.",
        ].join("\n"),
        access: ACCESS,
        params: idParam("gallery segment"),
        body: jsonBody(
          "The images to attach.",
          {
            images: arrayOf(
              obj("One image to attach.", {
                mediaId: id("media file already in the library"),
                alt: str("Alt text. Required.", {
                  minLength: 1,
                  example: "Steps leading down to Radha Kunda at dawn",
                }),
                caption: str("Caption rendered under the image."),
              }),
              "Images to append, in the order given."
            ),
          },
          ["images"]
        ),
        response: {
          201: okWrapped(
            "The images that were attached.",
            "images",
            arrayOf(galleryImageSchema, "Newly created gallery image entries.")
          ),
        },
      }),
    },
    (request, reply) => galleryController.addImages(request, reply)
  );

  fastify.post(
    "/admin/gallery/:id/reorder",
    {
      preHandler: requirePermission("gallery"),
      schema: op({
        tags: TAGS,
        summary: "Reorder images in a segment",
        description:
          "Rewrites the `order` of the listed gallery images. Send the complete list after a drag-and-drop so the positions stay contiguous. Ids are **gallery image** ids, not media ids.",
        access: ACCESS,
        params: idParam("gallery segment"),
        body: jsonBody(
          "The new positions.",
          {
            items: arrayOf(
              obj("One position assignment.", {
                id: id("gallery image"),
                order: int("New position, ascending from 0.", { example: 0 }),
              }),
              "Every image with its new position."
            ),
          },
          ["items"]
        ),
        response: {
          200: okMessage("The images were reordered.", "Images reordered"),
        },
      }),
    },
    (request, reply) => galleryController.reorderImages(request, reply)
  );

  fastify.delete(
    "/admin/gallery/images/:imageId",
    {
      preHandler: requirePermission("gallery"),
      schema: op({
        tags: TAGS,
        summary: "Remove an image from a segment",
        description:
          "Detaches one image. The underlying media library file is kept. Note the id here is the **gallery image** id, not the media id.",
        access: ACCESS,
        params: pathParams({ imageId: id("gallery image") }),
        response: {
          200: okMessage("The image was removed.", "Image deleted"),
        },
      }),
    },
    (request, reply) => galleryController.deleteImage(request, reply)
  );
}
