import { FastifyInstance } from "fastify";
import { engagementController } from "./engagement.controller";
import { requireRole } from "@/plugins/rbac";
import {
  bool,
  id,
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
import { commentSchema, likeStateSchema } from "@/schemas/entities";

const TAGS = ["Engagement"];
const MODERATOR = "SUPER_ADMIN, ADMIN, or EDITOR";

export async function registerEngagementRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/public/comments",
    {
      schema: op({
        tags: TAGS,
        summary: "List comments on a post",
        description:
          "Visible comments for one post, oldest first, each with the commenter's name and avatar. Comments hidden by a moderator are excluded. `postId` is required.",
        query: queryParams(
          {
            postId: id("post to read comments for"),
            ...pageQuery(20),
          },
          ["postId"]
        ),
        response: {
          200: okPaged(
            "A page of comments.",
            "comments",
            commentSchema,
            "Comments on this page."
          ),
        },
      }),
    },
    (request, reply) => engagementController.listComments(request, reply)
  );

  fastify.post(
    "/me/posts/:id/like",
    {
      schema: op({
        tags: TAGS,
        summary: "Like a post",
        description:
          "Takes no body. Idempotent — liking twice leaves one like. Returns the post's new total so the UI can update without a refetch.",
        access: "any signed-in user",
        params: idParam("post"),
        response: {
          200: ok("Like recorded.", likeStateSchema),
        },
      }),
    },
    (request, reply) => engagementController.likePost(request, reply)
  );

  fastify.delete(
    "/me/posts/:id/like",
    {
      schema: op({
        tags: TAGS,
        summary: "Remove your like from a post",
        description: "Idempotent — removing a like you never gave is not an error. Returns the post's new total.",
        access: "any signed-in user",
        params: idParam("post"),
        response: {
          200: ok("Like removed.", likeStateSchema),
        },
      }),
    },
    (request, reply) => engagementController.unlikePost(request, reply)
  );

  fastify.post(
    "/me/comments",
    {
      schema: op({
        tags: TAGS,
        summary: "Post a comment",
        description:
          "Any signed-in user may comment on a post that has `commentsEnabled`. The body is sanitised; 1–5000 characters.",
        access: "any signed-in user",
        body: jsonBody(
          "The comment to post.",
          {
            postId: id("post to comment on"),
            body: str("Comment text.", {
              minLength: 1,
              maxLength: 5000,
              example: "Thank you for this.",
            }),
          },
          ["postId", "body"]
        ),
        errors: [403, 404],
        response: {
          201: ok("The created comment.", commentSchema),
        },
      }),
    },
    (request, reply) => engagementController.createComment(request, reply)
  );

  fastify.patch(
    "/me/comments/:id",
    {
      schema: op({
        tags: TAGS,
        summary: "Edit your own comment",
        description:
          "Replaces the text of a comment you wrote. Editing someone else's returns 403.",
        access: "the comment's author",
        params: idParam("comment"),
        body: jsonBody(
          "The replacement text.",
          {
            body: str("New comment text.", {
              minLength: 1,
              maxLength: 5000,
              example: "Thank you — corrected a typo.",
            }),
          },
          ["body"]
        ),
        response: {
          200: ok("The updated comment.", commentSchema),
        },
      }),
    },
    (request, reply) => engagementController.updateComment(request, reply)
  );

  fastify.delete(
    "/me/comments/:id",
    {
      schema: op({
        tags: TAGS,
        summary: "Delete your own comment",
        description: "Permanent. Deleting someone else's comment returns 403 — staff use the admin route instead.",
        access: "the comment's author",
        params: idParam("comment"),
        response: {
          200: okMessage("The comment was deleted.", "Comment deleted"),
        },
      }),
    },
    (request, reply) => engagementController.deleteComment(request, reply)
  );

  fastify.get(
    "/admin/comments",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "List comments for moderation",
        description:
          "Every comment on one post, newest first, **including** the ones a moderator has hidden — each carries `isHidden` so the two can be told apart. The public endpoint omits hidden comments, which would otherwise make hiding irreversible from the UI. `postId` is required.",
        access: MODERATOR,
        query: queryParams(
          {
            postId: id("post to read comments for"),
            ...pageQuery(20),
          },
          ["postId"]
        ),
        response: {
          200: okPaged(
            "A page of comments, hidden ones included.",
            "comments",
            commentSchema,
            "Comments on this page."
          ),
        },
      }),
    },
    (request, reply) => engagementController.listCommentsForModeration(request, reply)
  );

  fastify.post(
    "/admin/comments/:id/hide",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Hide or unhide a comment",
        description:
          "Moderation toggle. A hidden comment disappears from `/public/comments` but is kept in the database. Send `{ \"isHidden\": false }` to restore it; the body may be omitted, which hides it.",
        access: MODERATOR,
        params: idParam("comment"),
        body: jsonBody("Which way to toggle. Defaults to hiding.", {
          isHidden: bool("`true` hides the comment, `false` restores it.", { example: true }),
        }),
        response: {
          200: ok("The comment, with its new moderation state.", commentSchema),
        },
      }),
    },
    (request, reply) => engagementController.hideComment(request, reply)
  );

  fastify.delete(
    "/admin/comments/:id",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Delete any comment",
        description:
          "Moderator delete — works on anyone's comment and is permanent. Prefer `/hide` when the comment may need to be reviewed later.",
        access: MODERATOR,
        params: idParam("comment"),
        response: {
          200: okMessage("The comment was deleted.", "Comment deleted"),
        },
      }),
    },
    (request, reply) => engagementController.deleteComment(request, reply)
  );
}
