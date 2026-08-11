import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

const RETENTION_MONTHS = 12;

export async function pruneAuditLogs(prisma: PrismaClient): Promise<void> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  try {
    const { count } = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    console.log(`Pruned ${count} audit log entries older than ${cutoff.toISOString()}`);
  } catch (error) {
    console.error("Audit log pruning failed:", error);
  }
}

export function schedulePruning(prisma: PrismaClient): void {
  cron.schedule("0 3 * * 0", () => pruneAuditLogs(prisma));
  console.log("Audit log pruning scheduled: weekly Sunday 03:00");
}
