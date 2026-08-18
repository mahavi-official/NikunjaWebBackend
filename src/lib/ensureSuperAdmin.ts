import { PrismaClient, User } from "@prisma/client";
import { env } from "@/config/env";

/**
 * The super admin is the only account the platform cannot run without: it is
 * the sole route back in when every other staff account is gone. It therefore
 * gets created at boot in every environment rather than by a seed script an
 * operator has to remember to run.
 *
 * There is no password to set — the row is a pre-authorisation. `status` is
 * ACTIVE and `provider` is GOOGLE so the first Google sign-in on that address
 * matches the row and binds `providerId` to it.
 *
 * Only fields the platform owns are refreshed on an existing row: the email is
 * the identity, `role`/`status`/`isProtected` are re-asserted so a manual
 * demotion in the database cannot lock everyone out. `name` and `avatarUrl`
 * are left alone once set, because the account holder may have changed them.
 *
 * SUPER_ADMIN is singular: exactly one row may hold it. `SUPER_ADMIN_EMAIL` is
 * the sole authority on which row that is, so anyone else still carrying the
 * role — the previous holder after the env var was pointed at a new address —
 * is demoted to ADMIN here and loses `isProtected`. Demotion rather than
 * deletion: that account keeps its posts, its audit trail and staff access,
 * and the incoming super admin can then suspend or remove it deliberately
 * (which `isProtected` would otherwise forbid).
 */
export async function ensureSuperAdmin(prisma: PrismaClient): Promise<{
  user: User;
  demoted: string[];
}> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: env.SUPER_ADMIN_EMAIL },
      update: {
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        isProtected: true,
      },
      create: {
        email: env.SUPER_ADMIN_EMAIL,
        name: env.SUPER_ADMIN_NAME,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        isProtected: true,
        provider: "GOOGLE",
      },
    });

    // Matched on id, not email: the configured address may have been re-cased,
    // and the row may have been created in this very transaction.
    const stale = await tx.user.findMany({
      where: { id: { not: user.id }, role: "SUPER_ADMIN" },
      select: { id: true, email: true },
    });

    if (stale.length > 0) {
      await tx.user.updateMany({
        where: { id: { in: stale.map((u) => u.id) } },
        data: { role: "ADMIN", isProtected: false },
      });
    }

    // Separate sweep, because `isProtected` on a non-super-admin row is its own
    // fault: it makes that account unmanageable without conferring the role.
    // Clearing it must not touch `role`, or a protected EDITOR would be
    // promoted by the cleanup.
    await tx.user.updateMany({
      where: { id: { not: user.id }, isProtected: true },
      data: { isProtected: false },
    });

    return { user, demoted: stale.map((u) => u.email) };
  });
}

/**
 * Boot wrapper. The prisma plugin has already opened and proven the connection
 * by the time this runs, so a failure here is a real write failure — a missing
 * migration, a permissions problem — not a database that is still waking up.
 * That is fatal on purpose: an API with no super admin has no administrable
 * path forward, and a crash-loop is a louder, more fixable failure than a
 * silently unmanageable deployment.
 */
export async function ensureSuperAdminOrExit(
  prisma: PrismaClient,
  log: { info: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
  try {
    const { user, demoted } = await ensureSuperAdmin(prisma);
    log.info(`Super admin ready: ${user.email}`);
    if (demoted.length > 0) {
      log.info(
        `Demoted to ADMIN, no longer super admin: ${demoted.join(", ")}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Could not ensure super admin (${env.SUPER_ADMIN_EMAIL}): ${message}`);
    process.exit(1);
  }
}
