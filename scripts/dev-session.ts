/**
 * Mints a refresh-token session for a local user, so the CMS can be driven in a
 * browser without going through Google's consent screen.
 *
 * Development only — it writes a real `Session` row, exactly as the OAuth
 * callback would, and prints the raw token to set as the `refreshToken` cookie.
 *
 *   npx tsx scripts/dev-session.ts [email]
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to mint a session against a production database.");
  }

  const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL;
  if (!email) throw new Error("Pass an email, or set SUPER_ADMIN_EMAIL.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}.`);

  const token = randomBytes(32).toString("hex");

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userAgent: "dev-session script",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  console.log(JSON.stringify({ email: user.email, role: user.role, refreshToken: token }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
