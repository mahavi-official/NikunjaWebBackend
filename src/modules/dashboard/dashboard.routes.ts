import { FastifyInstance } from "fastify";
import { successResponse, paginationMeta } from "@/lib/response";
import { requireRole } from "@/plugins/rbac";
import {
  arrayOf,
  id,
  ok,
  okPaged,
  okWrapped,
  op,
  pageQuery,
  queryParams,
  str,
} from "@/schemas/common";
import { auditLogSchema, dashboardStatsSchema } from "@/schemas/entities";
import dashboardService from "./dashboard.service";

const TAGS = ["Dashboard"];
const STAFF = "SUPER_ADMIN, ADMIN, or EDITOR";

export async function registerDashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/admin/dashboard/stats",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Dashboard counters",
        description:
          "The headline numbers for the admin landing page: content counts by status, user count, and unread contact messages. Computed live on every call — cheap COUNT queries, no caching.",
        access: STAFF,
        response: {
          200: ok("The counters.", dashboardStatsSchema),
        },
      }),
    },
    async (request, reply) => {
      const stats = await dashboardService.getStats(request.server.prisma);

      return reply.send(successResponse(stats));
    }
  );

  fastify.get(
    "/admin/dashboard/activity",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN", "EDITOR"),
      schema: op({
        tags: TAGS,
        summary: "Recent activity feed",
        description:
          "The 20 most recent audit entries, newest first, each resolved to the user who acted. This is the \"what changed lately\" panel. For filtering and paging use `/admin/audit-logs`.",
        access: STAFF,
        response: {
          200: okWrapped(
            "The activity feed.",
            "activity",
            arrayOf(auditLogSchema, "The 20 newest audit entries.")
          ),
        },
      }),
    },
    async (request, reply) => {
      const activity = await dashboardService.getRecentActivity(request.server.prisma);

      return reply.send(successResponse({ activity }));
    }
  );

  fastify.get(
    "/admin/audit-logs",
    {
      preHandler: requireRole("SUPER_ADMIN", "ADMIN"),
      schema: op({
        tags: TAGS,
        summary: "Search the audit log",
        description: [
          "Every recorded staff action, newest first, filterable by actor, entity type, or action name. Entries are pruned by a scheduled job, so this is not an unlimited history.",
          "",
          "`action` values are dotted, e.g. `post.publish`, `users.suspend`, `media.upload`, `research.file_upload`.",
        ].join("\n"),
        access: "SUPER_ADMIN or ADMIN",
        query: queryParams({
          userId: id("user whose actions to show"),
          entityType: str("Entity kind to filter by.", { example: "post" }),
          action: str("Exact action name to filter by.", { example: "post.publish" }),
          ...pageQuery(50),
        }),
        response: {
          200: okPaged(
            "A page of audit entries.",
            "logs",
            auditLogSchema,
            "Entries on this page, newest first."
          ),
        },
      }),
    },
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
