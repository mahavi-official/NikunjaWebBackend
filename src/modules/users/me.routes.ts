import { FastifyInstance } from "fastify";
import { z } from "zod";
import { successResponse } from "@/lib/response";
import { NotFoundError } from "@/lib/errors";

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
});

export async function registerMeRoutes(fastify: FastifyInstance) {
  fastify.get("/me", async (request, reply) => {
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
  });

  fastify.patch("/me", async (request, reply) => {
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
  });
}
