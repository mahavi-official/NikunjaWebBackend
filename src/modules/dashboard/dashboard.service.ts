import { PrismaClient } from "@prisma/client";

class DashboardService {
  async getStats(prisma: PrismaClient) {
    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      researchCount,
      galleryCount,
      videosCount,
      usersCount,
      unreadMessages,
    ] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: "PUBLISHED" } }),
      prisma.post.count({ where: { status: "DRAFT" } }),
      prisma.research.count(),
      prisma.gallerySegment.count(),
      prisma.video.count(),
      prisma.user.count(),
      prisma.contactMessage.count({ where: { isRead: false } }),
    ]);

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      researchCount,
      galleryCount,
      videosCount,
      usersCount,
      unreadMessages,
    };
  }

  async getRecentActivity(prisma: PrismaClient, take = 20) {
    return prisma.auditLog.findMany({
      take,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  async listAuditLogs(
    prisma: PrismaClient,
    filters: { userId?: string; entityType?: string; action?: string },
    skip = 0,
    take = 50
  ) {
    const where = {
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.action && { action: filters.action }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}

export default new DashboardService();
