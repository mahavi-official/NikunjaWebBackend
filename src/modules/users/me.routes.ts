import { FastifyInstance } from "fastify";
import { z } from "zod";
import { successResponse } from "@/lib/response";
import { NotFoundError } from "@/lib/errors";
import { enumOf, id, jsonBody, nullableStr, obj, ok, op, str } from "@/schemas/common";
import { meSchema, ROLE_VALUES } from "@/schemas/entities";

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
});

const TAGS = ["Me"];

export async function registerMeRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/me",
    {
      schema: op({
        tags: TAGS,
        summary: "Get your profile",
        description:
          "Resolves the Bearer token to the account behind it. Use this on app start to learn your role and which admin modules to render.",
        access: "any signed-in user",
        errors: [404],
        response: {
          200: ok("Your profile.", meSchema),
        },
      }),
    },
    async (request, reply) => {
      const user = await request.server.prisma.user.findUnique({
        where: { id: request.user!.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
          editorModules: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new NotFoundError("User not found");
      }

      return reply.send(successResponse(user));
    }
  );

  fastify.patch(
    "/me",
    {
      schema: op({
        tags: TAGS,
        summary: "Update your profile",
        description:
          "Changes your display name. Email, role, avatar, and status come from Google or an admin and cannot be edited here.",
        access: "any signed-in user",
        body: jsonBody("Fields to change.", {
          name: str("New display name.", { minLength: 1, example: "Ananda Das" }),
        }),
        response: {
          200: ok(
            "Your profile after the change.",
            obj("Updated identity fields.", {
              id: id("user"),
              email: str("Google account email.", { example: "you@example.com" }),
              name: str("Display name.", { example: "Ananda Das" }),
              avatarUrl: nullableStr("Google profile picture URL."),
              role: enumOf(ROLE_VALUES, "Your role."),
            })
          ),
        },
      }),
    },
    async (request, reply) => {
      const data = updateMeSchema.parse(request.body);

      const user = await request.server.prisma.user.update({
        where: { id: request.user!.id },
        data: { ...(data.name && { name: data.name }) },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
        },
      });

      return reply.send(successResponse(user));
    }
  );
}
