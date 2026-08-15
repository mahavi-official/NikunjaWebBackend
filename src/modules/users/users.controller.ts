import { FastifyRequest, FastifyReply } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { createAuditLog } from "@/lib/audit";
import usersService from "./users.service";
import { CreateUserInput, UpdateUserInput } from "./users.schema";

export const usersController = {
  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const data = request.body as CreateUserInput;
    const user = await usersService.createUser(request.server.prisma, data);

    await createAuditLog(request.server.prisma, request, "users.create", "user", user.id, {
      email: user.email,
      role: user.role,
    });

    return reply.status(201).send(
      successResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        editorModules: user.editorModules,
        createdAt: user.createdAt,
      })
    );
  },

  async getUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = await usersService.getUser(request.server.prisma, id);

    return reply.send(
      successResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        editorModules: user.editorModules,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      })
    );
  },

  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateUserInput;

    const user = await usersService.updateUser(
      request.server.prisma,
      id,
      data,
      request.user!.id,
      request.user!.role
    );

    await createAuditLog(request.server.prisma, request, "users.update", "user", user.id);

    return reply.send(
      successResponse({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        editorModules: user.editorModules,
        createdAt: user.createdAt,
      })
    );
  },

  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const { page = "1", limit = "20" } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const { users, total } = await usersService.listUsers(
      request.server.prisma,
      skip,
      limitNum
    );

    return reply.send(
      successResponse(
        {
          users: users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            status: u.status,
            editorModules: u.editorModules,
            isProtected: u.isProtected,
            lastLoginAt: u.lastLoginAt,
            createdAt: u.createdAt,
          })),
        },
        paginationMeta(pageNum, limitNum, total)
      )
    );
  },

  async suspendUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const user = await usersService.suspendUser(
      request.server.prisma,
      id,
      request.user!.id,
      request.user!.role
    );

    await createAuditLog(request.server.prisma, request, "users.suspend", "user", user.id);

    return reply.send(
      successResponse({
        id: user.id,
        email: user.email,
        status: user.status,
      })
    );
  },

  async activateUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const user = await usersService.activateUser(
      request.server.prisma,
      id,
      request.user!.id,
      request.user!.role
    );

    await createAuditLog(request.server.prisma, request, "users.activate", "user", user.id);

    return reply.send(
      successResponse({
        id: user.id,
        email: user.email,
        status: user.status,
      })
    );
  },

  async getSessions(request: FastifyRequest, reply: FastifyReply) {
    const sessions = await usersService.getUserSessions(
      request.server.prisma,
      request.user!.id
    );

    return reply.send(successResponse({ sessions }));
  },

  async revokeSession(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    await usersService.revokeSession(request.server.prisma, id, request.user!.id);

    return reply.send(successResponse({ message: "Session revoked" }));
  },
};
