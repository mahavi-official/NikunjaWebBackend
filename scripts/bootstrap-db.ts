/**
 * Local dev bootstrap: applies pending Prisma migrations, then seeds sample
 * content once, on the first run only. Wired into `postinstall` (after
 * `npm install`) and `predev` (before `npm run dev`), so a fresh clone works
 * end to end with just `npm install && npm run dev`.
 *
 * Never fails the surrounding `npm install`/`npm run dev` — a database that
 * isn't reachable yet (e.g. `docker compose up -d postgres` hasn't run) or
 * missing config just logs a notice and exits 0. This deliberately does not
 * import `src/config/env`: that module validates the *entire* env schema
 * (Azure Blob Storage, SMTP, Google OAuth, ...) at import time and calls `process.exit(1)`
 * on the first missing var, which would abort `npm install` on a fresh
 * clone before `.env` exists.
 */
import { execSync } from "node:child_process";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { SEED_MEDIA_PREFIX } from "../prisma/seed/data";
import { seedContent } from "../prisma/seed/content";

dotenv.config();

const log = (message: string) => console.log(`[bootstrap-db] ${message}`);

async function main() {
  if (!process.env.DATABASE_URL) {
    log("DATABASE_URL not set — skipping migrate/seed (copy .env.example to .env first).");
    return;
  }

  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  } catch {
    log("Could not apply migrations (is the database running?) — skipping seed.");
    return;
  }

  if (process.env.NODE_ENV === "production") {
    log("NODE_ENV=production — skipping sample-content seed.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const alreadySeeded = await prisma.media.findFirst({
      where: { blobName: { startsWith: SEED_MEDIA_PREFIX } },
      select: { id: true },
    });
    if (alreadySeeded) {
      log("Sample content already seeded — skipping.");
      return;
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminName = process.env.SUPER_ADMIN_NAME;
    if (!superAdminEmail || !superAdminName) {
      log("SUPER_ADMIN_EMAIL/SUPER_ADMIN_NAME not set — skipping seed (needed to attribute seeded posts).");
      return;
    }

    // Posts need a staff author. The API upserts this same row at boot
    // (src/lib/ensureSuperAdmin.ts); bootstrap does the minimal equivalent
    // so seeding works before the server has ever run. That includes the
    // single-super-admin invariant: any other holder of the role is demoted
    // to ADMIN, so seeding can never leave two super admins behind. Kept
    // inline rather than importing ensureSuperAdmin, which pulls in
    // src/config/env and its exit-on-first-missing-var validation.
    await prisma.$transaction(async (tx) => {
      const superAdmin = await tx.user.upsert({
        where: { email: superAdminEmail },
        update: { role: "SUPER_ADMIN", status: "ACTIVE", isProtected: true },
        create: {
          email: superAdminEmail,
          name: superAdminName,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          isProtected: true,
          provider: "GOOGLE",
        },
      });

      const { count } = await tx.user.updateMany({
        where: { id: { not: superAdmin.id }, role: "SUPER_ADMIN" },
        data: { role: "ADMIN", isProtected: false },
      });
      if (count > 0) log(`Demoted ${count} previous super admin(s) to ADMIN.`);

      await tx.user.updateMany({
        where: { id: { not: superAdmin.id }, isProtected: true },
        data: { isProtected: false },
      });
    });

    log("Seeding sample content (first run)...");
    await seedContent(prisma, (message) => {
      if (message) log(message);
    });
    log("Done.");
  } catch (error) {
    log(`Seed step failed: ${error instanceof Error ? error.message : error}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
