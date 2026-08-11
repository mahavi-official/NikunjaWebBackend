import { FastifyInstance } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { requireRole } from "@/plugins/rbac";
import dashboardService from "./dashboard.service";

export async function registerDashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/admin/dashboard/stats",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    async (request, reply) => {
      const stats = await dashboardService.getStats(request.server.prisma);

      return reply.send(successResponse(stats));
    }
  );

  fastify.get(
    "/admin/dashboard/activity",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR") },
    async (request, reply) => {
      const activity = await dashboardService.getRecentActivity(request.server.prisma);

      return reply.send(successResponse({ activity }));
    }
  );

  fastify.get(
    "/admin/audit-logs",
    { preHandler: requireRole("SUPER_ADMIN", "ADMIN") },
    async (request, reply) => {
      const {
        userId,
        entityType,
        action,
        page = "1",
        limit = "50",
      } = request.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const { logs, total } = await dashboardService.listAuditLogs(
        request.server.prisma,
        { userId, entityType, action },
        (pageNum - 1) * limitNum,
        limitNum
      );

      return reply.send(
        successResponse({ logs }, paginationMeta(pageNum, limitNum, total))
      );
    }
  );
}
