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
 */
export async function ensureSuperAdmin(prisma: PrismaClient): Promise<User> {
  return prisma.user.upsert({
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
    const user = await ensureSuperAdmin(prisma);
    log.info(`Super admin ready: ${user.email}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Could not ensure super admin (${env.SUPER_ADMIN_EMAIL}): ${message}`);
    process.exit(1);
  }
}
