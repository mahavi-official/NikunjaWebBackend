/**
 * Sample content seeder.
 *
 *   npm run seed:content              seed (idempotent — safe to re-run)
 *   npm run seed:content:clean        remove everything the seeder created
 *
 * Deliberately not part of `npm run build`: a build produces an artefact and
 * has no database, while seeding acts on one specific database. They belong to
 * different stages and different environments.
 *
 * The super admin is NOT seeded here — the API creates it at boot in every
 * environment (see src/lib/ensureSuperAdmin.ts), so it can never be missing.
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { cleanContent, seedContent } from "./content";

dotenv.config();

const args = process.argv.slice(2);
const wantsClean = args.includes("--clean");
const force = args.includes("--force");
const isProduction = process.env.NODE_ENV === "production";

const log = (message: string) => console.log(message ? `  ${message}` : "");

async function main() {
  if (isProduction && !force) {
    console.error(
      "\n✗ Refusing to run against NODE_ENV=production.\n" +
        "  This writes sample content, which does not belong in a live database.\n" +
        "  Pass --force if you genuinely mean to.\n"
    );
    process.exit(1);
  }

  if (isProduction) {
    console.warn("\n⚠  NODE_ENV=production and --force was passed. Proceeding anyway.");
  }

  const prisma = new PrismaClient();
  const startedAt = Date.now();

  try {
    if (wantsClean) {
      console.log("\n🧹 Removing seeded content\n");
      await cleanContent(prisma, log);
    } else {
      console.log("\n🌱 Seeding sample content\n");
      await seedContent(prisma, log);
      printWhatToTry();
    }

    console.log(`\n✅ Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s\n`);
  } catch (error) {
    console.error("\n❌ Seed failed:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function printWhatToTry() {
  const base = process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`;

  console.log(`
  Try it:
    ${base}/api/v1/public/home
    ${base}/api/v1/public/posts
    ${base}/api/v1/public/research
    ${base}/api/v1/public/videos
    ${base}/api/v1/public/gallery
    ${base}/api/v1/public/authors
    ${base}/api/v1/public/search?q=manuscript
    ${base}/docs

  Deliberately hidden, to prove the filters work:
    1 draft post, 1 scheduled post (dated a week out), 1 draft paper,
    1 draft video, 1 unpublished gallery segment, 1 hidden comment,
    1 inactive hero slide.

  Notes:
    · Images point at picsum.photos — nothing is uploaded to Blob Storage.
    · Research PDFs are metadata only, so the gated download endpoint will not
      resolve a real file for seeded papers.
    · Video ids are real public YouTube videos, chosen so thumbnails and embeds
      load; their titles here are placeholders.
    · Re-running overwrites the seeded rows with whatever prisma/seed/data.ts
      currently says. Content you authored yourself is never touched.`);
}

main();
