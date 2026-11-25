import { FastifyInstance } from "fastify";
import { usersController } from "./users.controller";
import { requireRole } from "@/plugins/rbac";
import {
  arrayOf,
  enumOf,
  idParam,
  jsonBody,
  ok,
  okMessage,
  okPaged,
  okWrapped,
  op,
  pageQuery,
  queryParams,
  str,
} from "@/schemas/common";
import {
  EDITOR_MODULES,
  ROLE_VALUES,
  sessionSchema,
  userSchema,
  userStatusOnlySchema,
} from "@/schemas/entities";

const TAGS = ["Users"];
const STAFF = "SUPER_ADMIN or ADMIN";

const editorModulesField = arrayOf(
  enumOf(EDITOR_MODULES, "Module key."),
  "Modules an `EDITOR` may write to. Ignored for other roles."
);

/**
 * `SUPER_ADMIN` is a singleton, held by whichever row matches `SUPER_ADMIN_EMAIL`
 * and reasserted there on every boot (see `ensureSuperAdmin`). Neither creating
 * nor editing a user may grant it — that would mint a second super admin that
 * survives only until the next restart demotes it, in the meantime holding full
 * privileges nobody meant to give it. Excluding it from the request schema
 * rejects the attempt outright (400) rather than relying on a service-layer check.
 */
const ASSIGNABLE_ROLES = ROLE_VALUES.filter((role) => role !== "SUPER_ADMIN");

export async function registerUsersRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/admin/users",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Whitelist a new user",
        description: [
          "Pre-creates an account with status `WHITELISTED`. No invite email and no password — the row simply waits.",
          "The first time that person signs in with Google using this exact email, the Google identity binds to the row and the status flips to `ACTIVE`, keeping the role you set here.",
          "",
          "Signing in with an email that has no row creates a plain `MEMBER` instead.",
        ].join("\n"),
        access: STAFF,
        body: jsonBody(
          "The account to pre-create.",
          {
            email: str("Google account email. Must be unique.", {
              format: "email",
              example: "editor@radhakundah.com",
            }),
            name: str("Display name.", { minLength: 1, example: "Ananda Das" }),
            role: enumOf(ASSIGNABLE_ROLES, "Capability tier. `SUPER_ADMIN` cannot be assigned.", {
              default: "MEMBER",
            }),
            editorModules: { ...editorModulesField, default: [] },
          },
          ["email", "name"]
        ),
        errors: [409],
        response: {
          201: ok("The whitelisted account.", userSchema),
        },
      }),
    },
    (request, reply) => usersController.createUser(request, reply)
  );

  fastify.get(
    "/admin/users",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "List users",
        description: "Every user, newest first. Includes members, staff, and whitelisted rows that have never signed in.",
        access: STAFF,
        query: queryParams(pageQuery(20)),
        response: {
          200: okPaged("A page of users.", "users", userSchema, "Users on this page."),
        },
      }),
    },
    (request, reply) => usersController.listUsers(request, reply)
  );

  fastify.get(
    "/admin/users/:id",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Get one user",
        description: "Full record for a single user, including their editor module grants and last sign-in.",
        access: STAFF,
        params: idParam("user"),
        response: {
          200: ok("The user.", userSchema),
        },
      }),
    },
    (request, reply) => usersController.getUser(request, reply)
  );

  fastify.patch(
    "/admin/users/:id",
    {
      preHandler: requireRole("SUPER_ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Update a user",
        description: [
          "Changes the display name, role, and/or the editor module grants. Send only the fields you want to change.",
          "",
          "Super admin only. Email cannot be changed here — it is the account's identity. `SUPER_ADMIN` cannot be assigned as a role — it is a singleton held by the seeded account — and that seeded account cannot be edited by anyone else; either attempt returns 400/403.",
        ].join("\n"),
        access: "SUPER_ADMIN",
        params: idParam("user"),
        body: jsonBody("Fields to change. All are optional.", {
          name: str("New display name.", { minLength: 1, example: "Ananda Das" }),
          role: enumOf(ASSIGNABLE_ROLES, "New capability tier. `SUPER_ADMIN` cannot be assigned."),
          editorModules: editorModulesField,
        }),
        response: {
          200: ok("The updated user.", userSchema),
        },
      }),
    },
    (request, reply) => usersController.updateUser(request, reply)
  );

  fastify.post(
    "/admin/users/:id/suspend",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Suspend a user",
        description: [
          "Sets status to `SUSPENDED`. The next sign-in attempt is refused and existing access tokens stop working once they expire (within 15 minutes).",
          "",
          "Takes no body. The seeded super admin cannot be suspended, and you cannot suspend someone above your own role — both return 403.",
        ].join("\n"),
        access: STAFF,
        params: idParam("user"),
        response: {
          200: ok("The user, with its new status.", userStatusOnlySchema),
        },
      }),
    },
    (request, reply) => usersController.suspendUser(request, reply)
  );

  fastify.post(
    "/admin/users/:id/activate",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Reactivate a user",
        description: "Sets status back to `ACTIVE`, letting the person sign in again. Takes no body.",
        access: STAFF,
        params: idParam("user"),
        response: {
          200: ok("The user, with its new status.", userStatusOnlySchema),
        },
      }),
    },
    (request, reply) => usersController.activateUser(request, reply)
  );

  fastify.delete(
    "/admin/users/:id",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Delete a user",
        description: [
          "Permanently removes the account. Anything they wrote (posts, research, etc.) stays published under their name.",
          "",
          "The seeded super admin cannot be deleted, and you cannot delete someone whose role is equal to or higher than your own — both return 403.",
        ].join("\n"),
        access: STAFF,
        params: idParam("user"),
        response: {
          200: okMessage("The user was deleted.", "User deleted"),
        },
      }),
    },
    (request, reply) => usersController.deleteUser(request, reply)
  );

  fastify.get(
    "/me/sessions",
    {
      schema: op({
        tags: TAGS,
        summary: "List your own sessions",
        description:
          "Every refresh-token session on your account, newest first — one row per device you signed in from. The tokens themselves are never returned.",
        access: "any signed-in user",
        response: {
          200: okWrapped(
            "Your sessions.",
            "sessions",
            arrayOf(sessionSchema, "Sessions, newest first.")
          ),
        },
      }),
    },
    (request, reply) => usersController.getSessions(request, reply)
  );

  fastify.delete(
    "/me/sessions/:id",
    {
      schema: op({
        tags: TAGS,
        summary: "Revoke one of your sessions",
        description:
          "Signs that device out. Returns 404 if the session id is not yours, so one user cannot probe another's sessions.",
        access: "any signed-in user (own sessions only)",
        params: idParam("session"),
        response: {
          200: okMessage("The session was revoked.", "Session revoked"),
        },
      }),
    },
    (request, reply) => usersController.revokeSession(request, reply)
  );
}
